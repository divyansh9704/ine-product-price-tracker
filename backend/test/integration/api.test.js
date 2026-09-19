// backend/test/integration/api.test.js
// Offline API integration tests for Express routes using FakeDatabase and ephemeral HTTP server.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { createFakeDatabase } from '../../src/db/fake-db.js';

describe('Express API Integration Tests', () => {
  let server;
  let baseUrl;
  let db;
  const cronSecret = 'test-cron-secret-12345';

  before(async () => {
    db = createFakeDatabase();
    const app = createApp({
      db,
      config: {
        cronSecret,
        frontendOrigin: 'http://localhost:5173'
      },
      scraperOptions: {
        // In API tests, use mock responses if scraper triggers
      }
    });

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Health Endpoint (GET /health)', () => {
    test('returns 200 OK with status and uptime', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'ok');
      assert.equal(data.service, 'product-price-tracker-backend');
      assert.equal(typeof data.uptime, 'number');
    });
  });

  describe('Product Tracking CRUD & Search Flow', () => {
    let createdProductId;

    test('POST /api/products validates scrapeIntervalMinutes is multiple of 120', async () => {
      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeProductId: 999,
          name: 'Invalid Interval Product',
          scrapeIntervalMinutes: 45 // Not multiple of 120
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'Validation failed');
    });

    test('POST /api/products successfully tracks a new product', async () => {
      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeProductId: 125,
          name: 'Copperpot Solar Charger Mini',
          category: 'Power',
          scrapeIntervalMinutes: 120
        })
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.ok(data.product);
      assert.equal(data.product.store_product_id, 125);
      assert.equal(data.product.name, 'Copperpot Solar Charger Mini');
      assert.equal(data.product.scrape_interval_minutes, 120);
      createdProductId = data.product.id;
    });

    test('POST /api/products rejects duplicate tracking of active product with 409 Conflict', async () => {
      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeProductId: 125,
          name: 'Copperpot Duplicate',
          scrapeIntervalMinutes: 120
        })
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.match(data.error, /already actively tracked/);
    });

    test('GET /api/products returns tracked product list', async () => {
      const res = await fetch(`${baseUrl}/api/products`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.products));
      assert.ok(data.products.length >= 1);
      const found = data.products.find(p => p.store_product_id === 125);
      assert.ok(found);
      assert.equal(found.name, 'Copperpot Solar Charger Mini');
    });

    test('GET /api/products/:id returns detailed product and statistics', async () => {
      // Seed two price_history points to test statistical calculation
      await db.from('price_history').insert([
        {
          product_id: createdProductId,
          price_cents: 120000,
          currency: 'INR',
          in_stock: true,
          stock_quantity: 40,
          flagged: false,
          scraped_at: new Date(Date.now() - 7200000).toISOString()
        },
        {
          product_id: createdProductId,
          price_cents: 140000,
          currency: 'INR',
          in_stock: true,
          stock_quantity: 35,
          flagged: false,
          scraped_at: new Date().toISOString()
        }
      ]);

      const res = await fetch(`${baseUrl}/api/products/${createdProductId}`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.product);
      assert.equal(data.product.id, createdProductId);

      // Verify computed stats
      assert.ok(data.stats);
      assert.equal(data.stats.minPrice, 1200);
      assert.equal(data.stats.maxPrice, 1400);
      assert.equal(data.stats.avgPrice, 1300);
      assert.equal(data.stats.currentPrice, 1400);
      assert.equal(data.stats.currency, 'INR');
      assert.equal(data.stats.dataPointsCount, 2);
    });

    test('PATCH /api/products/:id updates scrape interval', async () => {
      const res = await fetch(`${baseUrl}/api/products/${createdProductId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scrapeIntervalMinutes: 240
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.product.scrape_interval_minutes, 240);
    });

    test('GET /api/products/:id/history returns price time-series', async () => {
      const res = await fetch(`${baseUrl}/api/products/${createdProductId}/history`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.count, 2);
      assert.equal(data.history[0].price_cents, 120000);
      assert.equal(data.history[1].price_cents, 140000);
    });

    test('GET /api/products/:id/logs returns scrape log records', async () => {
      // Seed a scrape log row
      await db.from('scrape_log').insert({
        product_id: createdProductId,
        status: 'success',
        attempts: 1,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: 250,
        http_status: 200,
        structure_changed: false
      });

      const res = await fetch(`${baseUrl}/api/products/${createdProductId}/logs`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.logs.length >= 1);
      assert.equal(data.logs[0].status, 'success');
    });

    test('DELETE /api/products/:id removes tracked product', async () => {
      const res = await fetch(`${baseUrl}/api/products/${createdProductId}`, {
        method: 'DELETE'
      });
      assert.equal(res.status, 200);

      const check = await fetch(`${baseUrl}/api/products/${createdProductId}`);
      assert.equal(check.status, 404);
    });
  });

  describe('Scheduled Cron Endpoint (POST /api/cron/scrape)', () => {
    test('rejects request when x-cron-secret header is missing (401)', async () => {
      const res = await fetch(`${baseUrl}/api/cron/scrape`, {
        method: 'POST'
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.error, /Invalid or missing x-cron-secret/);
    });

    test('rejects request when x-cron-secret header is incorrect (401)', async () => {
      const res = await fetch(`${baseUrl}/api/cron/scrape`, {
        method: 'POST',
        headers: { 'x-cron-secret': 'wrong-secret' }
      });
      assert.equal(res.status, 401);
    });

    test('accepts request with valid x-cron-secret and returns 202 immediately', async () => {
      const res = await fetch(`${baseUrl}/api/cron/scrape`, {
        method: 'POST',
        headers: { 'x-cron-secret': cronSecret }
      });
      assert.equal(res.status, 202);
      const data = await res.json();
      assert.match(data.message, /queued/i);
    });
  });

  describe('Alerts Endpoints', () => {
    let alertId;

    before(async () => {
      const { data } = await db.from('alerts').insert({
        type: 'structure_changed',
        message: 'Test structure change alert',
        acknowledged: false
      }).select().single();
      alertId = data.id;
    });

    test('GET /api/alerts returns alerts list', async () => {
      const res = await fetch(`${baseUrl}/api/alerts?unacknowledged=true`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.alerts.length >= 1);
      assert.equal(data.alerts[0].type, 'structure_changed');
    });

    test('PATCH /api/alerts/:id/ack acknowledges the alert', async () => {
      const res = await fetch(`${baseUrl}/api/alerts/${alertId}/ack`, {
        method: 'PATCH'
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.alert.acknowledged, true);
      assert.ok(data.alert.acknowledged_at);
    });
  });
});
