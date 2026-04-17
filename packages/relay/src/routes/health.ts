import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { getConnectedUserCount } from '../services/websocket.js';

const router = Router();

router.get('/', async (_req, res) => {
  let dbStatus = 'ok';
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      console.error('[health] DB error:', error.message, error.code, error.details);
      dbStatus = 'error';
    }
  } catch {
    dbStatus = 'error';
  }

  res.json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    database: dbStatus,
    websocket_connections: getConnectedUserCount(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
