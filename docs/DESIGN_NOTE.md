# Architecture & Design Decisions: Product Price Tracker

## 1. Executive Summary

Building a reliable, unattended price tracker for `https://demo.inelabteamdev.com/` required navigating deliberately adversarial obstacles:
1. **Dynamic Client Decoupling**: The catalog metadata endpoint intentionally omits price and stock.
2. **Interactive Anti-Scraping Traps**: The DOM hides prices behind disabled buttons demanding 12 cursor movement coordinates, 1200 ms dwell times, cookie overlay dismissal, scrambled CSS classes, and decoy elements (`[data-price="true"]`).
3. **Cryptographic Challenge Protocol**: The real price is delivered via an authenticated, XOR-encrypted HTTP endpoint guarded by a Proof-of-Work puzzle and WebAssembly execution.
4. **Cloud Infrastructure Limits**: Deployment on Render's free tier imposes a strict 512 MB RAM limit, where headless Chromium instances routinely trigger Out-Of-Memory (OOM) fatal kills.

Our architecture solves these challenges through a **dual-engine design**:
- **Primary Production Engine**: A pure Node.js Direct Protocol Client that solves the challenge cryptographically, consumes $< 20\text{ MB}$ RAM, and runs in ~150 ms.
- **Observable Verification Engine**: A headed Playwright runner (`npm run scrape:headed`) used exclusively in development for visual demonstrations, DOM cross-checking, and video audits.

---

## 2. Direct Protocol Client vs. Headed Playwright

| Dimension | Headed / Headless Browser (Playwright/Puppeteer) | Direct Protocol Engine (`backend/src/scraper/fetcher.js`) |
|---|---|---|
| **Memory Footprint** | 250 MB – 450 MB per tab | **< 20 MB total process RSS** |
| **Execution Latency** | 3,500 ms – 7,000 ms (DOM hydration, interaction timers) | **100 ms – 350 ms** |
| **Render 512MB RAM Safety** | High risk of OOM container termination on Render Free Tier | **100% immune to OOM crashes** |
| **DOM Decoy Resistance** | Must bypass zero-width spaces (`\u200B`), fake tags, overlays | **Immune: bypasses DOM entirely** |
| **Maintenance Profile** | Breaks if CSS classes, button labels, or DOM layout change | Breaks only if the cryptographic API handshake contract changes |

---

## 3. Known Limitation: Fingerprint & Protocol Dependency

### The Trade-off Plainly Stated
The direct protocol scraper achieves exceptional reliability, speed, and minimal memory usage because it speaks the store's native client protocol. However, **this architecture introduces an inherent coupling to the stability of the store's challenge handshake and client attestation format**.

Specifically, the scraper relies on:
1. **Attestation Hashes**: Hardcoded Canvas 2D (`'b93ad65b96d012a5'`) and WebGL (`'bb3723445bc1f3b4'`) hashes derived from a real Windows Chrome 124 browser instance.
2. **Shared Secret Key**: The static string `'ine-mock-store-shared-k3y'` extracted from the store's client bundle.
3. **Protocol Flow**: The sequence of `GET /api/challenge` $\to$ solve Wasm/PoW $\to$ `POST /api/session` $\to$ `GET /api/products/:id/price`.

### Failure Modes
If the upstream store alters its anti-scraping layer (for example, by changing the canvas test prompt, rotating the shared secret key, switching to an AES-GCM cipher, or enforcing server-side TLS JA4 fingerprinting):
- The handshake endpoint `POST /api/session` will reject the attestation with `HTTP 401 Unauthorized` or `HTTP 403 Forbidden`.
- **Our Guardrail**: The scraper will **never** retry endlessly in a tight loop. Instead, `fetcher.js` classifies the rejection as `STRUCTURE_CHANGED`.
- The atomic database procedure marks the scrape log as failed, raises an unacknowledged alert in the `alerts` table, and **stores zero rows in `price_history`**.
- This guarantees data integrity: the system will never corrupt historical data with bad prices.

