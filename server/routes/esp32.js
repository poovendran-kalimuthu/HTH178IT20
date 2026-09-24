import express from 'express';
import { getEsp32State, sendCommandToEsp32 } from '../services/esp32Socket.js';

const router = express.Router();

/**
 * GET /api/esp32/status
 * Returns current ESP32 connection status, latest telemetry & ping
 */
router.get('/status', (req, res) => {
  const state = getEsp32State();
  res.json({
    success: true,
    data: state
  });
});

/**
 * POST /api/esp32/command
 * Send command down to ESP32 via WebSocket
 */
router.post('/command', (req, res) => {
  const { command, payload } = req.body;
  if (!command) {
    return res.status(400).json({ success: false, error: 'Command is required' });
  }

  const result = sendCommandToEsp32({ command, payload, sentAt: new Date().toISOString() });
  if (result.success) {
    res.json({ success: true, message: `Command '${command}' sent to ESP32` });
  } else {
    res.status(503).json({ success: false, error: result.error });
  }
});

export default router;
