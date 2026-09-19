// backend/src/scraper/validator.js
// Validates scraped price and stock data before any database insert.
// Enforces: price > 0, non-placeholder, non-zero, currency integrity, and volatility jump confirmation.

import {
  ERROR_TAXONOMY,
  PRICE_JUMP_THRESHOLD,
  PRICE_AGREEMENT_TOLERANCE
} from './constants.js';

export function validateQuoteBasic(quote) {
  if (!quote || typeof quote !== 'object') {
    return {
      valid: false,
      errorType: ERROR_TAXONOMY.STRUCTURE_CHANGED,
      message: 'Quote object is null or missing'
    };
  }

  // Reject placeholder / pending / stale states
  if (quote.isPending === true || quote.variant === 'stale') {
    return {
      valid: false,
      errorType: ERROR_TAXONOMY.PLACEHOLDER_CONTENT,
      message: 'Price data is marked pending or stale by store'
    };
  }

  // Validate price cents is finite, positive integer
  if (
    typeof quote.priceCents !== 'number' ||
    !Number.isFinite(quote.priceCents) ||
    Number.isNaN(quote.priceCents) ||
    quote.priceCents <= 0
  ) {
    return {
      valid: false,
      errorType: ERROR_TAXONOMY.VALIDATION_FAILED,
      message: `Invalid price cents: ${quote.priceCents}. Price must be greater than 0.`
    };
  }

  // Validate currency code
  if (!quote.currency || typeof quote.currency !== 'string' || quote.currency.trim().length === 0) {
    return {
      valid: false,
      errorType: ERROR_TAXONOMY.VALIDATION_FAILED,
      message: 'Missing or empty currency code'
    };
  }

  // Validate stock fields
  if (typeof quote.inStock !== 'boolean') {
    return {
      valid: false,
      errorType: ERROR_TAXONOMY.VALIDATION_FAILED,
      message: 'inStock must be boolean'
    };
  }

  return { valid: true };
}

/**
 * Validates price volatility jumps (Amendment 3).
 * If price shifts by >= 40% from previous stored price, a single re-fetch is performed.
 * Two agreeing fetches (within 5%): accept with flagged = true.
 * Disagreeing fetches: reject with VALIDATION_FAILED, write nothing to price_history.
 */
export async function validateWithJumpCheck(quote, lastPriceCents, refetchFn) {
  // First run basic validation
  const basic = validateQuoteBasic(quote);
  if (!basic.valid) {
    return basic;
  }

  // If there is no previous price to compare against, no jump check is required
  if (!lastPriceCents || typeof lastPriceCents !== 'number' || lastPriceCents <= 0) {
    return { valid: true, flagged: false, quote };
  }

  const relativeShift = Math.abs(quote.priceCents - lastPriceCents) / lastPriceCents;

  // If shift is within normal expected discount/volatility bounds (< 40%)
  if (relativeShift < PRICE_JUMP_THRESHOLD) {
    return { valid: true, flagged: false, quote };
  }

  // Shift is >= 40%: Volatility jump detected, execute re-fetch once to confirm
  try {
    const secondQuote = await refetchFn();
    const secondBasic = validateQuoteBasic(secondQuote);
    if (!secondBasic.valid) {
      return {
        valid: false,
        errorType: ERROR_TAXONOMY.VALIDATION_FAILED,
        message: `Price jump confirmation fetch returned invalid data: ${secondBasic.message}`
      };
    }

    // Check agreement between first and second fetch
    const divergence = Math.abs(quote.priceCents - secondQuote.priceCents) / quote.priceCents;

    if (divergence <= PRICE_AGREEMENT_TOLERANCE) {
      // Two agreeing fetches: accept and flag
      return {
        valid: true,
        flagged: true,
        quote: secondQuote // Use the confirmed quote
      };
    }

    // Disagreeing fetches: status failed, error VALIDATION_FAILED, store nothing
    return {
      valid: false,
      errorType: ERROR_TAXONOMY.VALIDATION_FAILED,
      message: `Price jump confirmation failed. Fetch 1: ${quote.priceCents}, Fetch 2: ${secondQuote.priceCents} (divergence ${(divergence * 100).toFixed(1)}% > 5%)`
    };
  } catch (err) {
    return {
      valid: false,
      errorType: ERROR_TAXONOMY.VALIDATION_FAILED,
      message: `Price jump confirmation fetch failed: ${err.message}`
    };
  }
}

export default {
  validateQuoteBasic,
  validateWithJumpCheck
};
