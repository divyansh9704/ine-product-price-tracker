// backend/src/scraper/classify-error.js
// Maps errors, network failures, and HTTP status codes to the defined error taxonomy.

import { ERROR_TAXONOMY } from './constants.js';

export function classifyError(error, httpStatus = null) {
  // If an explicit error type is already attached, preserve it
  if (error?.errorType && ERROR_TAXONOMY[error.errorType]) {
    return error.errorType;
  }

  // HTTP status checks
  if (httpStatus) {
    if (httpStatus === 429) {
      return ERROR_TAXONOMY.RATE_LIMITED;
    }
    if (httpStatus === 408 || httpStatus === 504) {
      return ERROR_TAXONOMY.TIMEOUT;
    }
    if (httpStatus >= 500) {
      return ERROR_TAXONOMY.HTTP_5XX;
    }
    if (httpStatus >= 400 && httpStatus < 500) {
      return ERROR_TAXONOMY.HTTP_4XX;
    }
  }

  // Network or runtime exception checks
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    const name = String(error.name || '').toLowerCase();
    const code = String(error.code || '').toUpperCase();

    // Timeout detection (AbortController aborts, ECONNABORTED)
    if (name === 'aborterror' || msg.includes('timeout') || msg.includes('aborted') || code === 'ETIMEDOUT') {
      return ERROR_TAXONOMY.TIMEOUT;
    }

    // Network connection errors
    if (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ECONNRESET' ||
      code === 'EAI_AGAIN' ||
      msg.includes('fetch failed') ||
      msg.includes('network error')
    ) {
      return ERROR_TAXONOMY.NETWORK;
    }

    // Empty response payload
    if (msg.includes('empty response') || msg.includes('unexpected end of json')) {
      return ERROR_TAXONOMY.EMPTY_RESPONSE;
    }

    // Structural anomalies
    if (msg.includes('structure changed') || msg.includes('missing required fields') || msg.includes('invalid shape')) {
      return ERROR_TAXONOMY.STRUCTURE_CHANGED;
    }

    // Placeholder content
    if (msg.includes('placeholder') || msg.includes('stale') || msg.includes('updating')) {
      return ERROR_TAXONOMY.PLACEHOLDER_CONTENT;
    }

    // Validation failures
    if (msg.includes('validation') || msg.includes('invalid price') || msg.includes('disagreeing')) {
      return ERROR_TAXONOMY.VALIDATION_FAILED;
    }
  }

  // Default fallback to NETWORK if unclear
  return ERROR_TAXONOMY.NETWORK;
}

export default classifyError;
