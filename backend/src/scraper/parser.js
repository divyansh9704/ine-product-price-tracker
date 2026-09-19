// backend/src/scraper/parser.js
// Decrypts encrypted store payloads, parses JSON, and normalizes product pricing and stock fields.

import crypto from 'crypto';
import { SHARED_KEY, ERROR_TAXONOMY } from './constants.js';

export function decryptPayload(encBase64, token) {
  if (!encBase64 || typeof encBase64 !== 'string') {
    const err = new Error('Encrypted payload is empty or invalid format');
    err.errorType = ERROR_TAXONOMY.STRUCTURE_CHANGED;
    throw err;
  }

  try {
    const keyHash = crypto.createHash('sha256').update(`${SHARED_KEY}|enc|${token}`).digest();
    const cipherBytes = Buffer.from(encBase64, 'base64');
    const plainBytes = Buffer.alloc(cipherBytes.length);

    for (let i = 0; i < cipherBytes.length; i++) {
      plainBytes[i] = cipherBytes[i] ^ keyHash[i % keyHash.length];
    }

    const jsonString = plainBytes.toString('utf8');
    return JSON.parse(jsonString);
  } catch (err) {
    const parseErr = new Error(`Failed to decrypt and parse payload: ${err.message}`);
    parseErr.errorType = ERROR_TAXONOMY.STRUCTURE_CHANGED;
    throw parseErr;
  }
}

export function parsePriceQuote(rawQuote) {
  if (!rawQuote || typeof rawQuote !== 'object') {
    const err = new Error('Parsed quote is not a valid object');
    err.errorType = ERROR_TAXONOMY.STRUCTURE_CHANGED;
    throw err;
  }

  // Ensure required fields exist
  if (rawQuote.p === undefined || rawQuote.s === undefined) {
    const err = new Error('Missing required fields (p or s) in quote payload');
    err.errorType = ERROR_TAXONOMY.STRUCTURE_CHANGED;
    throw err;
  }

  const rawPrice = Number(rawQuote.p);
  const stockCount = Number(rawQuote.s);
  // Amendment 6: Currency is read directly from payload (do not hardcode or assume INR)
  const currency = typeof rawQuote.c === 'string' && rawQuote.c.trim() ? rawQuote.c.trim().toUpperCase() : 'INR';

  return {
    rawPrice,
    priceCents: Math.round(rawPrice * 100),
    currency,
    inStock: stockCount > 0,
    stockQuantity: !Number.isNaN(stockCount) && stockCount >= 0 ? stockCount : null,
    isPending: rawQuote.g === 1,
    mrp: rawQuote.m !== undefined ? Number(rawQuote.m) : null,
    salePrice: rawQuote.n !== undefined ? Number(rawQuote.n) : null,
    badgePct: rawQuote.b !== undefined ? Number(rawQuote.b) : null,
    variant: rawQuote.v || 'standard',
    seller: rawQuote.sl || null,
    rating: rawQuote.r !== undefined ? Number(rawQuote.r) : null,
    ratingCount: rawQuote.rc !== undefined ? Number(rawQuote.rc) : null,
    deliveryDays: rawQuote.dd !== undefined ? Number(rawQuote.dd) : null,
    quotedAt: rawQuote.t ? new Date(rawQuote.t).toISOString() : new Date().toISOString()
  };
}

export default {
  decryptPayload,
  parsePriceQuote
};
