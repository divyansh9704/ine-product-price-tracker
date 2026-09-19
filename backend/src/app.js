// backend/src/app.js
// Express application factory supporting dependency injection for testing.

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { createHealthRouter } from './routes/health.js';
import { createStoreRouter } from './routes/store.js';
import { createProductsRouter } from './routes/products.js';
import { createCronRouter } from './routes/cron.js';
import { createAlertsRouter } from './routes/alerts.js';

export function createApp(dependencies = {}) {
  const { db, config = {}, scraperOptions = {} } = dependencies;

  const app = express();

  // Render reverse-proxy trust for rate-limiting
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // CORS configuration
  const allowedOrigin = config.frontendOrigin || process.env.FRONTEND_ORIGIN || '*';
  app.use(cors({
    origin: allowedOrigin === '*' ? '*' : allowedOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret']
  }));

  // Body parser
  app.use(express.json({ limit: '1mb' }));

  // General rate limiter (exclude health check)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/api/health'
  });
  app.use(limiter);

  // Health check routes
  const healthRouter = createHealthRouter();
  app.use(healthRouter);
  app.use('/api', healthRouter);

  // API Routes
  if (db) {
    app.use('/api', createStoreRouter(scraperOptions));
    app.use('/api', createProductsRouter(db, scraperOptions));
    app.use('/api', createCronRouter(db, config, scraperOptions));
    app.use('/api', createAlertsRouter(db));
  }

  // 404 Not Found Handler
  app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // Global Error Handler
  app.use((err, req, res, next) => {
    const status = err.status || err.httpStatus || 500;
    const message = err.message || 'Internal Server Error';
    if (status >= 500) {
      console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);
    }
    res.status(status).json({
      error: message,
      type: err.errorType || null
    });
  });

  return app;
}
