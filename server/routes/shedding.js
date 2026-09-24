import express from 'express';
import {
  getConfig,
  updateConfig,
  getSchedules,
  createSchedule,
  deleteSchedule,
  getHistory,
  triggerAction,
  getRecommendationHistory,
  recordRecommendationDecision
} from '../controllers/sheddingController.js';

const router = express.Router();

router.get('/config', getConfig);
router.put('/config', updateConfig);

router.get('/schedules', getSchedules);
router.post('/schedules', createSchedule);
router.delete('/schedules/:id', deleteSchedule);

router.get('/history', getHistory);
router.post('/action', triggerAction);

router.get('/recommendations/history', getRecommendationHistory);
router.post('/recommendations/decision', recordRecommendationDecision);

export default router;
