// backend/src/routes/store.js
import { Router } from 'express';
import { searchStoreCatalog } from '../services/store-catalog.js';

export function createStoreRouter(options = {}) {
  const router = Router();
  const baseUrl = options.baseUrl;
  const customFetch = options.fetch;

  router.get('/store/search', async (req, res, next) => {
    try {
      const query = req.query.q || '';
      const results = await searchStoreCatalog(query, { baseUrl, fetch: customFetch });
      res.json({
        query,
        count: results.length,
        items: results
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
