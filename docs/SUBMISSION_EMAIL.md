# 📧 Final Submission Email Template

> **Deadline**: September 20, 2026 (Sunday) – 11:59 PM IST  
> **To**: `sstephen@ine.com`  
> **Cc**: `ssingh@ine.com`  
> **Subject**: `First Round: Software Engineer Intern Assignment - Divyansh Sharma`

---

### Copy-Paste Email Body:

Dear Stephen and the INE Engineering Team,

Thank you for the opportunity to work on the **Product Price Tracker (Web Scraping)** assignment. I have completed the full-stack project, verified all reliability invariants against both offline test suites and live Supabase PostgreSQL, and deployed the application to production.

Below are the required deliverables, links, and project highlights:

---

### 🔗 Deliverables & Links

1. **Live Hosted Web Application**:  
   - Frontend (Vercel): `https://<your-vercel-frontend-url>.vercel.app`
   - Backend API & Health Check (Render): `https://ine-product-price-tracker-attc.onrender.com/health`
2. **Public GitHub Repository**:  
   - URL: **https://github.com/divyansh9704/ine-product-price-tracker**
3. **Screen Recording (2–4 Minutes)**:  
   - Video URL: `https://<your-loom-or-youtube-unlisted-or-drive-link>`  
   *(Demonstrates headed Playwright runner, cookie dismissal, 1.2s dwell-time simulation, SHA-256 PoW/Wasm execution, 503 fault injection, and live dashboard interaction)*
4. **Comprehensive Documentation & Design Note**:  
   - Architecture & Design Note: [`docs/DESIGN_NOTE.md`](https://github.com/divyansh9704/ine-product-price-tracker/blob/master/docs/DESIGN_NOTE.md)
   - Cryptographic Protocol Breakdown: [`docs/PROTOCOL_EXPLAINED.md`](https://github.com/divyansh9704/ine-product-price-tracker/blob/master/docs/PROTOCOL_EXPLAINED.md)
   - Real AI Mistakes & Defect Log: [`docs/AI_MISTAKES_LOG.md`](https://github.com/divyansh9704/ine-product-price-tracker/blob/master/docs/AI_MISTAKES_LOG.md)
   - Local Verification Guide: [`docs/LOCAL_VERIFY.md`](https://github.com/divyansh9704/ine-product-price-tracker/blob/master/docs/LOCAL_VERIFY.md)
5. **Resume**: Attached as PDF (`Divyansh_Sharma_Resume.pdf`).

---

### 🌟 Core Engineering & Reliability Highlights

- **Adversarial Target Scraping (`demo.inelabteamdev.com`)**:
  - The store decouples price from catalog metadata, protects endpoints with interactive dwell timers, and serves fake decoy DOM prices with zero-width non-breaking spaces (`\u200B`).
  - Implemented a **Dual-Engine Architecture**:
    1. **Production Direct Protocol Client**: Pure Node.js client executing Wasm bytecode and SHA-256 PoW puzzles. Consumes only **38–70 MB peak RSS** (leaving >440 MB free buffer on Render's 512 MB free tier), running with in-memory Wasm caching (**0.0 ms** re-compile overhead).
    2. **Observable Headed Playwright Runner**: Available via `npm run scrape:headed` with simulated human cursor trajectories and DOM cross-validation.
- **Zero Corrupted Data Guarantee**:
  - Unverified, stale, or placeholder (`g: 1`) quotes are strictly rejected.
  - Failures are recorded honestly in `scrape_log` and never pollute `price_history`.
- **Atomic Database Transactions (PostgreSQL RPC)**:
  - Wrapped all persistence into the `record_scrape_outcome` PostgreSQL function. History insertion, log finalization, schedule advancement, and alert evaluations commit in a single ACID transaction.
- **40% Volatility Anomaly Detection**:
  - Automatically re-fetches prices that jump $\ge 40\%$ from historical records. Two agreeing fetches confirm and flag the price; disagreement drops the quote and triggers alerts.
- **100% Deterministic Automated Test Suite**:
  - **72 tests across 20 suites** passing 100% offline via an in-memory `FakeDatabase` layer.
  - Verified live against Supabase PostgreSQL via `npm run smoke:db` (10/10 assertions passing).

---

### 🎁 All 5/5 Bonus Objectives Implemented

1. **Price-Drop & Back-in-Stock Alerts**: In-app alerts banner with acknowledgement controls + optional SendGrid email notifications.
2. **Aggregated Multi-Product Dashboard**: Real-time KPI summary across all tracked items, stock indicators, and health ratios.
3. **Change Detection**: Explicit classification of upstream contract alterations (`STRUCTURE_CHANGED`), creating persistent alerts without storing bad data.
4. **Configurable Scrape Frequency**: Supports custom schedules per product (120m, 240m, 360m, 720m, 1440m).
5. **CI/CD Pipeline**: GitHub Actions workflow and full automated browser audit (`npm run test:e2e`).

I would be excited to discuss the architecture or walk through any live code modifications during the technical interview.

Warm regards,  
**Divyansh Sharma**  
GitHub: [@divyansh9704](https://github.com/divyansh9704)