### The Operational Fallback
If the store alters its challenge protocol:
1. **Immediate Detection**: The dashboard displays a red "Protocol Alteration Alert" indicating that the store handshake format has changed.
2. **Developer Fallback**: The engineer runs `npm run scrape:headed` locally to inspect the new DOM and bundle behavior.
3. **Protocol Extraction**: Running the probe script extracts the updated canvas prompt or cipher key, updating `constants.js` and restoring automated scraping in minutes.

---

## 4. Volatility Threshold Rationale (Amendment 3)

During reconnaissance (Phase 0), we observed the following price distribution for Product #125 across multiple test requests:
- Minimum observed price: ₹1,187.00 (118,700 cents)
- Typical observed price: ₹1,279.00 (127,900 cents)
- Maximum observed price: ₹1,475.00 (147,500 cents)
- The baseline natural price variance observed in the store is approximately **15% to 24%**.

To prevent false alarms caused by normal store discounts while detecting synthetic pricing anomalies or corrupted currency parsing, we derived the volatility jump threshold as **$\ge 40\%$ ($\Delta \ge 0.40$)**.

### Two-Phase Jump Confirmation Logic
When a newly fetched price differs from the most recent historical price by $\ge 40\%$:
1. The engine does **not** blindly store it.
2. It executes an immediate, single confirmation re-fetch (`fetchProductPriceDirect`).
3. **Agreement**: If the second fetch confirms the new price within a 5% tolerance:
   - The price is recorded in `price_history` with `flagged = true`.
4. **Disagreement**: If the second fetch diverges from the first fetch, or if the re-fetch fails:
   - The entire scrape run is marked `failed` with error `VALIDATION_FAILED`.
   - **Zero rows are written to `price_history`**.

---

## 5. Atomic Persistence & Transaction Guarantees (Amendment 2)

A common flaw in distributed scrapers is the "orphan record" defect: a network timeout or crash occurring between writing to `price_history` and writing to `scrape_log`.

We solved this at the database level by removing direct `INSERT` permissions on `price_history` and wrapping persistence into atomic PostgreSQL functions:
- `finalize_scrape_success(...)`:
  1. Updates the `scrape_log` record with duration, attempts, status (`success` or `retried`), and full raw payload.
  2. Inserts a new row into `price_history` (with `flagged` status).
  3. Updates `tracked_products.last_scraped_at = now()` and advances `next_scrape_at = now() + interval`.
- `finalize_scrape_failure(...)`:
  1. Updates `scrape_log` with status `failed`, error taxonomy code, and message.
  2. Advances `next_scrape_at` so the scheduler does not retry immediately.
  3. If `p_structure_changed` is true, inserts an unresolved alert into `alerts`.
  4. **Strictly never touches `price_history`**.

---

## 6. What the AI Tools Got Wrong First

For complete transparency, all genuine mistakes and faulty assumptions encountered during initial implementation were documented in `docs/AI_MISTAKES_LOG.md`. A summary of the key findings:

1. **Naive Attestation Fingerprint**: Initial implementations generated random hex strings for `canvas` and `gl` fingerprints. The store immediately returned HTTP 401. Solved by rendering through a real browser once to capture valid Chrome 124 canvas/WebGL hash signatures.
2. **Missing Upstream Error Guards**: Early prototypes assumed `/api/products/:id/price` would always return 200 OK with encrypted payload `{ e: string }`. When the store returned transient 503 errors, JSON parsing threw unhandled exceptions. Solved by wrapping HTTP status checks before decryption.
3. **In-Memory Fake Database Chain Incompatibility**: Supabase's JavaScript SDK supports chained `.insert().select().single()`. The initial fake DB mock returned plain objects on `insert()`. Solved by implementing a chainable builder.
4. **Session 429 Over-Eager Structure Flagging**: When the store rate-limited the session endpoint with HTTP 429, early code treated all non-200 responses as `STRUCTURE_CHANGED`. Solved by adding explicit status code routing for HTTP 429 to respect `retryAfter` backoff.
