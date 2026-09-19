// backend/src/scraper/retry.js
// Exponential backoff calculation with jitter and retryability classification.

import {
  ERROR_TAXONOMY,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS
} from './constants.js';

export function isRetryable(errorType, httpStatus = null) {
  // Explicitly retryable error categories
  const retryableTypes = new Set([
    ERROR_TAXONOMY.TIMEOUT,
    ERROR_TAXONOMY.NETWORK,
    ERROR_TAXONOMY.HTTP_5XX,
    ERROR_TAXONOMY.RATE_LIMITED,
    ERROR_TAXONOMY.PLACEHOLDER_CONTENT,
    ERROR_TAXONOMY.EMPTY_RESPONSE
  ]);

  if (retryableTypes.has(errorType)) {
    return true;
  }

  // 429 and 408 are retryable HTTP codes
  if (httpStatus === 429 || httpStatus === 408 || httpStatus === 504) {
    return true;
  }

  // 5xx errors are retryable
  if (httpStatus && httpStatus >= 500 && httpStatus <= 599) {
    return true;
  }

  // Non-retryable: HTTP_4XX (except 429/408), STRUCTURE_CHANGED, VALIDATION_FAILED
  return false;
}

export function parseRetryAfter(retryAfterHeader) {
  if (!retryAfterHeader) return null;

  // Check if it is a number of seconds
  const seconds = Number(retryAfterHeader);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  // Check if it is an HTTP-date format (e.g., Wed, 21 Oct 2026 07:28:00 GMT)
  const dateMs = Date.parse(retryAfterHeader);
  if (!Number.isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : 0;
  }

  return null;
}

export function calculateBackoff(attempt, retryAfterHeader = null) {
  // If upstream specified a Retry-After header, honor it
  const parsedHeader = parseRetryAfter(retryAfterHeader);
  if (parsedHeader !== null) {
    return Math.min(Math.max(parsedHeader, 500), MAX_BACKOFF_MS);
  }

  // Exponential backoff: ~1s, 2s, 4s...
  const exponential = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempt - 1));

  // Add random jitter between 0 and 500ms to avoid thundering herds
  const jitter = Math.floor(Math.random() * 500);

  const total = exponential + jitter;
  return Math.min(Math.max(total, 500), MAX_BACKOFF_MS);
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  isRetryable,
  calculateBackoff,
  parseRetryAfter,
  sleep
};
