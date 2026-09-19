# Architecture & Design Decisions: Product Price Tracker

## 1. Executive Summary

Building a reliable, unattended price tracker for `https://demo.inelabteamdev.com/` required navigating deliberately adversarial obstacles:
1. **Dynamic Client Decoupling**: The catalog metadata endpoint intentionally omits price and stock.
2. **Interactive Anti-Scraping Traps**: The DOM hides prices behind disabled buttons demanding 12 cursor movement coordinates, 1200 ms dwell times, cookie overlay dismissal, scrambled CSS classes, and decoy elements (`[data-price="true"]`).
3. **Cryptographic Challenge Protocol**: The real price is delivered via an authenticated, XOR-encrypted HTTP endpoint guarded by a Proof-of-Work puzzle and WebAssembly execution.
4. **Cloud Infrastructure Limits**: Deployment on Render's free tier imposes a strict 512 MB RAM limit, where headless Chromium instances routinely trigger Out-Of-Memory (OOM) fatal kills.

Our architecture solves these challenges through a **dual-engine design**:
- **Primary Production Engine**: A pure Node.js Direct Protocol Client that solves the challenge cryptographically. Measured memory usage is ~24 MB baseline RSS, peaking at ~38–70 MB during Wasm compilation and network fetching (measured via `process.memoryUsage().rss`), running in ~146 ms to 2,400 ms.
- **Observable Verification Engine**: A headed Playwright runner (`npm run scrape:headed`) used exclusively in development for visual demonstrations, DOM cross-checking, and video audits.

---

## 2. Direct Protocol Client vs. Headed Playwright

| Dimension | Headed / Headless Browser (Playwright/Puppeteer) | Direct Protocol Engine (`backend/src/scraper/fetcher.js`) |
|---|---|---|
| **Memory Footprint** | 250 MB – 450 MB per tab (Chromium V8 + GPU process) | **Measured 24 MB baseline, 38–70 MB peak RSS** |
| **Execution Latency** | 3,500 ms – 7,000 ms (DOM hydration, interaction timers) | **Measured 146 ms – 2,400 ms** (store dependent) |
| **Render 512MB RAM Safety** | High risk of fatal OOM container termination | **Safe: leaves > 440 MB free memory headroom** |
| **DOM Decoy Resistance** | Must bypass zero-width spaces (`\u200B`), fake tags, overlays | **Immune: bypasses DOM entirely** |
| **Maintenance Profile** | Breaks if CSS classes, button labels, or DOM layout change | Breaks only if the cryptographic API handshake contract changes |

---

## 3. Known Limitation: Fingerprint & Protocol Dependency

### Why the Direct-Protocol Path Was Chosen
We selected the direct protocol engine over running headless Chromium for three technical reasons:
1. **Render Free Tier 512 MB RAM Ceiling**: A headless Chromium process requires 250–450 MB of memory. In a 512 MB container, running a headless browser alongside Node.js routinely triggers Linux OOM killer kills (`exit code 137`). Our direct client consumes only 38–70 MB peak RSS.
2. **Speed and Efficiency**: Rather than loading megabytes of stylesheets, font files, and rendering cycles, direct protocol requests complete in 146 ms to 2,400 ms.
3. **Immunity to DOM Traps**: The store deliberately renders fake decoy prices (`[data-price="true"]`), injects zero-width non-breaking spaces (`\u200B`), and scrambles CSS classes via `/api/layout`. Direct protocol retrieves the authoritatively decrypted quote directly from the API.

### Breakdown: Copied vs. Synthesized Values
To ensure total transparency, the following table details which values are copied/extracted vs synthesized:

| Telemetry / Handshake Parameter | Source / Technique | Classification |
|---|---|---|
| **Shared Secret Key** | Extracted from deobfuscated store client `bundle.js` (`'ine-mock-store-shared-k3y'`). | **Copied / Hardcoded** |
| **Canvas 2D Hash** | Extracted from real Google Chrome 124 browser rendering on Windows (`'b93ad65b96d012a5'`). | **Copied / Hardcoded** |
| **WebGL Driver Hash** | Extracted from real Chrome ANGLE Direct3D/Metal WebGL context (`'bb3723445bc1f3b4'`). | **Copied / Hardcoded** |
| **Hardware Concurrency** | Standard quad-core CPU threads (`4`). | **Synthesized** |
| **Screen Dimensions** | Viewport preset (`[800, 600, 1]`). | **Synthesized** |
| **Display Frame Intervals** | Standard 60 Hz display refresh pacing (`[16.6, 16.7, 16.6, 16.7]`). | **Synthesized** |
| **Cursor Trajectories (`moves`)** | 12 non-linear coordinate points with $\ge 65\text{ ms}$ intervals and 1200ms dwell time. | **Synthesized dynamically** |
| **Timestamps (`at`, `hoverAt`, `clickAt`)** | Dynamic UTC timestamps generated via `Date.now()`. | **Synthesized dynamically** |
| **WebAssembly Output (`wasmOut`)** | Base64 Wasm compiled in-memory; executed using V8 `exports.f(seed)`. | **Computed dynamically** |
| **Proof-of-Work Nonce (`nonce`)** | Incrementing counter until `sha256(salt + ":" + nonce)` satisfies `difficulty`. | **Computed dynamically** |
| **Session Key & Decryption** | SHA-256 HMAC derived from salt, Wasm output, and attestation hash. | **Computed dynamically** |

### Risks & Failure Modes
If the upstream store alters its anti-scraping layer:
- **Shared Key Rotation**: If the store updates `'ine-mock-store-shared-k3y'`, key derivation fails.
- **Canvas Prompt Alteration**: If the store updates its 2D canvas drawing instructions, the expected hash changes.
- **New Fingerprinting Dimensions**: If the store requires AudioContext, WebGPU, or client TLS JA4 fingerprints.
- **How the System Responds**:
  - The store responds to `POST /api/session` with `HTTP 401 Unauthorized` or `403 Forbidden`.
  - The engine immediately halts retries and classifies the error as `STRUCTURE_CHANGED`.
  - An unresolved alert is logged in `alerts`.
  - **Zero unverified rows are written to `price_history`**, preserving database integrity.
  - The engineer uses `npm run scrape:headed` locally to inspect the new protocol and extract updated parameters.

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
