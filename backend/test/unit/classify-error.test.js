// backend/test/unit/classify-error.test.js
// Unit tests for the 9-type error taxonomy.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyError } from '../../src/scraper/classify-error.js';
import { ERROR_TAXONOMY } from '../../src/scraper/constants.js';

describe('Scraper Error Classifier', () => {
  it('classifies HTTP 429 as RATE_LIMITED', () => {
    const type = classifyError(new Error('Too Many Requests'), 429);
    assert.equal(type, ERROR_TAXONOMY.RATE_LIMITED);
  });

  it('classifies HTTP 408 and 504 as TIMEOUT', () => {
    assert.equal(classifyError(null, 408), ERROR_TAXONOMY.TIMEOUT);
    assert.equal(classifyError(null, 504), ERROR_TAXONOMY.TIMEOUT);
  });

  it('classifies HTTP 500, 502, 503 as HTTP_5XX', () => {
    assert.equal(classifyError(null, 500), ERROR_TAXONOMY.HTTP_5XX);
    assert.equal(classifyError(null, 502), ERROR_TAXONOMY.HTTP_5XX);
    assert.equal(classifyError(null, 503), ERROR_TAXONOMY.HTTP_5XX);
  });

  it('classifies HTTP 400, 404 as HTTP_4XX', () => {
    assert.equal(classifyError(null, 400), ERROR_TAXONOMY.HTTP_4XX);
    assert.equal(classifyError(null, 404), ERROR_TAXONOMY.HTTP_4XX);
  });

  it('classifies AbortError and timeout exceptions as TIMEOUT', () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    assert.equal(classifyError(abortErr), ERROR_TAXONOMY.TIMEOUT);

    const timeoutErr = new Error('connect ETIMEDOUT');
    timeoutErr.code = 'ETIMEDOUT';
    assert.equal(classifyError(timeoutErr), ERROR_TAXONOMY.TIMEOUT);
  });

  it('classifies connection failures as NETWORK', () => {
    const connErr = new Error('fetch failed');
    connErr.code = 'ECONNREFUSED';
    assert.equal(classifyError(connErr), ERROR_TAXONOMY.NETWORK);

    const dnsErr = new Error('getaddrinfo ENOTFOUND');
    dnsErr.code = 'ENOTFOUND';
    assert.equal(classifyError(dnsErr), ERROR_TAXONOMY.NETWORK);
  });

  it('classifies placeholder and stale messages as PLACEHOLDER_CONTENT', () => {
    const err = new Error('Price is marked placeholder by store');
    assert.equal(classifyError(err), ERROR_TAXONOMY.PLACEHOLDER_CONTENT);
  });

  it('classifies empty payloads as EMPTY_RESPONSE', () => {
    const err = new Error('Empty response received');
    assert.equal(classifyError(err), ERROR_TAXONOMY.EMPTY_RESPONSE);
  });

  it('classifies structural alterations as STRUCTURE_CHANGED', () => {
    const err = new Error('Structure changed: missing required fields');
    assert.equal(classifyError(err), ERROR_TAXONOMY.STRUCTURE_CHANGED);
  });

  it('classifies validation failures as VALIDATION_FAILED', () => {
    const err = new Error('Price validation failed: price must be > 0');
    assert.equal(classifyError(err), ERROR_TAXONOMY.VALIDATION_FAILED);
  });

  it('preserves pre-tagged errorType property', () => {
    const err = new Error('Custom failure');
    err.errorType = ERROR_TAXONOMY.STRUCTURE_CHANGED;
    assert.equal(classifyError(err), ERROR_TAXONOMY.STRUCTURE_CHANGED);
  });
});
