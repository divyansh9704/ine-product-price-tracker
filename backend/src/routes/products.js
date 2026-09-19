// backend/src/routes/products.js
import { Router } from 'express';
import { z } from 'zod';
import { scrapeProduct } from '../scraper/scrape-product.js';

const productSchema = z.object({
  storeProductId: z.coerce.number().int().positive(),
  name: z.string().min(1).max(255),
  category: z.string().max(100).optional().nullable(),
  imageUrl: z.string().url().or(z.string().max(500)).optional().nullable(),
  description: z.string().optional().nullable(),
  scrapeIntervalMinutes: z.coerce.number().int().positive().default(120).refine(
    val => val % 120 === 0,
    { message: 'scrapeIntervalMinutes must be a multiple of 120 (e.g. 120, 240, 360)' }
  )
});

const patchSchema = z.object({
  scrapeIntervalMinutes: z.coerce.number().int().positive().optional().refine(
    val => val === undefined || val % 120 === 0,
    { message: 'scrapeIntervalMinutes must be a multiple of 120' }
  ),
  isActive: z.boolean().optional()
});

export function createProductsRouter(db, scraperOptions = {}) {
  const router = Router();

  /**
   * Helper: Resolve product by id (UUID or numeric store_product_id)
   */
  async function resolveProduct(idParam) {
    // Try UUID match
    let res = await db.from('tracked_products').select('*').eq('id', idParam).maybeSingle();
    if (res.data) return res.data;

    // Try store_product_id match
    const num = parseInt(idParam, 10);
    if (!Number.isNaN(num)) {
      res = await db.from('tracked_products').select('*').eq('store_product_id', num).maybeSingle();
      if (res.data) return res.data;
    }
    return null;
  }

  // GET /api/products - List all tracked products with current status
  router.get('/products', async (req, res, next) => {
    try {
      const { data: products, error } = await db
        .from('tracked_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Attach latest price quote to each product
      const enriched = await Promise.all((products || []).map(async (prod) => {
        const { data: latestHistory } = await db
          .from('price_history')
          .select('*')
          .eq('product_id', prod.id)
          .order('scraped_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: latestLog } = await db
          .from('scrape_log')
          .select('status, started_at, error_type')
          .eq('product_id', prod.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...prod,
          latestPriceCents: latestHistory?.price_cents ?? null,
          latestPrice: latestHistory ? latestHistory.price_cents / 100 : null,
          currency: latestHistory?.currency ?? null,
          inStock: latestHistory?.in_stock ?? null,
          stockQuantity: latestHistory?.stock_quantity ?? null,
          lastScrapedAt: latestHistory?.scraped_at ?? prod.last_scraped_at ?? null,
          lastStatus: latestLog?.status ?? 'never_scraped'
        };
      }));

      res.json({ products: enriched });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/products - Track a new product
  router.post('/products', async (req, res, next) => {
    try {
      const parsed = productSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.issues
        });
      }

      const { storeProductId, name, category, imageUrl, description, scrapeIntervalMinutes } = parsed.data;

      // Check deduplication
      const { data: existing } = await db
        .from('tracked_products')
        .select('*')
        .eq('store_product_id', storeProductId)
        .maybeSingle();

      if (existing) {
        if (existing.is_active) {
          return res.status(409).json({
            error: 'Product is already actively tracked',
            product: existing
          });
        }

        // Reactivate inactive product
        const { data: reactivated, error: reactivateErr } = await db
          .from('tracked_products')
          .update({
            is_active: true,
            scrape_interval_minutes: scrapeIntervalMinutes,
            next_scrape_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select('*')
          .single();

        if (reactivateErr) throw reactivateErr;

        // Trigger immediate background scrape
        scrapeProduct(db, storeProductId, scraperOptions).catch((err) => {
          console.error(`[Scraper] Initial scrape error for reactivated product ${storeProductId}: ${err.message}`);
        });

        return res.status(200).json({ product: reactivated });
      }

      // Insert new product
      const { data: created, error: createErr } = await db
        .from('tracked_products')
        .insert({
          store_product_id: storeProductId,
          name,
          category: category || null,
          image_url: imageUrl || null,
          description: description || null,
          scrape_interval_minutes: scrapeIntervalMinutes,
          next_scrape_at: new Date().toISOString(),
          is_active: true
        })
        .select('*')
        .single();

      if (createErr) throw createErr;

      // Trigger immediate background scrape so the user sees price data immediately
      scrapeProduct(db, storeProductId, scraperOptions).catch((err) => {
        console.error(`[Scraper] Initial scrape error for new product ${storeProductId}: ${err.message}`);
      });

      res.status(201).json({ product: created });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/products/:id - Detailed product view with summary statistics
  router.get('/products/:id', async (req, res, next) => {
    try {
      const product = await resolveProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Fetch all price history entries for stats calculation
      const { data: history } = await db
        .from('price_history')
        .select('*')
        .eq('product_id', product.id)
        .order('scraped_at', { ascending: true });

      const priceList = (history || []).map(h => h.price_cents / 100);
      let stats = null;

      if (priceList.length > 0) {
        const minPrice = Math.min(...priceList);
        const maxPrice = Math.max(...priceList);
        const avgPrice = Math.round((priceList.reduce((a, b) => a + b, 0) / priceList.length) * 100) / 100;
        const currentPrice = priceList[priceList.length - 1];
        const firstPrice = priceList[0];
        const changePercent = firstPrice > 0 ? Math.round(((currentPrice - firstPrice) / firstPrice) * 10000) / 100 : 0;
        const latestEntry = history[history.length - 1];

        stats = {
          currentPrice,
          currency: latestEntry.currency,
          inStock: latestEntry.in_stock,
          stockQuantity: latestEntry.stock_quantity,
          minPrice,
          maxPrice,
          avgPrice,
          priceChangePercent: changePercent,
          dataPointsCount: priceList.length,
          firstScrapedAt: history[0].scraped_at,
          lastScrapedAt: latestEntry.scraped_at
        };
      }

      // Fetch scrape log summary
      const { data: logs } = await db
        .from('scrape_log')
        .select('status')
        .eq('product_id', product.id);

      const totalScrapes = (logs || []).length;
      const successfulScrapes = (logs || []).filter(l => l.status === 'success' || l.status === 'retried').length;
      const successRate = totalScrapes > 0 ? Math.round((successfulScrapes / totalScrapes) * 1000) / 10 : 0;

      res.json({
        product,
        stats,
        scrapeSummary: {
          totalScrapes,
          successfulScrapes,
          successRate
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/products/:id - Update interval or active state
  router.patch('/products/:id', async (req, res, next) => {
    try {
      const product = await resolveProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      }

      const updates = {};
      if (parsed.data.scrapeIntervalMinutes !== undefined) {
        updates.scrape_interval_minutes = parsed.data.scrapeIntervalMinutes;
      }
      if (parsed.data.isActive !== undefined) {
        updates.is_active = parsed.data.isActive;
      }

      const { data: updated, error } = await db
        .from('tracked_products')
        .update(updates)
        .eq('id', product.id)
        .select('*')
        .single();

      if (error) throw error;
      res.json({ product: updated });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/products/:id - Delete tracked product
  router.delete('/products/:id', async (req, res, next) => {
    try {
      const product = await resolveProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const { error } = await db
        .from('tracked_products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;
      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/products/:id/history - Price and stock time-series history
  router.get('/products/:id/history', async (req, res, next) => {
    try {
      const product = await resolveProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
      const { data: history, error } = await db
        .from('price_history')
        .select('*')
        .eq('product_id', product.id)
        .order('scraped_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      res.json({
        productId: product.id,
        count: (history || []).length,
        history: history || []
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/products/:id/logs - Detailed scrape logs
  router.get('/products/:id/logs', async (req, res, next) => {
    try {
      const product = await resolveProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

      const { data: logs, error } = await db
        .from('scrape_log')
        .select('*')
        .eq('product_id', product.id)
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      res.json({
        productId: product.id,
        limit,
        offset,
        count: (logs || []).length,
        logs: logs || []
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/products/:id/scrape - Immediate manual scrape
  router.post('/products/:id/scrape', async (req, res, next) => {
    try {
      const product = await resolveProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const outcome = await scrapeProduct(db, product.store_product_id, scraperOptions);
      res.json({
        success: outcome.status === 'success' || outcome.status === 'retried',
        outcome
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
