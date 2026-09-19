# Local Verification & Testing Guide

This guide provides the exact commands to test and verify every part of the **Product Price Tracker** locally, including the scraper reliability test suite, API endpoints, single scrape CLI, headed Playwright observation, and frontend production builds.

---

## 1. Prerequisites

- **Node.js**: Version `>= 20.0.0` (`node -v`)
- **npm**: Version `>= 10.0.0` (`npm -v`)
- **Google Chrome**: Recommended for headed Playwright observation (`channel: chrome`)

---

## 2. Running Automated Tests (100% Offline & Deterministic)

All automated unit and integration tests run against an **in-memory fake database layer** and local mock HTTP server. Zero external network access or Supabase credentials are required.

```bash
# Navigate to the backend directory
cd backend

# Run the complete test suite (Unit + Integration: 72 tests, 20 suites)
npm test

# Run unit tests only (Validator, Parser, Error Classifier, Retry Policy)
npm run test:unit

# Run integration tests only (Fault injection, Concurrency, Atomic RPC, Alerts, Idempotency, Express API)
npm run test:integration

# Run automated browser click-through audit (Playwright against FakeDatabase)
npm run test:e2e
```

### Expected Output Summary:
```text
# tests 72
# suites 20
# pass 72
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

---

## 3. Real Supabase Smoke Verification (`npm run smoke:db`)

Runs live atomic write verification against your **real Supabase PostgreSQL instance** specified in `backend/.env`:
- **Prerequisite**: Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`. (If credentials are missing or unconfigured, the script gracefully halts with instructions).
- **Execution**:
  ```bash
  cd backend
  npm run smoke:db
  ```
- **What it tests**:
  1. Creates temporary record in `tracked_products`.
  2. Executes successful live scrape, asserting exactly 1 `scrape_log` and 1 `price_history` row.
  3. Forces a failure (unreachable host), asserting exactly 1 failed `scrape_log` row and ZERO new `price_history` rows.
  4. Cleans up all test rows from `tracked_products` (cascading to history and logs).
  5. Prints PASS/FAIL per assertion.

---

## 4. Automated End-to-End Browser Audit (`npm run test:e2e`)

Automates a full browser click-through verifying all frontend flows against the backend Express server:
- **Database Engine**: Explicitly boots with the **In-Memory FakeDatabase** layer, making the browser test 100% self-contained, deterministic, and runnable offline without needing external database credentials.
- **Execution**:
  ```bash
  cd backend
  npm run test:e2e
  ```
- **Flows audited**: Dashboard empty state -> Track modal -> Store catalog search -> Frequency selection (240m) -> Tracking creation -> Detail page navigation -> Recharts time-series chart -> Scrape log table -> Manual "Scrape Now" -> Back to Dashboard -> Search filter.
- **Assertions**: 14 automated assertions checking for 0 console errors, 0 uncaught exceptions, and 0 HTTP failures.

---

## 3. Single Scrape CLI (`scrape:once`)

Runs one full scrape using the production direct protocol client and prints the outcome and audit log row:

```bash
cd backend

# Dry-run scrape of product 125 (no database writes)
npm run scrape:once -- --product 125 --dry-run

# Scrape with actual database write
npm run scrape:once -- --product 125
```

### Expected Output:
```text
====================================================
                 SCRAPE RESULT                      
====================================================
Product ID:       ...
Store Product ID: 125
Product Name:     Copperpot Solar Charger Mini
Status:           SUCCESS / RETRIED
Attempts Used:    1
Duration:         185 ms
Price:            ₹1279.00
Stock Status:     IN STOCK
----------------------------------------------------
                 AUDIT SCRAPE LOG ROW               
----------------------------------------------------
{
  "product_id": "...",
  "status": "success",
  "attempts": 1,
  "duration_ms": 185,
  "http_status": 200,
  "structure_changed": false
}
====================================================
```

---

## 4. Headed Observable Mode with Playwright (`scrape:headed`)

Launches a visible Chromium browser, dismisses cookie overlays, simulates cursor movements with dwell time, intercepts the network handshake, extracts the DOM price, and cross-checks against the decrypted protocol:

```bash
cd backend

# Run visible headed scrape (350ms slowMo delay)
npm run scrape:headed -- --product 125 --dry-run

# Run with simulated 503 network error to observe fault handling
npm run scrape:headed -- --product 125 --dry-run --inject-fault=error

# Run with simulated high network latency
npm run scrape:headed -- --product 125 --dry-run --inject-fault=slow
```

---

## 5. Starting the Local Servers

### Step A: Start the Express Backend
```bash
cd backend
npm run dev
# Listens on http://localhost:3000
```

### Step B: Start the React Frontend
```bash
cd frontend
npm run dev
# Opens on http://localhost:5173
```

---

## 6. Testing Endpoints with `curl`

### 1. Health Check
```bash
curl -i http://localhost:3000/health
```
**Expected Response**: `HTTP/1.1 200 OK` with JSON `{ "status": "ok", "service": "product-price-tracker-backend", ... }`.

### 2. Store Catalog Search
```bash
curl -i "http://localhost:3000/api/store/search?q=125"
```
**Expected Response**: `HTTP/1.1 200 OK` with JSON array containing product details.

### 3. Simulating Scheduled Cron: Reject Wrong Secret
```bash
curl -i -X POST http://localhost:3000/api/cron/scrape \
  -H "x-cron-secret: wrong-secret"
```
**Expected Response**: `HTTP/1.1 401 Unauthorized` with JSON `{ "error": "Unauthorized: Invalid or missing x-cron-secret header" }`.

### 4. Simulating Scheduled Cron: Accept Valid Secret
```bash
curl -i -X POST http://localhost:3000/api/cron/scrape \
  -H "x-cron-secret: local-dev-cron-secret-change-in-production"
```
**Expected Response**: `HTTP/1.1 202 Accepted` with JSON `{ "message": "Scrape run queued successfully", ... }`.

---

## 7. Verifying Production Builds

### Backend Production Startup
```bash
cd backend
NODE_ENV=production npm start
```

### Frontend Production Build
```bash
cd frontend
npm run build
npm run preview
```
