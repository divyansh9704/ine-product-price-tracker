# 🎯 INE Technical Interview Preparation & Live Modification Guide

> **Note**: Page 1 of the assignment specification explicitly states:  
> *"You may be asked to modify your submitted code live during a video interview."*  
> This guide is designed to make you 100% prepared, articulate, and confident to answer any architectural question and implement any live code modification in under 60 seconds.

---

## 1. The Evaluator's Mindset (What They Care About Most)

The assignment prompt specifically says:
> *"The store is deliberately awkward to scrape, and getting the scraping to work reliably is the heart of this assignment, not the interface around it. What matters is that the scraper keeps working correctly over many unattended runs."*

When the interviewers (Stephen & Singh) review your submission, they are looking for **engineering maturity**:
1. **Did you understand the anti-scraping traps?** (Cookie overlays, dwell times, DOM decoy prices with `\u200B` zero-width spaces, Wasm puzzles).
2. **Did you make sensible production decisions?** (Running headless Chrome on Render's 512 MB free tier will crash with OOM errors; pure Node direct protocol runs in 38–70 MB RSS).
3. **Is your database clean?** (Zero wrong/placeholder data stored on failure; atomic commits so history and logs never desynchronize).
4. **Did you honestly record failures?** (Failures are explicitly classified and never hidden).

---

## 2. Fast File Map (Where Everything Lives)

| Feature / Responsibility | File Location | Key Symbol / Function |
|---|---|---|
| **Cryptographic Handshake** | [`backend/src/scraper/fetcher.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/scraper/fetcher.js) | `fetchProductPriceDirect()`, `solvePoW()`, `runWasmSeed()` |
| **XOR Payload Decryption** | [`backend/src/scraper/parser.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/scraper/parser.js) | `decryptPayload()`, `parsePriceQuote()` |
| **40% Volatility Jump Check** | [`backend/src/scraper/validator.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/scraper/validator.js) | `validateWithJumpCheck()`, `validateQuoteBasic()` |
| **Error Taxonomy Classifier** | [`backend/src/scraper/classify-error.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/scraper/classify-error.js) | `classifyError()` |
| **Exponential Backoff & Jitter**| [`backend/src/scraper/retry.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/scraper/retry.js) | `calculateBackoff()`, `isRetryable()` |
| **Single Product Scraper Orchestrator** | [`backend/src/scraper/scrape-product.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/scraper/scrape-product.js) | `scrapeProduct()` |
| **Batch Runner & Concurrency** | [`backend/src/scraper/run-manager.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/scraper/run-manager.js) | `executeBatchRun()`, `acquireRunLock()` |
| **Atomic Database Transactions** | [`supabase/schema.sql`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/supabase/schema.sql) | `record_scrape_outcome()` RPC |
| **Observable Headed Runner** | [`backend/src/cli/headed-scrape.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/cli/headed-scrape.js) | Playwright Chromium interaction & cross-check |
| **Express Application & Routes** | [`backend/src/app.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/app.js) | `createApp()` |
| **Frontend Dashboard & KPIs** | [`frontend/src/pages/DashboardPage.jsx`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/frontend/src/pages/DashboardPage.jsx) | `DashboardPage` |
| **Frontend Charts & Audit Logs**| [`frontend/src/pages/ProductDetailPage.jsx`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/frontend/src/pages/ProductDetailPage.jsx) | `ProductDetailPage` |

---

## 3. Top 7 Live Coding Modifications & How to Do Them Instantly

### Challenge 1: "Change the volatility jump threshold from 40% to 25%"
**Where**: [`backend/src/scraper/constants.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/scraper/constants.js)
```javascript
// Line 11: Change 0.40 to 0.25
export const VOLATILITY_JUMP_THRESHOLD = 0.25; // 25% jump
```
*Run `npm test` — all unit tests for the validator will verify immediately!*

---

### Challenge 2: "Add a Discord or Slack Webhook when a price drops"
**Where**: [`backend/src/services/email.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/services/email.js) or [`backend/src/routes/alerts.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/routes/alerts.js)
```javascript
export async function sendWebhookAlert(alert) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `🚨 **[Price Tracker Alert]** ${alert.type.toUpperCase()}: ${alert.message}`
    })
  });
}
```

---

### Challenge 3: "Allow products to be scraped every 30 or 60 minutes"
**Where**: [`supabase/schema.sql`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/supabase/schema.sql) and [`frontend/src/components/SearchTrackModal.jsx`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/frontend/src/components/SearchTrackModal.jsx)
1. In SQL:
   ```sql
   ALTER TABLE tracked_products DROP CONSTRAINT tracked_products_scrape_interval_minutes_check;
   ALTER TABLE tracked_products ADD CONSTRAINT tracked_products_scrape_interval_minutes_check
     CHECK (scrape_interval_minutes >= 30);
   ```
2. In `SearchTrackModal.jsx`: Add `<option value={60}>Every 1 hour (60m)</option>` to the select dropdown.

---

### Challenge 4: "Change the maximum retry attempts from 4 to 6"
**Where**: [`backend/src/scraper/constants.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/scraper/constants.js)
```javascript
// Line 5: Change 4 to 6
export const MAX_ATTEMPTS = 6;
```

---

### Challenge 5: "Add a new filter on the dashboard to only show flagged items"
**Where**: [`frontend/src/pages/DashboardPage.jsx`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/frontend/src/pages/DashboardPage.jsx)
In the filter section:
```jsx
// Add state:
const [onlyFlagged, setOnlyFlagged] = useState(false);

// In filteredProducts filter:
if (onlyFlagged && !p.hasFlaggedPrice) return false;

// In UI toolbar:
<label className="flex items-center text-xs font-medium text-slate-700 cursor-pointer">
  <input type="checkbox" checked={onlyFlagged} onChange={e => setOnlyFlagged(e.target.checked)} className="mr-1.5" />
  Only Flagged Jumps (≥40%)
</label>
```

---

### Challenge 6: "Show how to inspect raw decrypted payloads in Postgres"
**Answer**:
```sql
SELECT id, status, duration_ms, error_type, extracted
FROM scrape_log
ORDER BY started_at DESC
LIMIT 5;
```
Explain: *"Every scrape attempt stores its raw extracted quote or error telemetry inside the `extracted` JSONB column in `scrape_log`. Nothing is ever discarded."*

---

### Challenge 7: "Show me how your retry backoff with jitter works"
**Where**: [`backend/src/scraper/retry.js`](file:///c:/Users/Divyansh%20Sharma/Desktop/INE%20assignment/backend/src/scraper/retry.js)
Explain:
1. First attempt: `BASE_BACKOFF_MS` (1,000 ms) $\times 2^0$ + random jitter between 0 and 300 ms.
2. Second attempt: 1,000 ms $\times 2^1$ = 2,000 ms + jitter.
3. Third attempt: 1,000 ms $\times 2^2$ = 4,000 ms + jitter.
4. Capped at `MAX_BACKOFF_MS` (10,000 ms).
5. If the server sends a `Retry-After: 5` header, we strictly respect `5000 ms` instead of computing our own.

---

## 4. Key Architectural Questions & Winning Answers

#### Q: "Why did you build both a Direct Protocol engine and a Headed Playwright runner?"
> *"Render's free tier has a 512 MB memory limit. A headless Chromium process requires 300–450 MB of RAM, leaving almost no buffer for Node.js and causing fatal Out-Of-Memory container kills under load.  
> By reverse-engineering the store's client bundle, we built a pure Node.js Direct Protocol client that executes in 38–70 MB RSS with in-memory Wasm caching. We preserved Playwright in `npm run scrape:headed` so reviewers can visually inspect the scraper handling bot traps and injected 503 faults, but we never run heavy browser binaries in production."*

#### Q: "Why use PostgreSQL RPC functions instead of separate Supabase client calls?"
> *"If the backend process dies or suffers a network timeout between writing the price history and writing the scrape log, the database ends up in an inconsistent state with orphan records.  
> By encapsulating persistence into the atomic `record_scrape_outcome` PostgreSQL RPC function, the price history insertion, log finalization, schedule advancement, and alert evaluations execute in a single ACID transaction. If anything fails, the entire transaction rolls back cleanly."*

#### Q: "What did your AI tools get wrong on the first attempt?"
> *"1. Initially, the AI generated randomized hex strings for the canvas and WebGL fingerprints in the attestation payload. The store rejected them with HTTP 401. I diagnosed this by capturing genuine Chrome CDP fingerprint signatures from a real Windows browser.  
> 2. The AI initially assumed the price endpoint would always return HTTP 200 with `{ e: string }`. When the store returned transient 503 errors, `JSON.parse` crashed. I wrapped status code validation and added explicit classification before decryption.  
> 3. The initial fake database mock didn't support Supabase's chainable `.insert().select().single()` syntax. I overhauled the mock builder to enable 100% deterministic offline testing across all 72 test suites."*
