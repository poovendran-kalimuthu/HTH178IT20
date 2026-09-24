import express from 'express';
import {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  getStats
} from '../controllers/itemController.js';
import healthRouter from './health.js';
import esp32Router from './esp32.js';
import devicesRouter from './devices.js';
import portsRouter from './ports.js';
import sheddingRouter from './shedding.js';

const router = express.Router();

// Mount health router at /api/health
router.use('/health', healthRouter);

// Mount ESP32 router at /api/esp32
router.use('/esp32', esp32Router);

// Mount Devices router at /api/devices (Local MySQL storage + Realtime events)
router.use('/devices', devicesRouter);

// Mount Ports router at /api/ports (Arduino Hardware Mapping & Port Configuration)
router.use('/ports', portsRouter);

// Mount Load Shedding & Scheduling router at /api/shedding
router.use('/shedding', sheddingRouter);

// Metrics & Stats
router.get('/stats', getStats);

// Item CRUD routes
router.get('/items', getItems);
router.get('/items/:id', getItemById);
router.post('/items', createItem);
router.put('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);

export default router;
