# Screen Recording Script & Shot List (2–4 Minutes)

This document provides a scene-by-scene script, exact commands, narration talking points, and visual cues for recording a 2–4 minute video demonstration of the **Product Price Tracker**.

---

## Shot List & Timeline Overview

| Scene | Duration | Focus Area | Command / Screen |
|---|---|---|---|
| **Scene 1: Introduction & Target Store** | 0:00 – 0:45 | Anti-scraping obstacles on `demo.inelabteamdev.com` | Browser showing the mock store DOM traps |
| **Scene 2: Headed Observable Scrape** | 0:45 – 1:45 | Playwright visible browser and cross-validation | Terminal: `npm run scrape:headed -- --product 125` |
| **Scene 3: Full-Stack Application** | 1:45 – 2:45 | Search & track modal, Recharts graph, audit logs | Browser at `http://localhost:5173` |
| **Scene 4: Fault Injection & Atomic RPC** | 2:45 – 3:30 | 503 recovery, 40% jump confirmation, zero bad data | Terminal: `npm test` + fault simulation |
| **Scene 5: Production Deployment Blueprint** | 3:30 – 4:00 | Render (512MB RAM safe), Vercel SPA, cron-job.org | Code tour: `render.yaml`, `schema.sql` |

---

## Detailed Scene Breakdown

### Scene 1: Introduction & Target Store Obstacles (0:00 – 0:45)

**Visual**:
- Open browser to `https://demo.inelabteamdev.com/product/125`.
- Open Chrome DevTools (Inspect Element and Network tab).

**Action**:
- Highlight the disabled "Reveal Price" button.
- Show the Cookie Consent overlay blocking interactions.
- Inspect the DOM to reveal `<span data-price="true" class="decoy">` elements containing fake decoy prices.
- Show Network tab: Point out that catalog API `/api/product/125` provides description and specs but intentionally omits price and stock.

**Narration Script**:
> *"Welcome! For this project, we built a resilient, full-stack Product Price Tracker targeting `demo.inelabteamdev.com`. Scraping this store is deliberately challenging: price and stock are decoupled from catalog metadata, hidden behind interactive bot traps like dwell timers and cookie overlays, and surrounded by DOM decoys with zero-width spaces.*
> 
> *Rather than relying solely on fragile DOM scraping that would consume 400MB of RAM and crash on Render's 512MB free tier, we reverse-engineered the store's native client cryptographic handshake. Let's see it in action."*

---

### Scene 2: Headed Observable Scrape (0:45 – 1:45)

**Visual**:
- Split screen: Left half terminal, Right half browser window.

**Action**:
- Run in terminal:
  ```bash
  npm run scrape:headed -- --product 125 --slow 400
  ```
- Watch Chromium automatically launch in headed mode.
- Observe:
  1. Cookie banner automatically dismissed.
  2. Cursor trajectory simulated over the price container to fulfill dwell time.
  3. Network requests intercepted: `GET /api/challenge` $\to$ Wasm & Proof-of-Work solved $\to$ `POST /api/session` $\to$ encrypted price quote received.
  4. Terminal prints the **Cross-Engine Validation Report** matching DOM extraction against direct decrypted XOR cipher.

**Narration Script**:
> *"Here is our headed observable mode running via Playwright. Watch as it launches Chromium, dismisses the cookie overlay, and simulates human cursor movements with a 1.2-second dwell time to unlock the UI.*
> 
> *Simultaneously, our scraper intercepts the cryptographic challenge, compiles the WebAssembly binary in memory, solves the SHA-256 proof-of-work, and decrypts the XOR-encrypted price payload using the derived token key. Notice the terminal: the direct protocol decrypted price and the DOM string match perfectly."*

---

### Scene 3: Full-Stack Web App: Dashboard & Charts (1:45 – 2:45)

**Visual**:
- Switch to full browser at `http://localhost:5173`.

**Action**:
- **Dashboard Overview**:
  - Point out aggregated KPI cards: Active Tracked Products, Stock Availability (in stock vs out of stock), Audit Health Rate (100%), and Next Scheduled Run countdown.
- **Search & Track Modal**:
  - Click "+ Track Product".
  - Type "Copperpot" or "Solar". Notice debounced search querying the store catalog in real time.
  - Show the frequency selector: 2 hours (default multiple of 120), 4 hours, 6 hours.
  - Click "Track".
- **Product Detail Page**:
  - Click on Product #125.
  - Point out the Recharts price trajectory chart showing historical price line and stock availability.
  - Hover over a data point to show the custom tooltip with exact price, currency, timestamp, and stock.
  - Show the **Scrape Audit Log table**:
    - Show honest logging: every attempt is recorded (success, retried, failed).
    - Click "Inspect" on a log entry to expand the raw extracted payload and error taxonomy.
  - Click "Scrape Now" button: observe the live spinner and immediate update of the chart and table.

**Narration Script**:
> *"Now let's explore the user application. On the dashboard, users see real-time metrics across all tracked items, stock indicators, and next run countdowns.*
> 
> *When tracking a new product, debounced search queries the store catalog and lets the user choose an interval—strictly validated as a multiple of 120 minutes per Amendment 1.*
> 
> *On the Product Detail page, we visualize the price trajectory using Recharts. Notice the audit log table below: every scrape attempt is honestly recorded. When transient errors or retries occur, they are never swept under the rug. Clicking 'Inspect' reveals the complete error taxonomy and raw JSON payload."*

---

### Scene 4: Fault Invariants & Reliability Guarantees (2:45 – 3:30)

**Visual**:
- Terminal running automated verification.

**Action**:
- Run in terminal:
  ```bash
  npm test
  ```
- Show all 68 tests passing (100% offline, zero reliance on external network or real Supabase).
- Highlight key tests:
  - **Assertion (a)**: Zero price_history rows written on persistent 503 or validation failure.
  - **Assertion (c)**: Correct status taxonomy (`success`, `retried`, `failed`).
  - **Amendment 2**: Atomic Postgres RPC function (`finalize_scrape_success` and `finalize_scrape_failure`).
  - **Amendment 3**: 40% volatility jump verification (two agreeing fetches store with `flagged = true`; disagreeing fetches store nothing).

**Narration Script**:
> *"Reliability is the core requirement. Our test suite runs 68 offline integration tests verifying all fault invariants.*
> 
> *Notice our atomic PostgreSQL stored procedures: price history and scrape logs are committed in a single transaction. If a scrape fails, zero rows are written to `price_history`. Furthermore, if a price jumps by 40% or more, our engine re-fetches once: if both agree, it's flagged; if they disagree, it stores nothing. Data integrity is guaranteed."*

---

### Scene 5: Wrap-Up & Production Readiness (3:30 – 4:00)

**Visual**:
- Show `render.yaml`, `supabase/schema.sql`, and `frontend/vercel.json` in VS Code.

**Action**:
- Highlight:
  - Backend uses $< 20\text{ MB}$ RAM on Node 20 (Render 512MB RAM safe; Playwright is strictly a devDependency).
  - Supabase PostgreSQL schema with atomic RPC functions and RLS policies.
  - `POST /api/cron/scrape` secured by `x-cron-secret` via constant-time comparison for cron-job.org.
  - Frontend SPA rewrites for Vercel.

**Narration Script**:
> *"The system is deploy-ready: Node 20 Express backend configured for Render's free tier, Supabase schema with atomic functions, Vercel SPA frontend, and constant-time cron endpoints for 2-hour automated triggers.*
> 
> *Thank you for reviewing the Product Price Tracker!"*
