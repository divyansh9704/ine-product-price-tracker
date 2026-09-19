// backend/test/unit/validator.test.js
// Unit tests for data validation, edge cases, and volatility jump confirmation.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateQuoteBasic, validateWithJumpCheck } from '../../src/scraper/validator.js';
import { ERROR_TAXONOMY } from '../../src/scraper/constants.js';

describe('Scraper Validator - validateQuoteBasic', () => {
  it('accepts valid price and stock quote', () => {
    const quote = {
      priceCents: 147500,
      currency: 'INR',
      inStock: true,
      stockQuantity: 10,
      isPending: false,
      variant: 'clean'
    };
    const result = validateQuoteBasic(quote);
    assert.equal(result.valid, true);
  });

  it('rejects quote when priceCents is 0', () => {
    const quote = {
      priceCents: 0,
      currency: 'INR',
      inStock: true,
      isPending: false
    };
    const result = validateQuoteBasic(quote);
    assert.equal(result.valid, false);
    assert.equal(result.errorType, ERROR_TAXONOMY.VALIDATION_FAILED);
  });

  it('rejects quote when priceCents is negative', () => {
    const quote = {
      priceCents: -500,
      currency: 'INR',
      inStock: true,
      isPending: false
    };
    const result = validateQuoteBasic(quote);
    assert.equal(result.valid, false);
    assert.equal(result.errorType, ERROR_TAXONOMY.VALIDATION_FAILED);
  });

  it('rejects quote when priceCents is NaN', () => {
    const quote = {
      priceCents: NaN,
      currency: 'INR',
      inStock: true,
      isPending: false
    };
    const result = validateQuoteBasic(quote);
    assert.equal(result.valid, false);
    assert.equal(result.errorType, ERROR_TAXONOMY.VALIDATION_FAILED);
  });

  it('rejects quote when isPending is true (PLACEHOLDER_CONTENT)', () => {
    const quote = {
      priceCents: 150000,
      currency: 'INR',
      inStock: true,
      isPending: true,
      variant: 'stale'
    };
    const result = validateQuoteBasic(quote);
    assert.equal(result.valid, false);
    assert.equal(result.errorType, ERROR_TAXONOMY.PLACEHOLDER_CONTENT);
  });

  it('rejects quote when variant is "stale"', () => {
    const quote = {
      priceCents: 150000,
      currency: 'INR',
      inStock: true,
      isPending: false,
      variant: 'stale'
    };
    const result = validateQuoteBasic(quote);
    assert.equal(result.valid, false);
    assert.equal(result.errorType, ERROR_TAXONOMY.PLACEHOLDER_CONTENT);
  });

  it('rejects quote with missing or empty currency', () => {
    const quote = {
      priceCents: 150000,
      currency: '',
      inStock: true,
      isPending: false
    };
    const result = validateQuoteBasic(quote);
    assert.equal(result.valid, false);
    assert.equal(result.errorType, ERROR_TAXONOMY.VALIDATION_FAILED);
  });

  it('rejects null or non-object quote', () => {
    const result = validateQuoteBasic(null);
    assert.equal(result.valid, false);
    assert.equal(result.errorType, ERROR_TAXONOMY.STRUCTURE_CHANGED);
  });
});

describe('Scraper Validator - validateWithJumpCheck (Amendment 3)', () => {
  it('accepts normal price change without triggering confirmation re-fetch', async () => {
    const quote = {
      priceCents: 110000, // 10% change from 100000 (< 40% threshold)
      currency: 'INR',
      inStock: true,
      isPending: false
    };
    let refetchCalled = false;
    const refetchFn = async () => {
      refetchCalled = true;
      return quote;
    };

    const result = await validateWithJumpCheck(quote, 100000, refetchFn);
    assert.equal(result.valid, true);
    assert.equal(result.flagged, false);
    assert.equal(refetchCalled, false);
  });

  it('detects >= 40% jump and accepts with flagged=true when re-fetch agrees', async () => {
    const quote = {
      priceCents: 160000, // 60% jump from 100000 (>= 40% threshold)
      currency: 'INR',
      inStock: true,
      isPending: false
    };
    let refetchCalled = false;
    const refetchFn = async () => {
      refetchCalled = true;
      // Second fetch agrees (exact same price or within 5%)
      return {
        priceCents: 162000, // within 1.25% of 160000
        currency: 'INR',
        inStock: true,
        isPending: false
      };
    };

    const result = await validateWithJumpCheck(quote, 100000, refetchFn);
    assert.equal(refetchCalled, true);
    assert.equal(result.valid, true);
    assert.equal(result.flagged, true);
    assert.equal(result.quote.priceCents, 162000);
  });

  it('detects >= 40% jump and fails validation when re-fetch disagrees', async () => {
    const quote = {
      priceCents: 160000, // 60% jump from 100000
      currency: 'INR',
      inStock: true,
      isPending: false
    };
    let refetchCalled = false;
    const refetchFn = async () => {
      refetchCalled = true;
      // Second fetch drastically disagrees (e.g. 110000 instead of 160000)
      return {
        priceCents: 110000,
        currency: 'INR',
        inStock: true,
        isPending: false
      };
    };

    const result = await validateWithJumpCheck(quote, 100000, refetchFn);
    assert.equal(refetchCalled, true);
    assert.equal(result.valid, false);
    assert.equal(result.errorType, ERROR_TAXONOMY.VALIDATION_FAILED);
    assert.match(result.message, /divergence/i);
  });

  it('detects >= 40% jump and fails validation when re-fetch throws', async () => {
    const quote = {
      priceCents: 160000,
      currency: 'INR',
      inStock: true,
      isPending: false
    };
    const refetchFn = async () => {
      throw new Error('Network timeout during confirmation fetch');
    };

    const result = await validateWithJumpCheck(quote, 100000, refetchFn);
    assert.equal(result.valid, false);
    assert.equal(result.errorType, ERROR_TAXONOMY.VALIDATION_FAILED);
  });
});
