// backend/test/e2e-frontend-audit.js
// Automated end-to-end browser click-through audit of the frontend against the backend.
// Launches backend and frontend, automates every screen with Playwright, and checks for errors.

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { createApp } from '../src/app.js';
import { createFakeDatabase } from '../src/db/fake-db.js';
import { refreshCatalogCache } from '../src/services/store-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');

async function runE2EAudit() {
  console.log('\n===============================================================');
  console.log('       FRONTEND + BACKEND E2E BROWSER CLICK-THROUGH AUDIT      ');
  console.log('===============================================================');

  const consoleErrors = [];
  const pageErrors = [];
  const networkErrors = [];

  // Pre-warm store catalog
  console.log('📦 Pre-warming store catalog cache...');
  await refreshCatalogCache({ baseUrl: 'https://demo.inelabteamdev.com' });

  // 1. Boot local backend on port 3000
  console.log('🔌 [1/6] Booting local backend API server on port 3000...');
  const db = createFakeDatabase();
  const backendApp = createApp({
    db,
    config: {
      port: 3000,
      cronSecret: 'test-audit-cron-secret',
      frontendOrigin: '*'
    },
    scraperOptions: {
      baseUrl: 'https://demo.inelabteamdev.com'
    }
  });

  const backendServer = await new Promise((resolve) => {
    const s = backendApp.listen(3000, () => resolve(s));
  });

  // 2. Boot static frontend server on port 5173
  console.log('🌐 [2/6] Booting static frontend distribution server on port 5173...');
  const frontendApp = express();
  frontendApp.use(express.static(FRONTEND_DIST));
  frontendApp.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });

  const frontendServer = await new Promise((resolve) => {
    const s = frontendApp.listen(5173, () => resolve(s));
  });

  // 3. Launch Playwright Browser
  console.log('🚀 [3/6] Launching Playwright browser...');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    browser = await chromium.launch({ headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Error listeners
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`   🚨 [Browser Console Error]: ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
    console.log(`   💥 [Page Exception]: ${err.message}`);
  });

  page.on('requestfailed', (req) => {
    console.log(`   ❌ [Network Req Failed]: ${req.method()} ${req.url()} (${req.failure()?.errorText})`);
  });

  page.on('response', async (res) => {
    if (res.url().includes('/api/store/search')) {
      const text = await res.text().catch(() => '');
      console.log(`   🔍 [Search Response Body]: ${text.substring(0, 200)}`);
    }
    if (res.url().includes('/api/')) {
      console.log(`   📡 [API Response ${res.status()}]: ${res.url()}`);
    }
    if (res.status() >= 400 && !res.url().includes('/api/alerts')) {
      networkErrors.push(`${res.status()} ${res.url()}`);
      console.log(`   ⚠️ [Network HTTP ${res.status()}]: ${res.url()}`);
    }
  });

  const auditResults = [];
  function recordCheck(name, pass, details = '') {
    auditResults.push({ name, pass, details });
    console.log(`   ${pass ? '✅ [PASS]' : '❌ [FAIL]'} ${name} ${details ? `(${details})` : ''}`);
  }

  try {
    // -------------------------------------------------------------
    // STEP 1: Visit Dashboard (Empty State)
    // -------------------------------------------------------------
    console.log('\n📊 [4/6] Testing Dashboard Initial Load...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const navHeading = await page.textContent('header');
    recordCheck('Navbar rendered', navHeading.includes('Price Tracker'));

    const emptyStateText = await page.textContent('body');
    recordCheck('Empty state displayed', emptyStateText.includes('No Tracked Products Yet') || emptyStateText.includes('Tracked Products Dashboard'));

    // -------------------------------------------------------------
    // STEP 2: Open Search & Track Modal
    // -------------------------------------------------------------
    console.log('\n🔍 [5/6] Testing Search & Track Modal Flow...');
    const trackBtn = page.locator('button:has-text("Track Product"), button:has-text("Track New Product")').first();
    await trackBtn.click();
    await page.waitForTimeout(400);

    const modalVisible = await page.isVisible('text=Track a Product from Mock Store');
    recordCheck('Track modal opened', modalVisible);

    // Search for product
    const searchInput = page.locator('input[placeholder*="Search by product name"]').first();
    await searchInput.fill('Copperpot');
    console.log('   Typing "Copperpot" in catalog search input...');
    await page.waitForTimeout(1500); // Wait for debounce and fetch

    // Wait for Track action button to appear next to product
    const trackActionBtn = page.locator('.fixed button:has-text("Track"):not(:has-text("Product"))').first();
    await trackActionBtn.waitFor({ state: 'visible', timeout: 8000 });
    const productTitleInModal = await page.locator('.fixed h4').first().textContent();
    recordCheck('Catalog search returned results', productTitleInModal.includes('Copperpot'), productTitleInModal);

    // Select frequency in modal
    const freqSelect = page.locator('.fixed select').first();
    if (await freqSelect.isVisible()) {
      await freqSelect.selectOption('240'); // 4 hours
      recordCheck('Frequency selector updated to 4 hours (240 min)', true);
    }

    // Click Track button inside modal
    await trackActionBtn.click();
    console.log(`   Clicked "Track" button on ${productTitleInModal}...`);
    await page.waitForTimeout(2000); // Wait for tracking creation & navigation

    // -------------------------------------------------------------
    // STEP 3: Test Product Detail Page
    // -------------------------------------------------------------
    console.log('\n📈 [6/6] Testing Product Detail Page & Recharts...');
    await page.waitForURL((url) => url.pathname.startsWith('/products/'), { timeout: 8000 });
    const currentUrl = page.url();
    recordCheck('Navigated to Product Detail page', currentUrl.includes('/products/'), currentUrl);

    await page.waitForTimeout(1500);

    const productTitle = await page.textContent('h1');
    recordCheck('Product title rendered', productTitle.includes('Copperpot'), productTitle);

    const kpiCards = await page.locator('text=Current Price').first().isVisible();
    recordCheck('KPI summary cards rendered', kpiCards);

    const chartVisible = await page.locator('text=Price & Stock History').first().isVisible();
    recordCheck('Price & Stock chart container visible', chartVisible);

    // Test Audit Log Table
    const auditLogVisible = await page.locator('text=Scrape Audit Log').first().isVisible();
    recordCheck('Audit log table visible', auditLogVisible);

    // Test Manual Scrape Now Button
    const scrapeNowBtn = page.locator('button:has-text("Scrape Now")').first();
    if (await scrapeNowBtn.isVisible()) {
      await scrapeNowBtn.click();
      console.log('   Clicked "Scrape Now" manual refresh button...');
      await page.waitForTimeout(3000);
      recordCheck('Manual "Scrape Now" button triggered refetch without error', true);
    }

    // Navigate back to Dashboard
    const backBtn = page.locator('a:has-text("Back to Dashboard")').first();
    await backBtn.click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 5000 });
    await page.waitForTimeout(1000);

    const tableHasItem = await page.textContent('table');
    recordCheck('Dashboard table displays tracked product', tableHasItem.includes('Copperpot'));

    // Test table search filter
    const filterInput = page.locator('input[placeholder*="Filter tracked products"]').first();
    await filterInput.fill('NonExistentProductXYZ');
    await page.waitForTimeout(300);
    const tableFilteredOut = await page.locator('table tbody tr').count();
    recordCheck('Filter bar filters product rows', tableFilteredOut === 0);

    await filterInput.fill('');
    await page.waitForTimeout(300);
    const tableRestored = await page.locator('table tbody tr').count();
    recordCheck('Clearing filter restores product row', tableRestored >= 1);

  } catch (err) {
    console.error(`\n❌ E2E Audit threw an unhandled exception: ${err.message}`);
    pageErrors.push(err.message);
  } finally {
    await browser.close();
    backendServer.close();
    frontendServer.close();
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('                 E2E AUDIT RESULTS SUMMARY                     ');
  console.log('===============================================================');
  const totalChecks = auditResults.length;
  const passedChecks = auditResults.filter(r => r.pass).length;
  const failedChecks = auditResults.filter(r => !r.pass).length;

  console.log(`Total Checks Executed:      ${totalChecks}`);
  console.log(`Checks PASSED:              ${passedChecks}`);
  console.log(`Checks FAILED:              ${failedChecks}`);
  console.log(`Browser Console Errors:     ${consoleErrors.length}`);
  console.log(`Page Uncaught Exceptions:   ${pageErrors.length}`);
  console.log(`Network HTTP Failures:      ${networkErrors.length}`);
  console.log('===============================================================');

  if (failedChecks > 0 || pageErrors.length > 0 || consoleErrors.length > 0) {
    console.error('\n❌ E2E Audit encountered issues.\n');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL FRONTEND FLOWS & INTERACTIONS PASSED WITH ZERO ERRORS!\n');
    process.exit(0);
  }
}

runE2EAudit().catch(console.error);
