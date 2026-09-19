// backend/test/unit/parser.test.js
// Unit tests for decryption, quote normalization, and currency handling.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { decryptPayload, parsePriceQuote } from '../../src/scraper/parser.js';
import { SHARED_KEY, ERROR_TAXONOMY } from '../../src/scraper/constants.js';

describe('Scraper Parser - decryptPayload', () => {
  it('correctly decrypts an XOR encrypted payload with valid token', () => {
    const token = 'test-token-12345';
    const payloadObj = {
      p: 2499,
      m: 2999,
      n: 2699,
      b: 15,
      s: 12,
      c: 'INR',
      t: Date.now(),
      v: 'clean',
      g: 0
    };

    // Encrypt payload using the exact store encryption scheme
    const keyHash = crypto.createHash('sha256').update(`${SHARED_KEY}|enc|${token}`).digest();
    const plainBuffer = Buffer.from(JSON.stringify(payloadObj), 'utf8');
    const cipherBuffer = Buffer.alloc(plainBuffer.length);
    for (let i = 0; i < plainBuffer.length; i++) {
      cipherBuffer[i] = plainBuffer[i] ^ keyHash[i % keyHash.length];
    }
    const cipherBase64 = cipherBuffer.toString('base64');

    const decrypted = decryptPayload(cipherBase64, token);
    assert.deepEqual(decrypted, payloadObj);
  });

  it('throws STRUCTURE_CHANGED when encrypted string is empty or invalid', () => {
    assert.throws(
      () => decryptPayload('', 'token'),
      err => err.errorType === ERROR_TAXONOMY.STRUCTURE_CHANGED
    );
  });

  it('throws STRUCTURE_CHANGED when decryption produces invalid JSON', () => {
    assert.throws(
      () => decryptPayload('not-valid-base64-json', 'wrong-token'),
      err => err.errorType === ERROR_TAXONOMY.STRUCTURE_CHANGED
    );
  });
});

describe('Scraper Parser - parsePriceQuote (Amendment 6: dynamic currency)', () => {
  it('normalizes pricing, stock, and reads dynamic currency code', () => {
    const rawQuote = {
      p: 1475.5,
      s: 20,
      c: 'EUR',
      m: 1999,
      n: 1699,
      b: 25,
      g: 0,
      v: 'clean',
      sl: 'Nordic Direct',
      r: 4.8,
      rc: 520
    };

    const parsed = parsePriceQuote(rawQuote);
    assert.equal(parsed.rawPrice, 1475.5);
    assert.equal(parsed.priceCents, 147550);
    assert.equal(parsed.currency, 'EUR'); // Amendment 6: verifies dynamic currency
    assert.equal(parsed.inStock, true);
    assert.equal(parsed.stockQuantity, 20);
    assert.equal(parsed.isPending, false);
    assert.equal(parsed.mrp, 1999);
    assert.equal(parsed.badgePct, 25);
    assert.equal(parsed.seller, 'Nordic Direct');
  });

  it('normalizes out-of-stock product when stock is 0', () => {
    const rawQuote = {
      p: 999,
      s: 0,
      c: 'USD',
      g: 0
    };

    const parsed = parsePriceQuote(rawQuote);
    assert.equal(parsed.priceCents, 99900);
    assert.equal(parsed.currency, 'USD');
    assert.equal(parsed.inStock, false);
    assert.equal(parsed.stockQuantity, 0);
  });

  it('throws STRUCTURE_CHANGED when required fields (p or s) are missing', () => {
    assert.throws(
      () => parsePriceQuote({ s: 10 }), // missing p
      err => err.errorType === ERROR_TAXONOMY.STRUCTURE_CHANGED
    );

    assert.throws(
      () => parsePriceQuote({ p: 100 }), // missing s
      err => err.errorType === ERROR_TAXONOMY.STRUCTURE_CHANGED
    );
  });
});
