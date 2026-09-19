-- Product Price Tracker: Database Schema for Supabase Postgres
-- Conforms to assignments P0 core requirements and explicit amendments.

-- Enable pgcrypto / uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

--------------------------------------------------------------------------------
-- 1. TRACKED PRODUCTS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tracked_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_product_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    image_url TEXT,
    category TEXT,
    extra JSONB DEFAULT '{}'::jsonb,
    -- Amendment 1: scrape_interval_minutes must be a multiple of 120, default 120
    scrape_interval_minutes INTEGER NOT NULL DEFAULT 120 
        CHECK (scrape_interval_minutes > 0 AND scrape_interval_minutes % 120 = 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_scraped_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    next_scrape_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 2. SCRAPE RUNS (Execution batches and lock manager)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrape_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'manual', 'cli')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    products_total INTEGER NOT NULL DEFAULT 0,
    products_ok INTEGER NOT NULL DEFAULT 0,
    products_failed INTEGER NOT NULL DEFAULT 0
);

--------------------------------------------------------------------------------
-- 3. SCRAPE LOG (Audit trail of every scrape attempt)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrape_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
    run_id UUID REFERENCES scrape_runs(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'retried', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts >= 1),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    http_status INTEGER,
    error_type TEXT CHECK (
        error_type IS NULL OR error_type IN (
            'TIMEOUT',
            'NETWORK',
            'HTTP_5XX',
            'HTTP_4XX',
            'RATE_LIMITED',
            'PLACEHOLDER_CONTENT',
            'EMPTY_RESPONSE',
            'STRUCTURE_CHANGED',
            'VALIDATION_FAILED'
        )
    ),
    error_message TEXT,
    structure_changed BOOLEAN NOT NULL DEFAULT false,
    extracted JSONB DEFAULT '{}'::jsonb
);

--------------------------------------------------------------------------------
-- 4. PRICE HISTORY (Successful scrapes ONLY; never empty/placeholder/zero)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
    price_cents INTEGER NOT NULL CHECK (price_cents > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    in_stock BOOLEAN NOT NULL,
    stock_quantity INTEGER,
    -- Amendment 3: Flagged when agreeing fetch confirms a high volatility price jump
    flagged BOOLEAN NOT NULL DEFAULT false,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    scrape_log_id UUID NOT NULL REFERENCES scrape_log(id) ON DELETE CASCADE
);

--------------------------------------------------------------------------------
-- 5. ALERTS (Anomalies, price drops, structural changes, failing scrapes)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('price_drop', 'back_in_stock', 'structure_changed', 'scrape_failing')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_read BOOLEAN NOT NULL DEFAULT false
);

--------------------------------------------------------------------------------
-- 6. INDEXES
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_price_history_product_scraped ON price_history (product_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_log_product_started ON scrape_log (product_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracked_products_active_next ON tracked_products (next_scrape_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts (is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_status ON scrape_runs (status, started_at DESC);

--------------------------------------------------------------------------------
-- 7. ATOMIC TRANSACTION FUNCTIONS (Postgres RPC) [Amendment 2]
--------------------------------------------------------------------------------

-- Finalizes a successful scrape: updates scrape_log, inserts price_history, and updates product in ONE transaction
CREATE OR REPLACE FUNCTION finalize_scrape_success(
    p_scrape_log_id UUID,
    p_product_id UUID,
    p_price_cents INTEGER,
    p_currency TEXT,
    p_in_stock BOOLEAN,
    p_stock_quantity INTEGER,
    p_flagged BOOLEAN,
    p_attempts INTEGER,
    p_status TEXT,
    p_duration_ms INTEGER,
    p_http_status INTEGER,
    p_extracted JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_history_id UUID;
    v_interval_mins INTEGER;
    v_result JSONB;
BEGIN
    -- 1. Verify product exists and read scrape_interval_minutes
    SELECT scrape_interval_minutes INTO v_interval_mins
    FROM tracked_products
    WHERE id = p_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found', p_product_id;
    END IF;

    -- 2. Update scrape_log row
    UPDATE scrape_log
    SET status = p_status,
        attempts = p_attempts,
        finished_at = now(),
        duration_ms = p_duration_ms,
        http_status = p_http_status,
        error_type = NULL,
        error_message = NULL,
        structure_changed = false,
        extracted = p_extracted
    WHERE id = p_scrape_log_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scrape log row % not found', p_scrape_log_id;
    END IF;

    -- 3. Insert price_history row (Successful scrapes ONLY)
    INSERT INTO price_history (
        product_id,
        price_cents,
        currency,
        in_stock,
        stock_quantity,
        flagged,
        scraped_at,
        scrape_log_id
    )
    VALUES (
        p_product_id,
        p_price_cents,
        p_currency,
        p_in_stock,
        p_stock_quantity,
        p_flagged,
        now(),
        p_scrape_log_id
    )
    RETURNING id INTO v_history_id;

    -- 4. Update tracked_products timestamps
    UPDATE tracked_products
    SET last_scraped_at = now(),
        last_success_at = now(),
        next_scrape_at = now() + (COALESCE(v_interval_mins, 120) * INTERVAL '1 minute')
    WHERE id = p_product_id;

    v_result := jsonb_build_object(
        'success', true,
        'history_id', v_history_id,
        'scrape_log_id', p_scrape_log_id
    );

    RETURN v_result;
END;
$$;

-- Finalizes a failed scrape: updates scrape_log and advances next_scrape_at, but NEVER inserts price_history
CREATE OR REPLACE FUNCTION finalize_scrape_failure(
    p_scrape_log_id UUID,
    p_product_id UUID,
    p_attempts INTEGER,
    p_status TEXT,
    p_duration_ms INTEGER,
    p_http_status INTEGER,
    p_error_type TEXT,
    p_error_message TEXT,
    p_structure_changed BOOLEAN,
    p_extracted JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_interval_mins INTEGER;
    v_result JSONB;
BEGIN
    SELECT scrape_interval_minutes INTO v_interval_mins
    FROM tracked_products
    WHERE id = p_product_id;

    -- 1. Update scrape_log
    UPDATE scrape_log
    SET status = p_status,
        attempts = p_attempts,
        finished_at = now(),
        duration_ms = p_duration_ms,
        http_status = p_http_status,
        error_type = p_error_type,
        error_message = p_error_message,
        structure_changed = p_structure_changed,
        extracted = p_extracted
    WHERE id = p_scrape_log_id;

    -- 2. Update tracked_products timestamps (advance next_scrape_at so a failing item is retried on next schedule)
    UPDATE tracked_products
    SET last_scraped_at = now(),
        next_scrape_at = now() + (COALESCE(v_interval_mins, 120) * INTERVAL '1 minute')
    WHERE id = p_product_id;

    -- 3. Create alert if structure changed or scrape failing
    IF p_structure_changed THEN
        INSERT INTO alerts (product_id, type, message)
        VALUES (p_product_id, 'structure_changed', COALESCE(p_error_message, 'Store response structure changed'));
    END IF;

    v_result := jsonb_build_object(
        'success', false,
        'scrape_log_id', p_scrape_log_id,
        'error_type', p_error_type
    );

    RETURN v_result;
END;
$$;

--------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS)
--------------------------------------------------------------------------------
ALTER TABLE tracked_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Note: No public policies are created. All database queries must run through the
-- backend Express service using the Supabase service-role key.
