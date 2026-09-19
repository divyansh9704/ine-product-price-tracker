// backend/test/integration/alerts-rpc.test.js
// Tests atomic RPC alert triggers: structure_changed, price_drop, back_in_stock, scrape_failing.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FakeDatabase } from '../../src/db/fake-db.js';

describe('Alerts Generation via Atomic RPCs', () => {
  let db;

  beforeEach(() => {
    db = new FakeDatabase();
  });

  it('generates price_drop alert when price decreases', async () => {
    const product = db.seedProduct({ store_product_id: '125', name: 'Test Product' });

    // Initial scrape at ₹1,500 (150,000 cents)
    await db.rpc('finalize_scrape_success', {
      p_scrape_log_id: 'log-1',
      p_product_id: product.id,
      p_price_cents: 150000,
      p_currency: 'INR',
      p_in_stock: true,
      p_stock_quantity: 10,
      p_flagged: false,
      p_attempts: 1,
      p_status: 'success',
      p_duration_ms: 120,
      p_http_status: 200,
      p_extracted: {}
    });

    // Check no alerts yet
    let { data: alerts } = await db.from('alerts').select('*').eq('product_id', product.id);
    assert.equal(alerts.length, 0);

    // Second scrape: price drops to ₹1,200 (120,000 cents)
    await db.rpc('finalize_scrape_success', {
      p_scrape_log_id: 'log-2',
      p_product_id: product.id,
      p_price_cents: 120000,
      p_currency: 'INR',
      p_in_stock: true,
      p_stock_quantity: 10,
      p_flagged: false,
      p_attempts: 1,
      p_status: 'success',
      p_duration_ms: 110,
      p_http_status: 200,
      p_extracted: {}
    });

    // Assert price_drop alert was created
    ({ data: alerts } = await db.from('alerts').select('*').eq('product_id', product.id));
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'price_drop');
    assert.match(alerts[0].message, /Price dropped from/);
  });

  it('generates back_in_stock alert when out-of-stock product returns to stock', async () => {
    const product = db.seedProduct({ store_product_id: '126', name: 'Back in Stock Product' });

    // Initial scrape: out of stock
    await db.rpc('finalize_scrape_success', {
      p_scrape_log_id: 'log-1',
      p_product_id: product.id,
      p_price_cents: 150000,
      p_currency: 'INR',
      p_in_stock: false,
      p_stock_quantity: 0,
      p_flagged: false,
      p_attempts: 1,
      p_status: 'success',
      p_duration_ms: 120,
      p_http_status: 200,
      p_extracted: {}
    });

    let { data: alerts } = await db.from('alerts').select('*').eq('product_id', product.id);
    assert.equal(alerts.length, 0);

    // Second scrape: back in stock!
    await db.rpc('finalize_scrape_success', {
      p_scrape_log_id: 'log-2',
      p_product_id: product.id,
      p_price_cents: 150000,
      p_currency: 'INR',
      p_in_stock: true,
      p_stock_quantity: 5,
      p_flagged: false,
      p_attempts: 1,
      p_status: 'success',
      p_duration_ms: 120,
      p_http_status: 200,
      p_extracted: {}
    });

    ({ data: alerts } = await db.from('alerts').select('*').eq('product_id', product.id));
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'back_in_stock');
    assert.equal(alerts[0].message, 'Product is back in stock!');
  });

  it('generates structure_changed alert on structural failure', async () => {
    const product = db.seedProduct({ store_product_id: '127', name: 'Structure Product' });

    await db.rpc('finalize_scrape_failure', {
      p_scrape_log_id: 'log-fail-1',
      p_product_id: product.id,
      p_attempts: 1,
      p_status: 'failed',
      p_duration_ms: 50,
      p_http_status: 401,
      p_error_type: 'STRUCTURE_CHANGED',
      p_error_message: 'Session handshake rejected by store',
      p_structure_changed: true,
      p_extracted: {}
    });

    const { data: alerts } = await db.from('alerts').select('*').eq('product_id', product.id);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'structure_changed');
    assert.equal(alerts[0].message, 'Session handshake rejected by store');
  });

  it('generates scrape_failing alert on 3 consecutive failed scrapes', async () => {
    const product = db.seedProduct({ store_product_id: '128', name: 'Persistent Failure Product' });

    // Failure 1
    await db.rpc('finalize_scrape_failure', {
      p_scrape_log_id: 'log-fail-1',
      p_product_id: product.id,
      p_attempts: 4,
      p_status: 'failed',
      p_duration_ms: 500,
      p_http_status: 503,
      p_error_type: 'HTTP_5XX',
      p_error_message: 'Service Unavailable',
      p_structure_changed: false,
      p_extracted: {}
    });

    let { data: alerts } = await db.from('alerts').select('*').eq('product_id', product.id);
    assert.equal(alerts.length, 0, 'No alert on 1st failure');

    // Failure 2
    await db.rpc('finalize_scrape_failure', {
      p_scrape_log_id: 'log-fail-2',
      p_product_id: product.id,
      p_attempts: 4,
      p_status: 'failed',
      p_duration_ms: 500,
      p_http_status: 503,
      p_error_type: 'HTTP_5XX',
      p_error_message: 'Service Unavailable',
      p_structure_changed: false,
      p_extracted: {}
    });

    ({ data: alerts } = await db.from('alerts').select('*').eq('product_id', product.id));
    assert.equal(alerts.length, 0, 'No alert on 2nd failure');

    // Failure 3
    await db.rpc('finalize_scrape_failure', {
      p_scrape_log_id: 'log-fail-3',
      p_product_id: product.id,
      p_attempts: 4,
      p_status: 'failed',
      p_duration_ms: 500,
      p_http_status: 503,
      p_error_type: 'HTTP_5XX',
      p_error_message: 'Service Unavailable',
      p_structure_changed: false,
      p_extracted: {}
    });

    ({ data: alerts } = await db.from('alerts').select('*').eq('product_id', product.id));
    assert.equal(alerts.length, 1, 'Alert triggered on 3rd consecutive failure');
    assert.equal(alerts[0].type, 'scrape_failing');
    assert.match(alerts[0].message, /failed 3 consecutive times/);
  });
});
