// backend/test/smoke-test-real.js
// Smoke test against the REAL store (demo.inelabteamdev.com) using --dry-run.
// Tests 3 different products, 3 times each, spaced >= 3 seconds apart.
// Gathers real-world latency, success rate, and error taxonomy metrics.

import config from '../src/config.js';
import { fakeDb } from '../src/db/fake-db.js';
import { scrapeProduct } from '../src/scraper/scrape-product.js';
import { sleep } from '../src/scraper/retry.js';

const TEST_PRODUCTS = ['125', '239', '404'];
const RUNS_PER_PRODUCT = 3;
const DELAY_BETWEEN_REQUESTS_MS = 3500; // >= 3 seconds politeness gap

async function runRealStoreSmokeTest() {
  console.log('===============================================================');
  console.log('      REAL STORE SMOKE TEST (https://demo.inelabteamdev.com)   ');
  console.log('===============================================================');
  console.log(`Products to test: ${TEST_PRODUCTS.join(', ')}`);
  console.log(`Runs per product: ${RUNS_PER_PRODUCT} (${TEST_PRODUCTS.length * RUNS_PER_PRODUCT} total scrapes)`);
  console.log(`Spacing:          ${DELAY_BETWEEN_REQUESTS_MS} ms between runs\n`);

  const results = [];
  const errorsSeen = new Map();
  let totalSuccessfulRuns = 0;
  let runNumber = 0;

  for (const storeProductId of TEST_PRODUCTS) {
    // Seed fake product record for dry-run
    const product = fakeDb.seedProduct({
      store_product_id: storeProductId,
      name: `Smoke Test Prod ${storeProductId}`
    });

    for (let run = 1; run <= RUNS_PER_PRODUCT; run++) {
      runNumber++;
      console.log(`[${runNumber}/${TEST_PRODUCTS.length * RUNS_PER_PRODUCT}] Scraping product ${storeProductId} (Run #${run})...`);

      const start = Date.now();
      let scrapeRes;
      try {
        scrapeRes = await scrapeProduct(product, {
          db: fakeDb,
          trigger: 'cli',
          baseUrl: config.storeBaseUrl
        });
      } catch (err) {
        scrapeRes = {
          status: 'failed',
          errorType: 'UNEXPECTED_EXCEPTION',
          errorMessage: err.message,
          attempts: 1
        };
      }
      const duration = Date.now() - start;

      const isSuccess = scrapeRes.status === 'success' || scrapeRes.status === 'retried';
      if (isSuccess) totalSuccessfulRuns++;

      if (scrapeRes.errorType) {
        errorsSeen.set(scrapeRes.errorType, (errorsSeen.get(scrapeRes.errorType) || 0) + 1);
      }

      console.log(`   -> Outcome:  ${scrapeRes.status.toUpperCase()}`);
      console.log(`   -> Attempts: ${scrapeRes.attempts}`);
      console.log(`   -> Latency:  ${duration} ms`);
      if (scrapeRes.quote) {
        console.log(`   -> Price:    ₹${(scrapeRes.quote.priceCents / 100).toFixed(2)} | Stock: ${scrapeRes.quote.stockQuantity ?? 0} | Currency: ${scrapeRes.quote.currency}`);
      }
      if (scrapeRes.errorMessage) {
        console.log(`   -> Error:    [${scrapeRes.errorType}] ${scrapeRes.errorMessage}`);
      }

      results.push({
        productId: storeProductId,
        run,
        status: scrapeRes.status,
        attempts: scrapeRes.attempts,
        duration,
        priceCents: scrapeRes.quote?.priceCents,
        errorType: scrapeRes.errorType
      });

      // Polite pause between scrapes (except after the final one)
      if (runNumber < TEST_PRODUCTS.length * RUNS_PER_PRODUCT) {
        console.log(`   ⏳ Pausing ${DELAY_BETWEEN_REQUESTS_MS / 1000}s...\n`);
        await sleep(DELAY_BETWEEN_REQUESTS_MS);
      }
    }
  }

  // Calculate Metrics
  const totalRuns = results.length;
  const successRate = (totalSuccessfulRuns / totalRuns) * 100;
  const durations = results.map(r => r.duration);
  const minLatency = Math.min(...durations);
  const maxLatency = Math.max(...durations);
  const avgLatency = Math.round(durations.reduce((a, b) => a + b, 0) / totalRuns);

  console.log('\n===============================================================');
  console.log('                   SMOKE TEST REPORT SUMMARY                   ');
  console.log('===============================================================');
  console.log(`Total Scrapes Executed: ${totalRuns}`);
  console.log(`Successful Scrapes:     ${totalSuccessfulRuns} / ${totalRuns}`);
  console.log(`Success Rate:           ${successRate.toFixed(1)}%`);
  console.log(`Latency (Min):          ${minLatency} ms`);
  console.log(`Latency (Max):          ${maxLatency} ms`);
  console.log(`Latency (Average):      ${avgLatency} ms`);
  console.log('---------------------------------------------------------------');
  console.log('Error Taxonomy Breakdown:');
  if (errorsSeen.size === 0) {
    console.log('  None! All scrapes succeeded without unhandled errors.');
  } else {
    for (const [errType, count] of errorsSeen.entries()) {
      console.log(`  - ${errType}: ${count} occurrences`);
    }
  }
  console.log('===============================================================\n');

  return { totalRuns, successRate, minLatency, maxLatency, avgLatency, errorsSeen };
}

runRealStoreSmokeTest().catch(console.error);
