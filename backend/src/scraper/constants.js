// backend/src/scraper/constants.js
// Constants, error taxonomy, timeouts, and thresholds for scraper reliability.

export const ERROR_TAXONOMY = Object.freeze({
  TIMEOUT: 'TIMEOUT',
  NETWORK: 'NETWORK',
  HTTP_5XX: 'HTTP_5XX',
  HTTP_4XX: 'HTTP_4XX',
  RATE_LIMITED: 'RATE_LIMITED',
  PLACEHOLDER_CONTENT: 'PLACEHOLDER_CONTENT',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  STRUCTURE_CHANGED: 'STRUCTURE_CHANGED',
  VALIDATION_FAILED: 'VALIDATION_FAILED'
});

// Hard request timeout via AbortController
export const REQUEST_TIMEOUT_MS = 10000;

// Scraper retry policy
export const MAX_ATTEMPTS = 4;
export const BASE_BACKOFF_MS = 1000;
export const MAX_BACKOFF_MS = 15000;

// Polite User-Agent identifying our service
export const USER_AGENT = 'ProductPriceTracker/1.0 (reliability-bot; +contact: admin@example.com)';

// Cryptographic parameters matching the mock store challenge protocol
export const SHARED_KEY = 'ine-mock-store-shared-k3y';

// Authentic browser fingerprint hashes discovered during Phase 0 CDP recon
export const CLIENT_FINGERPRINT = Object.freeze({
  canvas: 'b93ad65b96d012a5',
  gl: 'bb3723445bc1f3b4',
  hc: 4,
  scr: [800, 600, 1],
  frames: [16.67, 16.66, 16.68, 16.65, 16.67, 16.66, 16.68, 16.67]
});

// Amendment 3: Volatility jump threshold
// During recon, normal discount fluctuations ranged from 8% to 58%, and price formula multiplier ranged 0.6x - 1.3x.
// Any sudden shift >= 40% (0.40) triggers an immediate re-fetch to confirm agreement before accepting.
export const PRICE_JUMP_THRESHOLD = 0.40;

// Minimum agreeing fetch tolerance (within 5% considered agreeing price)
export const PRICE_AGREEMENT_TOLERANCE = 0.05;

// Idempotency threshold: skip duplicate cron triggers if succeeded within 20 minutes
export const IDEMPOTENCY_WINDOW_MS = 20 * 60 * 1000;

// Max concurrency for multi-product scraping
export const CONCURRENCY_LIMIT = 3;

// Stale run lock expiration (10 minutes)
export const STALE_RUN_LOCK_MS = 10 * 60 * 1000;
