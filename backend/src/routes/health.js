// backend/src/routes/health.js
import { Router } from 'express';

export function createHealthRouter() {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'product-price-tracker-backend',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
    });
  });

  return router;
}
