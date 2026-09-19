// backend/src/scraper/scrape-product.js
// Orchestrates scraping a single product with retries, validation, error classification, and atomic database persistence.

import { getDb } from '../db/supabase.js';
import {
  MAX_ATTEMPTS,
  IDEMPOTENCY_WINDOW_MS,
  ERROR_TAXONOMY
} from './constants.js';
import { fetchProductPriceDirect } from './fetcher.js';
import { decryptPayload, parsePriceQuote } from './parser.js';
import { validateWithJumpCheck } from './validator.js';
import { classifyError } from './classify-error.js';
import { isRetryable, calculateBackoff, sleep } from './retry.js';

export async function scrapeProduct(product, options = {}) {
  const db = options.db || getDb();
  const trigger = options.trigger || 'manual';
  const runId = options.runId || null;
  const baseUrl = options.baseUrl;
  const customFetch = options.fetch;

  const productId = product.id;
  const storeProductId = product.store_product_id;

  // 1. Idempotency Guard: Skip duplicate cron triggers if recently succeeded
  if (trigger === 'cron' && product.last_success_at) {
    const timeSinceLastSuccess = Date.now() - new Date(product.last_success_at).getTime();
    if (timeSinceLastSuccess < IDEMPOTENCY_WINDOW_MS) {
      return {
        status: 'skipped',
        reason: 'idempotent_recent_success',
        productId,
        timeSinceLastSuccess
      };
    }
  }

  // 2. Query previous stored price for volatility jump comparison
  let lastPriceCents = null;
  try {
    const { data: latestHistory } = await db
      .from('price_history')
      .select('price_cents')
      .eq('product_id', productId)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();
    if (latestHistory && latestHistory.price_cents > 0) {
      lastPriceCents = latestHistory.price_cents;
    }
  } catch {
    // If no previous history exists, lastPriceCents remains null
  }

  // 3. Insert initial scrape_log row (defensive: defaults to 'failed' until proven success)
  const startedAt = new Date().toISOString();
  let logId = options.logId || null;

  if (!logId) {
    const { data: insertedLog, error: logErr } = await db
      .from('scrape_log')
      .insert({
        product_id: productId,
        run_id: runId,
        status: 'failed',
        attempts: 1,
        started_at: startedAt,
        duration_ms: 0,
        extracted: {}
      })
      .select('id')
      .single();

    if (logErr || !insertedLog) {
      throw new Error(`Failed to create initial scrape_log row: ${logErr?.message}`);
    }
    logId = insertedLog.id;
  }

  let finalStatus = 'failed';
  let attemptsUsed = 0;
  let lastHttpStatus = null;
  let lastErrorType = null;
  let lastErrorMessage = null;
  let isStructureChanged = false;
  let extractedPayload = {};
  let validatedQuote = null;
  let isFlagged = false;
  const runStartMs = Date.now();

  try {
    // 4. Retry Loop (up to 4 attempts)
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      attemptsUsed = attempt;
      let rawJson = null;
      let token = null;

      try {
        // Fetch raw encrypted quote
        const fetchResult = await fetchProductPriceDirect(storeProductId, {
          baseUrl,
          fetch: customFetch
        });
        rawJson = fetchResult.rawJson;
        token = fetchResult.token;
        lastHttpStatus = fetchResult.httpStatus;

        // Decrypt quote
        const decryptedObj = decryptPayload(rawJson.e, token);
        extractedPayload = decryptedObj;

        // Parse normalized quote
        const parsedQuote = parsePriceQuote(decryptedObj);

        // Validation & Volatility Jump Check
        const refetchFn = async () => {
          const secondFetch = await fetchProductPriceDirect(storeProductId, {
            baseUrl,
            fetch: customFetch
          });
          const secondDecrypted = decryptPayload(secondFetch.rawJson.e, secondFetch.token);
          return parsePriceQuote(secondDecrypted);
        };

        const validation = await validateWithJumpCheck(parsedQuote, lastPriceCents, refetchFn);

        if (!validation.valid) {
          const valErr = new Error(validation.message);
          valErr.errorType = validation.errorType || ERROR_TAXONOMY.VALIDATION_FAILED;
          throw valErr;
        }

        // Passed validation!
        validatedQuote = validation.quote;
        isFlagged = Boolean(validation.flagged);
        finalStatus = attempt === 1 ? 'success' : 'retried';
        break; // Scrape succeeded, exit retry loop
      } catch (err) {
        lastHttpStatus = err.httpStatus || lastHttpStatus;
        lastErrorMessage = err.message || 'Unknown scrape error';
        lastErrorType = classifyError(err, lastHttpStatus);

        if (lastErrorType === ERROR_TAXONOMY.STRUCTURE_CHANGED) {
          isStructureChanged = true;
        }

        const canRetry = attempt < MAX_ATTEMPTS && isRetryable(lastErrorType, lastHttpStatus);

        if (!canRetry) {
          finalStatus = 'failed';
          break;
        }

        // Calculate exponential backoff + jitter and pause
        const backoffMs = calculateBackoff(attempt, err.retryAfter);
        await sleep(backoffMs);
      }
    }
  } finally {
    // 5. Atomic Persistence (guaranteed execution)
    const durationMs = Date.now() - runStartMs;

    if (finalStatus === 'success' || finalStatus === 'retried') {
      // Atomic RPC write: updates log, inserts price_history, advances next_scrape_at
      await db.rpc('finalize_scrape_success', {
        p_scrape_log_id: logId,
        p_product_id: productId,
        p_price_cents: validatedQuote.priceCents,
        p_currency: validatedQuote.currency,
        p_in_stock: validatedQuote.inStock,
        p_stock_quantity: validatedQuote.stockQuantity,
        p_flagged: isFlagged,
        p_attempts: attemptsUsed,
        p_status: finalStatus,
        p_duration_ms: durationMs,
        p_http_status: lastHttpStatus || 200,
        p_extracted: extractedPayload
      });
    } else {
      // Atomic RPC failure: updates log and advances schedule; NEVER writes to price_history
      await db.rpc('finalize_scrape_failure', {
        p_scrape_log_id: logId,
        p_product_id: productId,
        p_attempts: attemptsUsed,
        p_status: 'failed',
        p_duration_ms: durationMs,
        p_http_status: lastHttpStatus,
        p_error_type: lastErrorType,
        p_error_message: lastErrorMessage,
        p_structure_changed: isStructureChanged,
        p_extracted: extractedPayload
      });
    }
  }

  return {
    productId,
    status: finalStatus,
    attempts: attemptsUsed,
    durationMs: Date.now() - runStartMs,
    errorType: lastErrorType,
    errorMessage: lastErrorMessage,
    quote: validatedQuote,
    flagged: isFlagged
  };
}

export default scrapeProduct;
