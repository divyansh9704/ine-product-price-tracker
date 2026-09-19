// backend/src/scraper/run-manager.js
// Coordinates multi-product scraping batches with concurrency control, run locking, and isolation.

import { getDb } from '../db/supabase.js';
import {
  CONCURRENCY_LIMIT,
  STALE_RUN_LOCK_MS
} from './constants.js';
import { scrapeProduct } from './scrape-product.js';

/**
 * Acquire run lock by checking for existing active runs.
 * Expires any stale run older than 10 minutes.
 */
export async function acquireRunLock(db, trigger) {
  const now = new Date();

  // 1. Check existing active runs
  const { data: runningRuns } = await db
    .from('scrape_runs')
    .select('*')
    .eq('status', 'running')
    .order('started_at', { ascending: false });

  if (runningRuns && runningRuns.length > 0) {
    for (const run of runningRuns) {
      const runStart = new Date(run.started_at).getTime();
      const ageMs = now.getTime() - runStart;

      if (ageMs > STALE_RUN_LOCK_MS) {
        // Expire stale lock
        await db
          .from('scrape_runs')
          .update({
            status: 'failed',
            finished_at: now.toISOString()
          })
          .eq('id', run.id);
      } else {
        // Fresh active run exists, refuse new run
        return {
          locked: true,
          activeRunId: run.id,
          ageMs
        };
      }
    }
  }

  // 2. Create new scrape_run record
  const { data: newRun, error } = await db
    .from('scrape_runs')
    .insert({
      trigger,
      started_at: now.toISOString(),
      status: 'running',
      products_total: 0,
      products_ok: 0,
      products_failed: 0
    })
    .select('id')
    .single();

  if (error || !newRun) {
    throw new Error(`Failed to create scrape_runs record: ${error?.message}`);
  }

  return { locked: false, runId: newRun.id };
}

/**
 * Release / finalize a scrape run record.
 */
export async function releaseRunLock(db, runId, summary) {
  await db
    .from('scrape_runs')
    .update({
      status: 'completed',
      finished_at: new Date().toISOString(),
      products_total: summary.total,
      products_ok: summary.ok,
      products_failed: summary.failed
    })
    .eq('id', runId);
}

/**
 * Simple async pool executing items with a concurrency limit.
 */
export async function poolAll(items, limit, workerFn) {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const promise = Promise.resolve().then(() => workerFn(item));
    results.push(promise);
    executing.add(promise);

    const clean = () => executing.delete(promise);
    promise.then(clean, clean);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

/**
 * Executes a full scheduled scrape run.
 * Amendment 1: Due when next_scrape_at <= now() + 10 minutes.
 */
export async function executeScheduledScrape(options = {}) {
  const db = options.db || getDb();
  const trigger = options.trigger || 'cron';
  const customFetch = options.fetch;
  const baseUrl = options.baseUrl;

  // 1. Acquire Run Lock
  const lockResult = await acquireRunLock(db, trigger);
  if (lockResult.locked) {
    return {
      status: 'skipped',
      reason: 'run_lock_active',
      activeRunId: lockResult.activeRunId
    };
  }

  const runId = lockResult.runId;

  // 2. Query products due for scraping
  // Amendment 1: a product is due when next_scrape_at <= now() + 10 minutes
  const dueCutoff = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  let products = [];
  if (options.productIds && options.productIds.length > 0) {
    const { data } = await db
      .from('tracked_products')
      .select('*')
      .in('id', options.productIds);
    products = data || [];
  } else {
    const { data } = await db
      .from('tracked_products')
      .select('*')
      .eq('is_active', true)
      .lte('next_scrape_at', dueCutoff);
    products = data || [];
  }

  const summary = {
    runId,
    total: products.length,
    ok: 0,
    failed: 0,
    skipped: 0,
    results: []
  };

  if (products.length === 0) {
    await releaseRunLock(db, runId, summary);
    return summary;
  }

  // 3. Process products with concurrency of 3
  // Per-product isolation: one failure never blocks others
  const worker = async (product) => {
    try {
      const result = await scrapeProduct(product, {
        db,
        trigger,
        runId,
        fetch: customFetch,
        baseUrl
      });

      if (result.status === 'success' || result.status === 'retried') {
        summary.ok++;
      } else if (result.status === 'skipped') {
        summary.skipped++;
      } else {
        summary.failed++;
      }

      summary.results.push(result);
    } catch (err) {
      summary.failed++;
      summary.results.push({
        productId: product.id,
        status: 'failed',
        errorMessage: err.message
      });
    }
  };

  await poolAll(products, CONCURRENCY_LIMIT, worker);

  // 4. Finalize scrape_runs
  await releaseRunLock(db, runId, summary);

  return summary;
}

export default {
  acquireRunLock,
  releaseRunLock,
  executeScheduledScrape,
  poolAll
};
