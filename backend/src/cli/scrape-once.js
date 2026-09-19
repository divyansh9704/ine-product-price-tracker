// backend/src/cli/scrape-once.js
// CLI command: npm run scrape:once -- --product <id> [--dry-run]
// Executes one full scrape using the production scraper code path and outputs the result and log row.

import { parseArgs } from 'util';
import config from '../config.js';
import { getDb } from '../db/supabase.js';
import { fakeDb } from '../db/fake-db.js';
import { scrapeProduct } from '../scraper/scrape-product.js';

async function main() {
  const options = {
    product: { type: 'string', short: 'p' },
    'dry-run': { type: 'boolean', default: false }
  };

  let args;
  try {
    args = parseArgs({ options, allowPositionals: true }).values;
  } catch (err) {
    console.error(`❌ Argument error: ${err.message}`);
    console.log('Usage: npm run scrape:once -- --product <id> [--dry-run]');
    process.exit(1);
  }

  const productId = args.product;
  const isDryRun = Boolean(args['dry-run']);

  if (!productId) {
    console.error('❌ Error: Missing required argument --product <id>');
    console.log('Usage: npm run scrape:once -- --product <id> [--dry-run]');
    process.exit(1);
  }

  console.log(`\n🔍 Initiating single scrape for product: ${productId} ${isDryRun ? '([DRY-RUN] No DB writes)' : ''}`);
  console.log(`🌐 Target Store Base URL: ${config.storeBaseUrl}\n`);

  // First fetch product metadata from store to get title/details
  let productMeta = null;
  try {
    const metaRes = await fetch(`${config.storeBaseUrl}/api/product/${productId}`);
    if (metaRes.ok) {
      productMeta = await metaRes.json();
    }
  } catch (err) {
    console.warn(`⚠️ Could not fetch /api/product/${productId} metadata: ${err.message}`);
  }

  const productName = productMeta?.name || `Product #${productId}`;
  const storeProductId = String(productId);

  // In dry-run mode, we inject fakeDb so the production scrapeProduct logic runs
  // against the real upstream store, but writes are captured in-memory without polluting Supabase.
  const db = isDryRun ? fakeDb : getDb();

  // Ensure product exists in the DB context
  let productRecord = null;
  if (isDryRun) {
    productRecord = fakeDb.seedProduct({
      store_product_id: storeProductId,
      name: productName,
      url: `${config.storeBaseUrl}/product/${storeProductId}`,
      category: productMeta?.category || 'General'
    });
  } else {
    // Check if product exists in Supabase
    const { data: existing } = await db
      .from('tracked_products')
      .select('*')
      .eq('store_product_id', storeProductId)
      .single();

    if (existing) {
      productRecord = existing;
    } else {
      const { data: created, error } = await db
        .from('tracked_products')
        .insert({
          store_product_id: storeProductId,
          name: productName,
          url: `${config.storeBaseUrl}/product/${storeProductId}`,
          category: productMeta?.category || 'General',
          scrape_interval_minutes: 120
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to ensure product record in DB: ${error.message}`);
      }
      productRecord = created;
    }
  }

  // Execute scrape using production scraper path
  const startTime = Date.now();
  const scrapeResult = await scrapeProduct(productRecord, {
    db,
    trigger: 'cli',
    baseUrl: config.storeBaseUrl
  });
  const totalTime = Date.now() - startTime;

  // Retrieve the generated scrape_log record
  const { data: logs } = await db
    .from('scrape_log')
    .select('*')
    .eq('product_id', productRecord.id)
    .order('started_at', { ascending: false })
    .limit(1);

  const logRow = logs && logs[0] ? logs[0] : null;

  console.log('====================================================');
  console.log('                 SCRAPE RESULT                      ');
  console.log('====================================================');
  console.log(`Product ID:       ${productRecord.id}`);
  console.log(`Store Product ID: ${productRecord.store_product_id}`);
  console.log(`Product Name:     ${productName}`);
  console.log(`Status:           ${scrapeResult.status.toUpperCase()}`);
  console.log(`Attempts Used:    ${scrapeResult.attempts}`);
  console.log(`Duration:         ${totalTime} ms`);

  if (scrapeResult.quote) {
    const q = scrapeResult.quote;
    console.log(`\nPrice:            ₹${(q.priceCents / 100).toFixed(2)} (${q.priceCents} cents)`);
    console.log(`Currency:         ${q.currency}`);
    console.log(`Stock Status:     ${q.inStock ? 'IN STOCK' : 'OUT OF STOCK'} (${q.stockQuantity ?? 0} units)`);
    console.log(`MRP:              ${q.mrp ? '₹' + q.mrp : 'N/A'}`);
    console.log(`Discount Badge:   ${q.badgePct ? q.badgePct + '%' : 'N/A'}`);
    console.log(`Flagged:          ${scrapeResult.flagged ? 'YES (Volatility jump confirmed)' : 'NO'}`);
    console.log(`Variant:          ${q.variant}`);
  } else {
    console.log(`\nError Type:       ${scrapeResult.errorType}`);
    console.log(`Error Message:    ${scrapeResult.errorMessage}`);
  }

  console.log('\n----------------------------------------------------');
  console.log('                 AUDIT SCRAPE LOG ROW               ');
  console.log('----------------------------------------------------');
  console.log(JSON.stringify(logRow, null, 2));
  console.log('====================================================\n');

  return { scrapeResult, logRow };
}

main().catch(err => {
  console.error('❌ Fatal error during scrape:once execution:', err);
  process.exit(1);
});
