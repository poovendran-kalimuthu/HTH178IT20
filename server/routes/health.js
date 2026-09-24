import express from 'express';
import { getPool, getDBStatus } from '../config/db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const startTime = Date.now();
  let dbLatency = null;
  let dbQueryOk = false;

  const pool = getPool();
  if (pool) {
    try {
      await pool.query('SELECT 1 + 1 AS ping');
      dbLatency = Date.now() - startTime;
      dbQueryOk = true;
    } catch (err) {
      dbLatency = null;
      dbQueryOk = false;
    }
  }

  const dbStatus = getDBStatus();

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    database: {
      ...dbStatus,
      pingOk: dbQueryOk,
      latencyMs: dbLatency
    }
  });
});

export default router;
