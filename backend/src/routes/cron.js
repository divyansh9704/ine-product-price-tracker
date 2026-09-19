// backend/src/routes/cron.js
import { Router } from 'express';
import crypto from 'node:crypto';
import { executeBatchRun } from '../scraper/run-manager.js';

/**
 * Constant-time comparison of two strings to prevent timing attacks.
 */
function secureCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createCronRouter(db, config, scraperOptions = {}) {
  const router = Router();

  router.post('/cron/scrape', async (req, res) => {
    const cronSecret = req.headers['x-cron-secret'];
    const expectedSecret = config.cronSecret;

    if (!cronSecret || !secureCompare(cronSecret, expectedSecret)) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid or missing x-cron-secret header'
      });
    }

    // Acknowledge immediately with 202 Accepted so the cron provider never times out
    res.status(202).json({
      message: 'Scrape run queued successfully',
      acceptedAt: new Date().toISOString()
    });

    // Execute batch scrape in background
    executeBatchRun(db, scraperOptions).catch((err) => {
      console.error(`[CronScrape] Background batch execution error: ${err.message}`);
    });
  });

  return router;
}
