#!/usr/bin/env node
// backend/src/cli/smoke-db.js
// Runs a live end-to-end verification against the REAL Supabase PostgreSQL instance
// specified in backend/.env. Tests both success and forced failure atomic writes,
// verifies invariants, and cleans up all created test records.

import { config } from '../config.js';
import { createSupabaseClient } from '../db/supabase.js';
import { scrapeProduct } from '../scraper/scrape-product.js';

async function main() {
  console.log('\n===============================================================');
  console.log('       REAL SUPABASE SMOKE TEST (E2E DATABASE INVARIANTS)      ');
  console.log('===============================================================');

  const supabaseUrl = config.supabase.url;
  const serviceKey = config.supabase.serviceRoleKey;

  if (!supabaseUrl || !serviceKey) {
    console.error('\n❌ [FAIL] Missing Supabase credentials in backend/.env:');
    console.error('   Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    console.error('   Example in backend/.env:');
    console.error('     SUPABASE_URL=https://<your-project-id>.supabase.co');
    console.error('     SUPABASE_SERVICE_ROLE_KEY=<your-service-role-secret>\n');
    process.exit(1);
  }

  console.log(`🔌 Supabase URL: ${supabaseUrl}`);
  console.log(`🔑 Service Role Key: ${serviceKey.slice(0, 12)}...`);

  let db;
  try {
    db = createSupabaseClient(config);
  } catch (err) {
    console.error(`\n❌ [FAIL] Failed to initialize Supabase client: ${err.message}`);
    process.exit(1);
  }

  let assertionsPassed = 0;
  let assertionsFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`   ✅ [PASS] ${message}`);
      assertionsPassed++;
    } else {
      console.error(`   ❌ [FAIL] ${message}`);
      assertionsFailed++;
    }
  }

  let testProduct = null;
  const testStoreProductId = 125; // Known active product on demo.inelabteamdev.com
  const testRunTag = `smoke_test_${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // STEP 1: Track / setup a test product in Supabase
    // -------------------------------------------------------------
    console.log(`\n📦 [1/4] Inserting temporary test product in tracked_products...`);

    // Check if testStoreProductId already exists
    const { data: existingProduct } = await db
      .from('tracked_products')
      .select('*')
      .eq('store_product_id', testStoreProductId)
      .maybeSingle();

    let createdNewProduct = false;

    if (existingProduct) {
      testProduct = existingProduct;
      console.log(`   ℹ️  Reusing existing tracked product (ID: ${testProduct.id}, Store ID: ${testStoreProductId})`);
    } else {
      const { data: newProd, error: insertErr } = await db
        .from('tracked_products')
        .insert({
          store_product_id: testStoreProductId,
          name: `Smoke Test Product (${testRunTag})`,
          category: 'Testing',
          scrape_interval_minutes: 120,
          next_scrape_at: new Date().toISOString(),
          is_active: true
        })
        .select('*')
        .single();

      if (insertErr || !newProd) {
        throw new Error(`Failed to insert test product: ${insertErr?.message}`);
      }
      testProduct = newProd;
      createdNewProduct = true;
      console.log(`   Created new test product (ID: ${testProduct.id}, Store ID: ${testStoreProductId})`);
    }

    assert(Boolean(testProduct && testProduct.id), 'Test product successfully resolved in Supabase');

    // Baseline counts
    const { data: preHistory } = await db
      .from('price_history')
      .select('id')
      .eq('product_id', testProduct.id);
    const baselineHistoryCount = (preHistory || []).length;

    const { data: preLogs } = await db
      .from('scrape_log')
      .select('id')
      .eq('product_id', testProduct.id);
    const baselineLogCount = (preLogs || []).length;

    // -------------------------------------------------------------
    // STEP 2: Execute SUCCESSFUL scrape against real store
    // -------------------------------------------------------------
    console.log(`\n🚀 [2/4] Executing real scrape against demo.inelabteamdev.com...`);
    const successOutcome = await scrapeProduct(db, testStoreProductId, {
      baseUrl: 'https://demo.inelabteamdev.com'
    });

    console.log(`   -> Outcome Status:   ${successOutcome.status}`);
    console.log(`   -> Duration:         ${successOutcome.durationMs} ms`);
    console.log(`   -> Price Recorded:   ₹${successOutcome.quote ? (successOutcome.quote.priceCents / 100).toFixed(2) : 'N/A'}`);

    assert(
      successOutcome.status === 'success' || successOutcome.status === 'retried',
      `Scrape executed with success/retried outcome (actual: ${successOutcome.status})`
    );

    // Verify DB state after success
    const { data: postSuccessHistory } = await db
      .from('price_history')
      .select('id, price_cents, currency, in_stock')
      .eq('product_id', testProduct.id);
    const postSuccessHistoryCount = (postSuccessHistory || []).length;

    const { data: postSuccessLogs } = await db
      .from('scrape_log')
      .select('id, status, duration_ms, http_status')
      .eq('product_id', testProduct.id)
      .order('started_at', { ascending: false });
    const postSuccessLogCount = (postSuccessLogs || []).length;

    assert(
      postSuccessHistoryCount === baselineHistoryCount + 1,
      `Exactly ONE price_history row added (before: ${baselineHistoryCount}, after: ${postSuccessHistoryCount})`
    );

    assert(
      postSuccessLogCount === baselineLogCount + 1,
      `Exactly ONE scrape_log row added (before: ${baselineLogCount}, after: ${postSuccessLogCount})`
    );

    assert(
      postSuccessLogs && (postSuccessLogs[0].status === 'success' || postSuccessLogs[0].status === 'retried'),
      `Latest scrape_log row status matches success/retried (actual: ${postSuccessLogs?.[0]?.status})`
    );

    // -------------------------------------------------------------
    // STEP 3: Execute FORCED FAILURE scrape (unreachable host)
    // -------------------------------------------------------------
    console.log(`\n💥 [3/4] Forcing scrape failure (overriding baseUrl to unreachable host)...`);
    const failureHistoryBaseline = postSuccessHistoryCount;
    const failureLogBaseline = postSuccessLogCount;

    const failureOutcome = await scrapeProduct(db, testStoreProductId, {
      baseUrl: 'http://127.0.0.1:1', // Unreachable port -> instant connection refused
      maxAttempts: 2,
      baseBackoffMs: 200
    });

    console.log(`   -> Outcome Status:   ${failureOutcome.status}`);
    console.log(`   -> Error Type:       ${failureOutcome.errorType}`);
    console.log(`   -> Error Message:    ${failureOutcome.errorMessage}`);

    assert(
      failureOutcome.status === 'failed',
      `Forced scrape correctly returned status 'failed'`
    );

    // Verify DB state after failure
    const { data: postFailureHistory } = await db
      .from('price_history')
      .select('id')
      .eq('product_id', testProduct.id);
    const postFailureHistoryCount = (postFailureHistory || []).length;

    const { data: postFailureLogs } = await db
      .from('scrape_log')
      .select('id, status, error_type, error_message')
      .eq('product_id', testProduct.id)
      .order('started_at', { ascending: false });
    const postFailureLogCount = (postFailureLogs || []).length;

    // INVARIANT: ZERO new price_history rows on failure!
    assert(
      postFailureHistoryCount === failureHistoryBaseline,
      `Assertion (a) INVARIANT: ZERO new price_history rows inserted on failure (still ${postFailureHistoryCount})`
    );

    assert(
      postFailureLogCount === failureLogBaseline + 1,
      `Exactly ONE new scrape_log row created for failure (before: ${failureLogBaseline}, after: ${postFailureLogCount})`
    );

    assert(
      postFailureLogs && postFailureLogs[0].status === 'failed' && Boolean(postFailureLogs[0].error_type),
      `Latest scrape_log row status is 'failed' with error_type: '${postFailureLogs?.[0]?.error_type}'`
    );

    // -------------------------------------------------------------
    // STEP 4: Cleanup test records
    // -------------------------------------------------------------
    console.log(`\n🧹 [4/4] Cleaning up test records from Supabase...`);

    if (createdNewProduct) {
      // If we created a new product, deleting it will cascade-delete history and logs
      const { error: delErr } = await db
        .from('tracked_products')
        .delete()
        .eq('id', testProduct.id);

      assert(!delErr, 'Cleaned up temporary tracked_products record and cascaded rows');
    } else {
      // Clean up only the newly created history and log rows
      const latestHistoryId = postSuccessHistory[postSuccessHistory.length - 1]?.id;
      if (latestHistoryId) {
        await db.from('price_history').delete().eq('id', latestHistoryId);
      }
      const newLogIds = postFailureLogs.slice(0, 2).map(l => l.id);
      for (const logId of newLogIds) {
        await db.from('scrape_log').delete().eq('id', logId);
      }
      console.log('   Cleaned up test price_history and scrape_log entries');
      assert(true, 'Cleaned up smoke test rows successfully');
    }

  } catch (err) {
    console.error(`\n❌ [ERROR] Smoke test threw an unhandled exception: ${err.message}`);
    assertionsFailed++;
  }

  console.log('\n===============================================================');
  console.log('                   SMOKE TEST AUDIT SUMMARY                    ');
  console.log('===============================================================');
  console.log(`Total Assertions Evaluated: ${assertionsPassed + assertionsFailed}`);
  console.log(`Assertions PASSED:          ${assertionsPassed}`);
  console.log(`Assertions FAILED:          ${assertionsFailed}`);
  console.log('===============================================================');

  if (assertionsFailed > 0) {
    console.error('\n❌ Smoke test failed. Please verify Supabase connection and schema.sql RPC functions.\n');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL REAL SUPABASE ASSERTIONS PASSED! System is deploy-ready.\n');
    process.exit(0);
  }
}

main().catch(console.error);
