# Local Verification Guide

This guide provides the exact commands to test and verify every part of the **Product Price Tracker** locally, including the scraper reliability suite, mock server integration, and API endpoints.

---

## 1. Prerequisites
- **Node.js**: Version `>= 20.0.0` (`node -v`)
- **npm**: Version `>= 10.0.0` (`npm -v`)

---

## 2. Running Automated Tests (Offline & Deterministic)

All automated unit and integration tests run against an **in-memory fake database layer** and local mock HTTP server. No external network access or real Supabase credentials are required to verify the complete reliability core.

```bash
# Navigate to the backend directory
cd backend

# Run the complete test suite (Unit + Integration: 53 tests, 14 suites)
npm test

# Run unit tests only (Validator, Parser, Error Classifier, Retry Policy)
npm run test:unit

# Run integration tests only (Fault injection, Concurrency, Atomic RPC, Idempotency)
npm run test:integration
```

### Expected Output Summary:
```text
# tests 53
# suites 14
# pass 53
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

---

## 3. What the Test Suite Verifies (Core Assignment Invariants)

1. **Assertion (a): Zero `price_history` rows on failure**
   - Verified against persistent 503 upstream errors, structural corruptions, and diverged volatility jumps.
2. **Assertion (b): `scrape_log` audit row is always created**
   - Verified that every attempt records timestamp, status, attempts count, duration, and error type.
3. **Assertion (c): Correct status semantics**
   - `success`: first attempt succeeded.
   - `retried`: succeeded after transient 503, 429 rate limit, or placeholder (`g: 1`) content.
   - `failed`: exhausted all 4 attempts.
4. **Assertion (d): Multi-product isolation**
   - When scraping multiple products with concurrency of 3, a failure on one product never stops or blocks the others.
5. **Assertion (e): Cron idempotency**
   - Duplicate cron triggers within 20 minutes of a recent success skip without creating duplicate rows.
6. **Amendment 2: Atomic transaction writes**
   - Atomic RPC function `finalize_scrape_success` updates `scrape_log`, inserts `price_history`, and advances `next_scrape_at` in one transaction.
7. **Amendment 3: Volatility jump confirmation**
   - Price jump $\ge 40\%$ triggers immediate re-fetch. If confirmed, `flagged = true`. If diverged, fails with `VALIDATION_FAILED` and writes nothing.

---

## 4. Testing the Production Build Locally

### Backend Production Build
```bash
cd backend
# Verify production startup
NODE_ENV=production npm start
```

### Frontend Production Build (Phase 4)
```bash
cd frontend
# Verify production Vite bundle
npm run build
npm run preview
```

---

## 5. Simulating the Cron Endpoint with `curl` (Phase 3+)

Once the Express API is running on `http://localhost:3000`:

### Test 1: Wrong or Missing Cron Secret (Must return HTTP 401)
```bash
curl -i -X POST http://localhost:3000/api/cron/scrape \
  -H "x-cron-secret: wrong-secret"
```
**Expected Response**:
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"error":"unauthorized","message":"Invalid or missing cron secret"}
```

### Test 2: Correct Cron Secret (Must return HTTP 202 Immediately)
```bash
curl -i -X POST http://localhost:3000/api/cron/scrape \
  -H "x-cron-secret: local-dev-cron-secret-change-in-production"
```
**Expected Response**:
```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{"status":"accepted","message":"Scheduled scrape run initiated"}
```

### Test 3: Duplicate Cron Call Within Idempotency Window
Triggering the cron endpoint immediately a second time will execute the idempotency guard:
```bash
curl -i -X POST http://localhost:3000/api/cron/scrape \
  -H "x-cron-secret: local-dev-cron-secret-change-in-production"
```
**Expected Result**:
Products successfully scraped in the first call have their `next_scrape_at` advanced by 120 minutes and are skipped on the second run, creating **zero duplicate rows** in `price_history`.
