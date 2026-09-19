# Production Deployment Checklist

This document provides a pre-flight guide for deploying the **Product Price Tracker** to Supabase, Render, Vercel, and cron-job.org on their respective free tiers.

---

## 1. Supabase PostgreSQL Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in the Supabase dashboard.
3. Paste and run the entire contents of `supabase/schema.sql`.
4. Verify created resources in the **Table Editor**:
   - `tracked_products`
   - `price_history`
   - `scrape_log`
   - `scrape_runs`
   - `alerts`
5. Go to **Project Settings** $\to$ **API**:
   - Copy the **Project URL** (`https://<project-ref>.supabase.co`).
   - Copy the **`service_role` secret key** (needed for backend atomic RPC execution).

---

## 2. Render Backend Deployment

1. Create a free Web Service at [render.com](https://render.com) connected to your GitHub repository.
2. In the setup wizard:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm ci --omit=dev`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (512 MB RAM)
3. Set the following **Environment Variables** in Render:
   | Key | Value / Source | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Production mode |
   | `PORT` | `3000` (or leave default) | Bound to `0.0.0.0` |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | `<service-role-key>` | Supabase secret key |
   | `CRON_SECRET` | `<random-secure-hex-string>` | Shared secret for cron triggers |
   | `FRONTEND_ORIGIN` | `https://<your-vercel-domain>.vercel.app` | Vercel production frontend origin |
   | `STORE_BASE_URL` | `https://demo.inelabteamdev.com` | Hardcoded mock store base URL |
4. Deploy the service.
5. Verify: Open `https://<your-backend>.onrender.com/health`.
   - Response must be `HTTP 200` with `{"status":"ok", ...}`.

---

## 3. Vercel Frontend Deployment

1. Create a new project at [vercel.com](https://vercel.com) imported from your GitHub repository.
2. In the setup wizard:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Set the following **Environment Variable**:
   | Key | Value | Description |
   |---|---|---|
   | `VITE_API_URL` | `https://<your-backend>.onrender.com` | Render backend URL |
4. Deploy. Vercel automatically applies the SPA rewrites defined in `frontend/vercel.json`.
5. Verify: Open your Vercel URL, browse the dashboard, open the "Track Product" modal, and verify catalog search loads.

---

## 4. cron-job.org Scheduled Scraping Setup

1. Create a free account at [cron-job.org](https://cron-job.org).
2. Click **Create Cronjob**:
   - **Title**: `INE Product Price Tracker (2h Schedule)`
   - **URL**: `https://<your-backend>.onrender.com/api/cron/scrape`
   - **Schedule**: Every 2 hours (`0 */2 * * *`)
   - **Request Method**: `POST`
   - **Request Headers**:
     - Key: `x-cron-secret`
     - Value: `<your-CRON_SECRET>`
3. Save and click **Test run**:
   - Status must return `HTTP 202 Accepted`.

---

## 5. Post-Deployment Verification Checklist

- [ ] `GET https://<your-backend>.onrender.com/health` returns HTTP 200.
- [ ] `GET https://<your-backend>.onrender.com/api/store/search?q=125` returns Copperpot Solar Charger Mini.
- [ ] `POST /api/cron/scrape` with wrong secret returns HTTP 401.
- [ ] `POST /api/cron/scrape` with valid `x-cron-secret` returns HTTP 202.
- [ ] Tracking a product in the frontend immediately triggers an initial scrape and renders a chart within seconds.
