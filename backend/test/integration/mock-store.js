// backend/test/integration/mock-store.js
// Local HTTP mock server simulating the store's challenge handshake and fault conditions.

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SHARED_KEY } from '../../src/scraper/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load real challenge fixture for authentic Wasm module
const challengeFixturePath = path.join(__dirname, '../fixtures/challenge.json');
const challengeFixture = JSON.parse(fs.readFileSync(challengeFixturePath, 'utf8'));

export class MockStoreServer {
  constructor(port = 0) {
    this.port = port;
    this.server = null;
    this.faults = new Map(); // storeProductId -> { mode, count, current }
    this.activeTokens = new Map(); // token -> productId
    this.requestCounts = new Map(); // endpoint -> count
  }

  setFault(storeProductId, mode, count = 1, extra = {}) {
    this.faults.set(String(storeProductId), { mode, count, current: 0, ...extra });
  }

  clearFaults() {
    this.faults.clear();
    this.requestCounts.clear();
  }

  async start() {
    return new Promise((resolve) => {
      this.server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        this.requestCounts.set(pathname, (this.requestCounts.get(pathname) || 0) + 1);

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        // Endpoint: /api/challenge
        if (pathname === '/api/challenge' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            salt: crypto.randomBytes(16).toString('hex'),
            ts: Date.now(),
            difficulty: 2, // low difficulty for fast tests (< 1ms)
            csig: 'mock-csig-' + Date.now(),
            wasm: challengeFixture.wasm
          }));
          return;
        }

        // Endpoint: /api/session
        if (pathname === '/api/session' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const productId = data.productId;
              const fault = this.faults.get(String(productId));

              if (fault && fault.mode === 'session_401' && fault.current < fault.count) {
                fault.current++;
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'unauthorized', message: 'Session signature invalid' }));
                return;
              }

              const token = 'mock-token-' + crypto.randomUUID();
              this.activeTokens.set(token, String(productId));

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ token, expiresInMs: 30000 }));
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'invalid_payload' }));
            }
          });
          return;
        }

        // Endpoint: /api/products/:id/price
        const priceMatch = pathname.match(/^\/api\/products\/([^/]+)\/price$/);
        if (priceMatch && req.method === 'GET') {
          const storeProductId = priceMatch[1];
          const authHeader = req.headers['authorization'] || '';
          const token = authHeader.replace(/^Bearer\s+/i, '');

          // Check token validity
          if (!token || !this.activeTokens.has(token)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'unauthorized', message: 'Invalid or expired token' }));
            return;
          }

          const fault = this.faults.get(storeProductId);

          // Fault Injection: Slow response (Timeout)
          if (fault && fault.mode === 'slow') {
            setTimeout(() => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ e: 'slow' }));
            }, fault.delayMs || 3000);
            return;
          }

          // Fault Injection: 503 Upstream Error
          if (fault && fault.mode === '503' && fault.current < fault.count) {
            fault.current++;
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'upstream_error', message: 'Upstream price store down' }));
            return;
          }

          // Fault Injection: 429 Rate Limited
          if (fault && fault.mode === '429' && fault.current < fault.count) {
            fault.current++;
            res.writeHead(429, {
              'Content-Type': 'application/json',
              'Retry-After': '0.1'
            });
            res.end(JSON.stringify({ error: 'rate_limited' }));
            return;
          }

          // Fault Injection: Malformed / Empty response
          if (fault && fault.mode === 'empty' && fault.current < fault.count) {
            fault.current++;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('');
            return;
          }

          // Fault Injection: Structure Changed (missing price/stock)
          if (fault && fault.mode === 'structure_changed' && fault.current < fault.count) {
            fault.current++;
            const badObj = { someUnknownProp: 123 };
            const enc = this.encryptPayload(badObj, token);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ e: enc }));
            return;
          }

          // Fault Injection: Placeholder content (g: 1, v: 'stale')
          if (fault && fault.mode === 'placeholder' && fault.current < fault.count) {
            fault.current++;
            const placeholderObj = {
              p: 1499,
              s: 10,
              c: 'INR',
              g: 1,
              v: 'stale',
              t: Date.now()
            };
            const enc = this.encryptPayload(placeholderObj, token);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ e: enc }));
            return;
          }

          // Fault Injection: Volatility Jump Agreeing vs Disagreeing
          if (fault && fault.mode === 'jump_agree') {
            const jumpPrice = fault.jumpPrice || 1600; // 60% jump
            const enc = this.encryptPayload({
              p: jumpPrice,
              s: 15,
              c: 'INR',
              g: 0,
              v: 'clean',
              t: Date.now()
            }, token);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ e: enc }));
            return;
          }

          if (fault && fault.mode === 'jump_disagree') {
            fault.current++;
            // First fetch returns 1600, second fetch returns 1100 (divergence)
            const price = fault.current === 1 ? 1600 : 1100;
            const enc = this.encryptPayload({
              p: price,
              s: 15,
              c: 'INR',
              g: 0,
              v: 'clean',
              t: Date.now()
            }, token);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ e: enc }));
            return;
          }

          // Default: Successful Price Quote
          const normalPrice = (fault && fault.price) || 2499;
          const normalStock = (fault && fault.stock !== undefined) ? fault.stock : 25;
          const normalCurrency = (fault && fault.currency) || 'INR';

          const quoteObj = {
            p: normalPrice,
            m: normalPrice * 1.2,
            n: normalPrice * 1.05,
            b: 15,
            s: normalStock,
            c: normalCurrency,
            t: Date.now(),
            g: 0,
            v: 'clean',
            sl: 'Mock Depot',
            r: 4.5,
            rc: 120
          };

          const enc = this.encryptPayload(quoteObj, token);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ e: enc }));
          return;
        }

        // 404 for unknown endpoints
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not_found' }));
      });

      this.server.listen(this.port, () => {
        this.port = this.server.address().port;
        resolve(this.getUrl());
      });
    });
  }

  encryptPayload(obj, token) {
    const keyHash = crypto.createHash('sha256').update(`${SHARED_KEY}|enc|${token}`).digest();
    const plainBuffer = Buffer.from(JSON.stringify(obj), 'utf8');
    const cipherBuffer = Buffer.alloc(plainBuffer.length);
    for (let i = 0; i < plainBuffer.length; i++) {
      cipherBuffer[i] = plainBuffer[i] ^ keyHash[i % keyHash.length];
    }
    return cipherBuffer.toString('base64');
  }

  getUrl() {
    return `http://127.0.0.1:${this.port}`;
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

export default MockStoreServer;
