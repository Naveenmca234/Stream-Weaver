import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer as WSServer } from 'ws';
import mongoose from 'mongoose';
import fs from 'fs';
import pkg from '../package.json';

import { config } from './config';
import { errorHandler, notFound } from './middleware/error';
import { WebSocketServer } from './websocket/WebSocketServer';

import authRoutes from './routes/auth';
import datasetRoutes from './routes/datasets';
import pipelineRoutes from './routes/pipelines';
import runRoutes from './routes/runs';
import miscRoutes from './routes/misc';
import { authenticate } from './middleware/auth';
import { generateDemo } from './controllers/demoController';

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts' },
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Body parsing - NOTE: We don't parse multipart here; Busboy handles that in the controller
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/pipelines', pipelineRoutes);
app.use('/api/runs', runRoutes);
app.use('/api', miscRoutes);

// Demo endpoint
app.get('/api/demo/generate', authenticate, generateDemo);

// Error handling
app.use(notFound);
app.use(errorHandler);

// WebSocket setup
const wss = new WSServer({ server: httpServer });
WebSocketServer.getInstance().attach(wss);

// Memory monitoring broadcast
setInterval(() => {
  const mem = process.memoryUsage();
  WebSocketServer.getInstance().broadcast({
    type: 'system.metrics',
    payload: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
      arrayBuffers: Math.round(mem.arrayBuffers / 1024 / 1024),
      timestamp: new Date().toISOString(),
    },
  });
}, 5000);

// MongoDB connection
async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✓ MongoDB connected:', config.mongoUri);
  } catch (err) {
    console.error('✗ MongoDB connection failed:', (err as Error).message);
    console.log('  The application will start but database operations will fail.');
    console.log('  Please ensure MongoDB is running at:', config.mongoUri);
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected, attempting reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Start server
async function start(): Promise<void> {
  await connectDB();

  httpServer.listen(config.port, () => {
    console.log('\n🚀 StreamWeaver Backend');
    console.log('='.repeat(40));
    console.log(`  API Server:  http://localhost:${config.port}`);
    console.log(`  WebSocket:   ws://localhost:${config.port}`);
    console.log(`  MongoDB:     ${config.mongoUri}`);
    console.log(`  Upload Dir:  ${config.uploadDir}`);
    console.log(`  Version:     ${pkg.version}`);
    console.log(`  Batch Size:  ${config.batchSize} records`);
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log('='.repeat(40));
    console.log('\nReady to process streams ⚡\n');
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

export default app;
