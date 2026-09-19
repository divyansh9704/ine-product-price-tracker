// backend/src/scraper/fetcher.js
// Executes the cryptographic challenge protocol to retrieve encrypted price data from the store.

import crypto from 'crypto';
import {
  REQUEST_TIMEOUT_MS,
  USER_AGENT,
  SHARED_KEY,
  CLIENT_FINGERPRINT,
  ERROR_TAXONOMY
} from './constants.js';

// Helper: SHA-256 hex string
export function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// Seed generation for Wasm function
export function computeSeed(salt, attHash) {
  const hash = sha256(`${SHARED_KEY}|seed|${salt}|${attHash}`);
  return parseInt(hash.slice(0, 8), 16) | 0;
}

// Key derivation function
export function deriveKey(salt, wasmOut, attHash) {
  return sha256(`${SHARED_KEY}|derive|${salt}|${wasmOut | 0}|${attHash}`);
}

// Proof of work loop: finds nonce where sha256(salt + ':' + nonce) starts with '0' * difficulty
export function solveProofOfWork(salt, difficulty) {
  const targetPrefix = '0'.repeat(difficulty);
  let nonce = 0;
  while (true) {
    if (sha256(`${salt}:${nonce}`).slice(0, difficulty) === targetPrefix) {
      return nonce;
    }
    nonce++;
  }
}

// In-memory cache for compiled WebAssembly modules across scrapes
const wasmModuleCache = new Map();

export function clearWasmCache() {
  wasmModuleCache.clear();
}

// In-memory WebAssembly module compilation and execution with process-lifetime caching
export async function executeWasm(wasmBase64, seed) {
  let module = wasmModuleCache.get(wasmBase64);
  if (!module) {
    const buffer = Buffer.from(wasmBase64, 'base64');
    module = await WebAssembly.compile(buffer);
    wasmModuleCache.set(wasmBase64, module);
  }
  const instance = await WebAssembly.instantiate(module);
  if (!instance.exports || typeof instance.exports.f !== 'function') {
    const err = new Error('Wasm module does not export required function f');
    err.errorType = ERROR_TAXONOMY.STRUCTURE_CHANGED;
    throw err;
  }
  return instance.exports.f(seed) | 0;
}

// Assembles realistic client interaction attestation matching store requirements
export function buildAttestation() {
  const now = Date.now();
  const hoverAt = now - 1200;
  const moves = [];
  // Generate 12 realistic cursor moves with > 40ms separation
  for (let i = 0; i < 12; i++) {
    moves.push([500 + i * 8, 520 + (i % 3) * 6, hoverAt + i * 65]);
  }

  return {
    env: {
      canvas: CLIENT_FINGERPRINT.canvas,
      gl: CLIENT_FINGERPRINT.gl,
      hc: CLIENT_FINGERPRINT.hc,
      scr: [...CLIENT_FINGERPRINT.scr],
      frames: [...CLIENT_FINGERPRINT.frames],
      at: now
    },
    ix: {
      hoverAt,
      dwellMs: 1200,
      moves,
      clickAt: now,
      trusted: true
    }
  };
}

/**
 * Executes a single complete fetch handshake and price retrieval.
 * Supports injected fetch / baseUrl for testing.
 */
export async function fetchProductPriceDirect(productId, options = {}) {
  const baseUrl = options.baseUrl || 'https://demo.inelabteamdev.com';
  const customFetch = options.fetch || globalThis.fetch;
  const timeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Step 1: Fetch Challenge
    const challengeUrl = `${baseUrl}/api/challenge`;
    const chRes = await customFetch(challengeUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    if (!chRes.ok) {
      const err = new Error(`Challenge endpoint returned HTTP ${chRes.status}`);
      err.httpStatus = chRes.status;
      throw err;
    }

    const chData = await chRes.json();
    if (!chData || !chData.salt || chData.difficulty === undefined || !chData.wasm) {
      const err = new Error('Challenge payload missing required structure (salt, difficulty, wasm)');
      err.errorType = ERROR_TAXONOMY.STRUCTURE_CHANGED;
      throw err;
    }

    // Step 2: Solve client challenge
    const attObj = buildAttestation();
    const attStr = JSON.stringify(attObj);
    const attHash = sha256(attStr);

    const seed = computeSeed(chData.salt, attHash);
    const wasmOut = await executeWasm(chData.wasm, seed);
    const nonce = solveProofOfWork(chData.salt, chData.difficulty);
    const derived = deriveKey(chData.salt, wasmOut, attHash);

    const sessionPayload = {
      ...chData,
      nonce,
      derived,
      wasmOut,
      att: attStr,
      productId: Number(productId)
    };

    // Step 3: Redeem session token
    const sessionUrl = `${baseUrl}/api/session`;
    const sessRes = await customFetch(sessionUrl, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(sessionPayload),
      signal: controller.signal
    });

    if (!sessRes.ok) {
      const sessText = await sessRes.text().catch(() => '');
      let parsedBody = null;
      try { parsedBody = JSON.parse(sessText); } catch {}

      const err = new Error(`Session handshake rejected by store (HTTP ${sessRes.status}): ${sessText}`);
      err.httpStatus = sessRes.status;

      if (sessRes.status === 429) {
        err.errorType = ERROR_TAXONOMY.RATE_LIMITED;
        const retryHeader = sessRes.headers?.get ? sessRes.headers.get('retry-after') : null;
        err.retryAfter = retryHeader || (parsedBody?.retryAfter ? String(parsedBody.retryAfter) : '2');
      } else if (sessRes.status >= 500) {
        err.errorType = ERROR_TAXONOMY.HTTP_5XX;
      } else {
        // Requirement 4: If the store rejects handshake or attestation (e.g. 400, 401, 403),
        // do not retry endlessly. Classify it as STRUCTURE_CHANGED, log it, create an alert, and store nothing.
        err.errorType = ERROR_TAXONOMY.STRUCTURE_CHANGED;
      }
      throw err;
    }

    const sessData = await sessRes.json();
    if (!sessData || !sessData.token) {
      const err = new Error('Session response missing token property');
      err.errorType = ERROR_TAXONOMY.STRUCTURE_CHANGED;
      throw err;
    }

    const token = sessData.token;

    // Step 4: Fetch encrypted price
    const priceUrl = `${baseUrl}/api/products/${productId}/price`;
    const priceRes = await customFetch(priceUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    const durationMs = Date.now() - startTime;

    if (!priceRes.ok) {
      const errText = await priceRes.text().catch(() => '');
      const err = new Error(`Price endpoint returned HTTP ${priceRes.status}: ${errText}`);
      err.httpStatus = priceRes.status;
      err.retryAfter = priceRes.headers?.get ? priceRes.headers.get('retry-after') : null;
      if (priceRes.status === 401 || priceRes.status === 403) {
        err.isSessionError = true;
      }
      throw err;
    }

    const priceJson = await priceRes.json();
    if (!priceJson || typeof priceJson.e !== 'string') {
      const err = new Error('Price response missing encrypted "e" property');
      err.errorType = ERROR_TAXONOMY.STRUCTURE_CHANGED;
      throw err;
    }

    return {
      rawJson: priceJson,
      token,
      durationMs,
      httpStatus: priceRes.status
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default {
  sha256,
  computeSeed,
  deriveKey,
  solveProofOfWork,
  executeWasm,
  buildAttestation,
  fetchProductPriceDirect
};
