# 📧 Final Submission Email Template

> **Deadline**: September 20, 2026 (Sunday) – 11:59 PM IST  
> **To**: `sstephen@ine.com`  
> **Cc**: `ssingh@ine.com`  
> **Subject**: `First Round: Software Engineer Intern Assignment - Divyansh Sharma`

---

### Copy-Paste Email Body:

Dear Stephen and the INE Engineering Team,

Thank you for the opportunity to work on the **Product Price Tracker (Web Scraping)** assignment. I have completed the full-stack project, verified all reliability invariants against both offline test suites and live Supabase PostgreSQL, and deployed the production application across Render, Vercel, and cron-job.org.

Below are all required deliverables, live cloud links, and architectural highlights:

---

### 🔗 Deliverables & Live Links

1. **Live Hosted Web Application**:  
   - Frontend (Vercel): **https://ine-product-price-tracker.vercel.app**  
   - Backend API & Health Check (Render): **https://ine-product-price-tracker-attc.onrender.com/health**
2. **Public GitHub Repository**:  
   - URL: **https://github.com/divyansh9704/ine-product-price-tracker**
3. **Screen Recording (Video Demo)**:  
   - Video URL: **https://www.loom.com/share/876e8cf34975420ba5901f7025209fe8**  
   *(Demonstrates the headed Playwright browser, cookie dismissal, 1.2s dwell-time simulation, SHA-256 PoW/Wasm execution, 503 fault injection, live Bento dashboard, Bloomberg-style area chart, and CSV export)*
4. **Automated 2-Hour Scheduling (cron-job.org)**:  
   - Triggering: `POST https://ine-product-price-tracker-attc.onrender.com/api/cron/scrape`  
   - Secured by constant-time `x-cron-secret` authentication every 2 hours on the hour.
5. **Comprehensive Technical Documentation**:  
   - System Design & Reliability Architecture: [`docs/DESIGN_NOTE.md`](https://github.com/divyansh9704/ine-product-price-tracker/blob/master/docs/DESIGN_NOTE.md)  
   - Reverse-Engineered Protocol & Wasm Breakdown: [`docs/PROTOCOL_EXPLAINED.md`](https://github.com/divyansh9704/ine-product-price-tracker/blob/master/docs/PROTOCOL_EXPLAINED.md)  
   - Real AI Mistakes & Engineering Defect Log: [`docs/AI_MISTAKES_LOG.md`](https://github.com/divyansh9704/ine-product-price-tracker/blob/master/docs/AI_MISTAKES_LOG.md)  
   - Local Verification & Testing Guide: [`docs/LOCAL_VERIFY.md`](https://github.com/divyansh9704/ine-product-price-tracker/blob/master/docs/LOCAL_VERIFY.md)  
   - Recording Cue Sheet: [`docs/RECORDING_SCRIPT.md`](https://github.com/divyansh9704/ine-product-price-tracker/blob/master/docs/RECORDING_SCRIPT.md)
6. **Resume**: Attached as PDF (`Divyansh_Sharma_Resume.pdf`).

---

### 🌟 Core Engineering & Reliability Highlights

- **Target Site Scraping Resilience (`demo.inelabteamdev.com`)**:
  - The store decouples pricing from catalog metadata, protects endpoints with interactive dwell timers, and injects fake decoy prices into the DOM using zero-width spaces (`\u200B`).
  - Implemented a **Dual-Engine Architecture**:
    1. **Direct Protocol Engine (Production)**: Pure Node.js client executing Wasm bytecode and SHA-256 PoW puzzles. Operates in just **~80 MB RSS** (well within Render's 512 MB free-tier limit), running with in-memory Wasm compilation caching (**0.0 ms** re-compile overhead).
    2. **Observable Headed Playwright Runner**: Available via `npm run scrape:headed` with visible Chromium, simulated human cursor trajectories, dwell timers, and DOM cross-validation.
- **Zero Corrupted Data Guarantee**:
  - Unverified, stale, or placeholder quotes (`g: 1`) are strictly rejected.
  - Failures are recorded honestly in `scrape_log` and never pollute `price_history`.
- **Atomic Database Transactions (PostgreSQL RPC)**:
  - All persistence is encapsulated in the `record_scrape_outcome` PostgreSQL stored procedure. Price insertion, log finalization, schedule advancement, and alert evaluations commit in a single ACID transaction.
- **40% Volatility Anomaly Detection**:
  - Automatically triggers a confirmation re-fetch for price swings $\ge 40\%$. Two agreeing fetches confirm and flag the price; disagreement drops the quote and triggers alerts.
- **100% Deterministic Automated Test Suite**:
  - **72 tests across 20 suites** passing 100% offline via an in-memory `FakeDatabase` layer (`npm test`).
  - Verified live against Supabase PostgreSQL via `npm run smoke:db` (10/10 assertions passing).

---

### 🎨 World-Class Enterprise SaaS UI/UX

1. **Bento Grid & View Switcher**: Real-time KPI summaries, in-stock ratio progress bars, 24h volatility counter, and instant toggle between **Visual Product Cards** and an **Enterprise Dense Table**.
2. **Bloomberg-Style Financial AreaChart**: Gradient area fills, dark glassmorphic tooltip, and glowing $\ge 40\%$ volatility jump indicators.
3. **1-Click CSV Price History Export**: Complete data portability formatted with ISO timestamps, store IDs, prices, and stock statuses.
4. **Command+K Spotlight Search Modal**: Quick suggestion chips (`#125`, `#239`, `#404`), active schedule selector pills (Every 2h with "Assignment Default" badge), and instant debounced catalog search.
5. **Cyber-Security Alert Feed**: In-app alert banner with real-time acknowledgement for DOM alterations and price anomalies.

I look forward to discussing the system architecture or walking through any part of the codebase during the technical interview.

Warm regards,  
**Divyansh Sharma**  
GitHub: [@divyansh9704](https://github.com/divyansh9704)
