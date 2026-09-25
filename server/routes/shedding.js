import express from 'express';
import {
  getConfig,
  updateConfig,
  getSchedules,
  createSchedule,
  deleteSchedule,
  toggleScheduleStatus,
  triggerScheduleNow,
  getHistory,
  triggerAction,
  getRecommendationHistory,
  recordRecommendationDecision,
  getLgbPredictions
} from '../controllers/sheddingController.js';

const router = express.Router();

router.get('/config', getConfig);
router.put('/config', updateConfig);

router.get('/schedules', getSchedules);
router.post('/schedules', createSchedule);
router.delete('/schedules/:id', deleteSchedule);
router.patch('/schedules/:id/toggle', toggleScheduleStatus);
router.post('/schedules/:id/run-now', triggerScheduleNow);

router.get('/history', getHistory);
router.post('/action', triggerAction);

router.get('/recommendations/history', getRecommendationHistory);
router.post('/recommendations/decision', recordRecommendationDecision);

// LightGBM Peak Prediction & Shedding Analysis Endpoint
router.get('/predict-lgb', getLgbPredictions);

export default router;
