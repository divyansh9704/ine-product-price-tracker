// backend/test/unit/retry.test.js
// Unit tests for retryability policy and exponential backoff calculations.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isRetryable, calculateBackoff, parseRetryAfter } from '../../src/scraper/retry.js';
import { ERROR_TAXONOMY, MAX_BACKOFF_MS } from '../../src/scraper/constants.js';

describe('Scraper Retry Policy - isRetryable', () => {
  it('returns true for retryable error types', () => {
    assert.equal(isRetryable(ERROR_TAXONOMY.TIMEOUT), true);
    assert.equal(isRetryable(ERROR_TAXONOMY.NETWORK), true);
    assert.equal(isRetryable(ERROR_TAXONOMY.HTTP_5XX), true);
    assert.equal(isRetryable(ERROR_TAXONOMY.RATE_LIMITED), true);
    assert.equal(isRetryable(ERROR_TAXONOMY.PLACEHOLDER_CONTENT), true);
    assert.equal(isRetryable(ERROR_TAXONOMY.EMPTY_RESPONSE), true);
  });

  it('returns false for non-retryable error types', () => {
    assert.equal(isRetryable(ERROR_TAXONOMY.HTTP_4XX), false);
    assert.equal(isRetryable(ERROR_TAXONOMY.STRUCTURE_CHANGED), false);
    assert.equal(isRetryable(ERROR_TAXONOMY.VALIDATION_FAILED), false);
  });

  it('returns true for 5xx and 429 status codes', () => {
    assert.equal(isRetryable(null, 500), true);
    assert.equal(isRetryable(null, 503), true);
    assert.equal(isRetryable(null, 429), true);
    assert.equal(isRetryable(null, 408), true);
  });

  it('returns false for 4xx status codes (like 400, 404)', () => {
    assert.equal(isRetryable(null, 400), false);
    assert.equal(isRetryable(null, 404), false);
  });
});

describe('Scraper Retry Policy - calculateBackoff & parseRetryAfter', () => {
  it('parses numeric Retry-After header in seconds', () => {
    assert.equal(parseRetryAfter('3'), 3000);
    assert.equal(parseRetryAfter('10'), 10000);
  });

  it('parses HTTP-date Retry-After header', () => {
    const futureDate = new Date(Date.now() + 5000).toUTCString();
    const parsed = parseRetryAfter(futureDate);
    assert.ok(parsed >= 4000 && parsed <= 6000);
  });

  it('honors Retry-After header in calculateBackoff', () => {
    const backoff = calculateBackoff(1, '4');
    assert.equal(backoff, 4000);
  });

  it('calculates exponential backoff with jitter within expected bounds', () => {
    // Attempt 1: 1000 * 2^0 = 1000 + jitter (0..500) -> 1000..1500
    const b1 = calculateBackoff(1);
    assert.ok(b1 >= 1000 && b1 <= 1500, `Expected 1000..1500, got ${b1}`);

    // Attempt 2: 1000 * 2^1 = 2000 + jitter (0..500) -> 2000..2500
    const b2 = calculateBackoff(2);
    assert.ok(b2 >= 2000 && b2 <= 2500, `Expected 2000..2500, got ${b2}`);

    // Attempt 3: 1000 * 2^2 = 4000 + jitter (0..500) -> 4000..4500
    const b3 = calculateBackoff(3);
    assert.ok(b3 >= 4000 && b3 <= 4500, `Expected 4000..4500, got ${b3}`);
  });

  it('caps backoff at MAX_BACKOFF_MS', () => {
    const b10 = calculateBackoff(10);
    assert.ok(b10 <= MAX_BACKOFF_MS);
  });
});
