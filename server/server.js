import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import { initDB } from './config/db.js';
import { initWebSocketServer } from './services/esp32Socket.js';
import { startSheddingEngine } from './controllers/sheddingController.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend development
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  credentials: true
}));

// Body parser with 25MB limit for device image storage
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms`);
  });
  next();
});

// API Routes
app.use('/api', apiRouter);

// Root greeting
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Express + MySQL Backend API is running',
    documentation: '/api/health or /api/items',
    time: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server & Initialize Database
const startServer = async () => {
  console.log('Connecting to MySQL database...');
  await initDB();

  // Initialize WebSocket server attached to HTTP server
  initWebSocketServer(server);

  // Start LightGBM Realtime Shedding & Scheduling Automation Daemon
  startSheddingEngine();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=================================================`);
    console.log(`🚀 Express Server running on: http://localhost:${PORT}`);
    console.log(`📡 WebSocket endpoint:       ws://10.38.24.64:${PORT}/ws`);
    console.log(`🩺 Health check:            http://localhost:${PORT}/api/health`);
    console.log(`⚡ ESP32 status:            http://localhost:${PORT}/api/esp32/status`);
    console.log(`📦 Items endpoint:           http://localhost:${PORT}/api/items`);
    console.log(`=================================================\n`);
  });
};

startServer();
