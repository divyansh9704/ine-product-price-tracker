// backend/src/routes/alerts.js
import { Router } from 'express';

export function createAlertsRouter(db) {
  const router = Router();

  router.get('/alerts', async (req, res, next) => {
    try {
      const onlyUnack = req.query.unacknowledged === 'true';
      let query = db.from('alerts').select('*').order('created_at', { ascending: false }).limit(50);

      if (onlyUnack) {
        query = query.eq('acknowledged', false);
      }

      const { data, error } = await query;
      if (error) throw error;

      res.json({
        count: (data || []).length,
        alerts: data || []
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/alerts/:id/ack', async (req, res, next) => {
    try {
      const { id } = req.params;
      const { data, error } = await db
        .from('alerts')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      res.json({ alert: data });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
