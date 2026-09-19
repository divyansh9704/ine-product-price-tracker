// backend/test/integration/scraper.test.js
// Integration test suite validating scraper reliability against local mock server and injected fake DB.
// Covers all 5 critical assignment assertions (a, b, c, d, e) and user amendments (atomic writes, price jump).

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockStoreServer } from './mock-store.js';
import { FakeDatabase } from '../../src/db/fake-db.js';
import { scrapeProduct } from '../../src/scraper/scrape-product.js';
import { executeScheduledScrape } from '../../src/scraper/run-manager.js';
import { ERROR_TAXONOMY } from '../../src/scraper/constants.js';

describe('Scraper Integration Tests (Reliability & Fault Invariants)', () => {
  let mockServer;
  let mockUrl;
  let fakeDb;

  before(async () => {
    mockServer = new MockStoreServer();
    mockUrl = await mockServer.start();
  });

  after(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.clearFaults();
    fakeDb = new FakeDatabase();
  });

  // ===========================================================================
  // Assertion (a): No price_history row is ever created on failure
  // ===========================================================================
  describe('Assertion (a): Never store wrong/empty/failed data in price_history', () => {
    it('creates zero price_history rows when upstream returns persistent 503', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '101', name: 'Product 101' });
      // Inject persistent 503 error for all 4 attempts
      mockServer.setFault('101', '503', 10);

      const result = await scrapeProduct(product, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'manual'
      });

      assert.equal(result.status, 'failed');
      assert.equal(result.errorType, ERROR_TAXONOMY.HTTP_5XX);

      // Verify DB invariants
      const { data: priceHistory } = await fakeDb
        .from('price_history')
        .select('*')
        .eq('product_id', product.id);

      assert.equal(priceHistory.length, 0, 'price_history must have 0 rows on failure');
    });

    it('creates zero price_history rows on structural corruption', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '102', name: 'Product 102' });
      mockServer.setFault('102', 'structure_changed', 10);

      const result = await scrapeProduct(product, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'manual'
      });

      assert.equal(result.status, 'failed');
      assert.equal(result.errorType, ERROR_TAXONOMY.STRUCTURE_CHANGED);

      const { data: priceHistory } = await fakeDb
        .from('price_history')
        .select('*')
        .eq('product_id', product.id);

      assert.equal(priceHistory.length, 0, 'price_history must have 0 rows on structure change');

      // Verify alert was created
      const { data: alerts } = await fakeDb
        .from('alerts')
        .select('*')
        .eq('product_id', product.id);

      assert.ok(alerts.length >= 1, 'alert must be created on structure change');
      assert.equal(alerts[0].type, 'structure_changed');
    });

    it('creates zero price_history rows when volatility jump confirmation disagrees', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '103', name: 'Product 103' });

      // Seed previous price at 100000 cents (₹1000)
      await fakeDb.rpc('finalize_scrape_success', {
        p_scrape_log_id: fakeDb.genId(),
        p_product_id: product.id,
        p_price_cents: 100000,
        p_currency: 'INR',
        p_in_stock: true,
        p_stock_quantity: 10,
        p_flagged: false,
        p_attempts: 1,
        p_status: 'success',
        p_duration_ms: 100,
        p_http_status: 200,
        p_extracted: {}
      });

      // Inject disagreeing jump (fetch 1 returns 1600, fetch 2 returns 1100)
      mockServer.setFault('103', 'jump_disagree', 10);

      const result = await scrapeProduct(product, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'manual'
      });

      assert.equal(result.status, 'failed');
      assert.equal(result.errorType, ERROR_TAXONOMY.VALIDATION_FAILED);

      // Verify price_history still only has the 1 original baseline row, no new row!
      const { data: priceHistory } = await fakeDb
        .from('price_history')
        .select('*')
        .eq('product_id', product.id);

      assert.equal(priceHistory.length, 1, 'No new price_history row should be created for diverged jump');
    });
  });

  // ===========================================================================
  // Assertion (b): A scrape_log row is always created and updated
  // ===========================================================================
  describe('Assertion (b): scrape_log audit row is always created', () => {
    it('records an audit log row even on total failure', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '201', name: 'Product 201' });
      mockServer.setFault('201', '503', 10);

      const result = await scrapeProduct(product, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'manual'
      });

      assert.equal(result.status, 'failed');

      const { data: logs } = await fakeDb
        .from('scrape_log')
        .select('*')
        .eq('product_id', product.id);

      assert.equal(logs.length, 1, 'scrape_log must have exactly 1 record');
      const log = logs[0];
      assert.equal(log.status, 'failed');
      assert.equal(log.error_type, ERROR_TAXONOMY.HTTP_5XX);
      assert.ok(log.attempts >= 1);
      assert.ok(log.finished_at !== null);
      assert.ok(log.duration_ms >= 0);
    });

    it('records an audit log row on successful scrape with extracted payload', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '202', name: 'Product 202' });

      const result = await scrapeProduct(product, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'manual'
      });

      assert.equal(result.status, 'success');

      const { data: logs } = await fakeDb
        .from('scrape_log')
        .select('*')
        .eq('product_id', product.id);

      assert.equal(logs.length, 1);
      const log = logs[0];
      assert.equal(log.status, 'success');
      assert.equal(log.attempts, 1);
      assert.equal(log.error_type, null);
      assert.ok(log.extracted);
      assert.equal(log.extracted.p, 2499);
    });
  });

  // ===========================================================================
  // Assertion (c): Retried vs failed vs success statuses are accurate
  // ===========================================================================
  describe('Assertion (c): Correct status semantics (success, retried, failed)', () => {
    it('records "success" when the first attempt succeeds', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '301', name: 'Product 301' });

      const result = await scrapeProduct(product, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'manual'
      });

      assert.equal(result.status, 'success');
      assert.equal(result.attempts, 1);

      const { data: logs } = await fakeDb
        .from('scrape_log')
        .select('*')
        .eq('product_id', product.id);

      assert.equal(logs[0].status, 'success');
      assert.equal(logs[0].attempts, 1);
    });

    it('records "retried" when succeeding after an initial 503 error', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '302', name: 'Product 302' });
      // 503 on first attempt, then succeeds on attempt 2
      mockServer.setFault('302', '503', 1);

      const result = await scrapeProduct(product, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'manual'
      });

      assert.equal(result.status, 'retried');
      assert.equal(result.attempts, 2);

      const { data: logs } = await fakeDb
        .from('scrape_log')
        .select('*')
        .eq('product_id', product.id);

      assert.equal(logs[0].status, 'retried');
      assert.equal(logs[0].attempts, 2);

      const { data: priceHistory } = await fakeDb
        .from('price_history')
        .select('*')
        .eq('product_id', product.id);

      assert.equal(priceHistory.length, 1, 'Price history must be stored on eventual retry success');
    });

    it('records "retried" when recovering from rate limit (429)', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '303', name: 'Product 303' });
      // 429 on first attempt, then succeeds
      mockServer.setFault('303', '429', 1);

      const result = await scrapeProduct(product, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'manual'
      });

      assert.equal(result.status, 'retried');
      assert.equal(result.attempts, 2);
    });

    it('records "retried" when recovering from placeholder content (g: 1)', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '304', name: 'Product 304' });
      // Placeholder on first attempt, then real price
      mockServer.setFault('304', 'placeholder', 1);

      const result = await scrapeProduct(product, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'manual'
      });

      assert.equal(result.status, 'retried');
      assert.equal(result.attempts, 2);
      assert.equal(result.quote.isPending, false);
    });

    it('records "failed" when all 4 attempts are exhausted', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '305', name: 'Product 305' });
      mockServer.setFault('305', '503', 10);

      const result = await scrapeProduct(product, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'manual'
      });

      assert.equal(result.status, 'failed');
      assert.equal(result.attempts, 4);

      const { data: logs } = await fakeDb
        .from('scrape_log')
        .select('*')
        .eq('product_id', product.id);

      assert.equal(logs[0].status, 'failed');
      assert.equal(logs[0].attempts, 4);
    });
  });

  // ===========================================================================
  // Assertion (d): One product failure does not block others
  // ===========================================================================
  describe('Assertion (d): Multi-product isolation and concurrency', () => {
    it('successfully scrapes surviving products when one product fails', async () => {
      const p1 = fakeDb.seedProduct({ store_product_id: '401', name: 'Failing Product' });
      const p2 = fakeDb.seedProduct({ store_product_id: '402', name: 'Healthy Product 1' });
      const p3 = fakeDb.seedProduct({ store_product_id: '403', name: 'Healthy Product 2' });

      // Product 401 fails persistently
      mockServer.setFault('401', '503', 10);

      const summary = await executeScheduledScrape({
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'manual',
        productIds: [p1.id, p2.id, p3.id]
      });

      assert.equal(summary.total, 3);
      assert.equal(summary.ok, 2);
      assert.equal(summary.failed, 1);

      // Verify Product 401 has 0 price_history rows
      const { data: h1 } = await fakeDb.from('price_history').select('*').eq('product_id', p1.id);
      assert.equal(h1.length, 0);

      // Verify Products 402 and 403 have valid price_history rows
      const { data: h2 } = await fakeDb.from('price_history').select('*').eq('product_id', p2.id);
      assert.equal(h2.length, 1);
      assert.equal(h2[0].price_cents, 249900);

      const { data: h3 } = await fakeDb.from('price_history').select('*').eq('product_id', p3.id);
      assert.equal(h3.length, 1);
      assert.equal(h3[0].price_cents, 249900);
    });
  });

  // ===========================================================================
  // Assertion (e): Duplicate cron triggers do not create duplicate rows
  // ===========================================================================
  describe('Assertion (e): Idempotency under duplicate cron triggers', () => {
    it('skips scrape when product was successfully scraped within 20 minutes', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '501', name: 'Idempotent Product' });

      // First scrape via cron: succeeds
      const res1 = await scrapeProduct(product, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'cron'
      });
      assert.equal(res1.status, 'success');

      const { data: history1 } = await fakeDb.from('price_history').select('*').eq('product_id', product.id);
      const { data: logs1 } = await fakeDb.from('scrape_log').select('*').eq('product_id', product.id);
      assert.equal(history1.length, 1);
      assert.equal(logs1.length, 1);

      // Fetch the updated product from fakeDb (last_success_at is now set)
      const updatedProduct = fakeDb.tables.tracked_products.get(product.id);

      // Immediate duplicate trigger via cron: must be skipped
      const res2 = await scrapeProduct(updatedProduct, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'cron'
      });
      assert.equal(res2.status, 'skipped');
      assert.equal(res2.reason, 'idempotent_recent_success');

      // Verify no duplicate rows were added!
      const { data: history2 } = await fakeDb.from('price_history').select('*').eq('product_id', product.id);
      const { data: logs2 } = await fakeDb.from('scrape_log').select('*').eq('product_id', product.id);
      assert.equal(history2.length, 1, 'No duplicate price_history rows on duplicate cron trigger');
      assert.equal(logs2.length, 1, 'No duplicate scrape_log rows on duplicate cron trigger');
    });

    it('allows manual trigger even if recently scraped via cron', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '502', name: 'Manual Trigger Product' });

      // First scrape
      await scrapeProduct(product, { db: fakeDb, baseUrl: mockUrl, trigger: 'cron' });
      const updatedProduct = fakeDb.tables.tracked_products.get(product.id);

      // Second scrape with trigger: 'manual' -> should NOT be skipped
      const res2 = await scrapeProduct(updatedProduct, { db: fakeDb, baseUrl: mockUrl, trigger: 'manual' });
      assert.equal(res2.status, 'success');

      const { data: history } = await fakeDb.from('price_history').select('*').eq('product_id', product.id);
      assert.equal(history.length, 2, 'Manual scrape is allowed to execute on demand');
    });
  });

  // ===========================================================================
  // Amendment 2 & 3: Atomic writes and Price Jump Flagging
  // ===========================================================================
  describe('Amendments 2 & 3: Atomic writes and Volatility Jump Flagging', () => {
    it('sets flagged=true when confirmed volatility jump agrees', async () => {
      const product = fakeDb.seedProduct({ store_product_id: '601', name: 'Jump Product' });

      // Baseline price: 100000 cents (₹1000)
      await fakeDb.rpc('finalize_scrape_success', {
        p_scrape_log_id: fakeDb.genId(),
        p_product_id: product.id,
        p_price_cents: 100000,
        p_currency: 'INR',
        p_in_stock: true,
        p_stock_quantity: 10,
        p_flagged: false,
        p_attempts: 1,
        p_status: 'success',
        p_duration_ms: 100,
        p_http_status: 200,
        p_extracted: {}
      });

      // 60% jump agreeing on both fetches
      mockServer.setFault('601', 'jump_agree', 10, { jumpPrice: 1600 });

      const result = await scrapeProduct(product, {
        db: fakeDb,
        baseUrl: mockUrl,
        trigger: 'manual'
      });

      assert.equal(result.status, 'success');
      assert.equal(result.flagged, true);

      // Verify price_history row has flagged = true
      const { data: history } = await fakeDb
        .from('price_history')
        .select('*')
        .eq('product_id', product.id)
        .order('scraped_at', { ascending: false });

      assert.equal(history.length, 2);
      assert.equal(history[0].flagged, true);
      assert.equal(history[0].price_cents, 160000);
      assert.equal(history[1].flagged, false);
    });

    it('advances product next_scrape_at based on scrape_interval_minutes', async () => {
      const product = fakeDb.seedProduct({
        store_product_id: '602',
        name: 'Interval Product',
        scrape_interval_minutes: 240 // 4 hours
      });

      const beforeScrape = Date.now();
      await scrapeProduct(product, { db: fakeDb, baseUrl: mockUrl, trigger: 'manual' });

      const updated = fakeDb.tables.tracked_products.get(product.id);
      assert.ok(updated.last_success_at);

      const nextScrapeMs = new Date(updated.next_scrape_at).getTime();
      const expectedDiffMs = 240 * 60 * 1000;
      const actualDiffMs = nextScrapeMs - beforeScrape;

      // Assert next_scrape_at was advanced by ~240 minutes (within 5 seconds tolerance)
      assert.ok(
        Math.abs(actualDiffMs - expectedDiffMs) < 5000,
        `Expected next_scrape_at advance by 240 mins, diff was ${actualDiffMs}`
      );
    });
  });
});
