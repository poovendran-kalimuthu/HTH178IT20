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

const router = express.Router();

// Mount health router at /api/health
router.use('/health', healthRouter);

// Mount ESP32 router at /api/esp32
router.use('/esp32', esp32Router);

// Metrics & Stats
router.get('/stats', getStats);

// Item CRUD routes
router.get('/items', getItems);
router.get('/items/:id', getItemById);
router.post('/items', createItem);
router.put('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);

export default router;
