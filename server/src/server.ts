import './loadEnv';
import express from 'express';
import { Server as TusServer } from '@tus/server';
import { FileStore } from '@tus/file-store';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes';
import uploadRoutes from './routes/uploadRoutes';
import profilingRoutes from './routes/profilingRoutes';
import importRoutes from './routes/importRoutes';
import validationRoutes from './routes/validationRoutes';
import transformedRoutes from './routes/transformedRoutes';
import cleaningRoutes from './routes/cleaningRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import workflowRoutes from './routes/workflowRoutes';
import triggerRoutes from './routes/triggerRoutes';
import { registerSocketHandlers } from './socket/socketHandler';
import { jobManager } from './workers/jobManager';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Make the Socket.IO server available to routes (req.app.get('io')) so the
// upload pipeline can emit live progress events as it processes a file.
app.set('io', io);
jobManager.setIo(io);

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/profiling', profilingRoutes);
app.use('/api/cleaning', cleaningRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/validations', validationRoutes);
app.use('/api/transformed', transformedRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/trigger', triggerRoutes);

const tusServer = new TusServer({
  path: '/uploads',
  datastore: new FileStore({ directory: path.resolve(__dirname, '../../storage/uploads') }),
});

app.all('/uploads', (req, res) => tusServer.handle(req, res));
app.all('/uploads/*', (req, res) => tusServer.handle(req, res));

// Serve the built React client when it's been built (npm run build), so
// the whole app can run from a single process with `npm start`.
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
import { db } from './storage/sqlite/database';
import { getMongoDb } from './storage/mongodb/database';

app.get('/api/health', async (req, res) => {
  let sqliteStatus = 'disconnected';
  let mongoStatus = 'disconnected';

  try {
    db.prepare('SELECT 1').get();
    sqliteStatus = 'connected';
  } catch (e) {
    sqliteStatus = 'error';
  }

  try {
    const mongo = getMongoDb();
    // Do a lightweight ping to verify it's still alive
    await mongo.command({ ping: 1 });
    mongoStatus = 'connected';
  } catch (e) {
    mongoStatus = 'error';
  }

  res.status((process.env.NODE_ENV === 'production' && (sqliteStatus !== 'connected' || mongoStatus !== 'connected')) ? 503 : 200).json({
    status: (sqliteStatus === 'connected' && mongoStatus === 'connected') ? 'ok' : 'degraded',
    mongodb: mongoStatus,
    sqlite: sqliteStatus
  });
});

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Client build not found. Run "npm run build" first, or use "npm run dev" for local development.');
  });
});

registerSocketHandlers(io);

import { initDb } from './storage/sqlite/database';
import { ArtifactStore } from './storage/filesystem/artifactStore';

const PORT = process.env.PORT || 5000;

import { connectMongo } from './storage/mongodb/database';

const startServer = async () => {
  try {
    // Initialize storage layers
    initDb();
    ArtifactStore.init();
    console.log('SQLite database and Filesystem storage initialized.');

    try {
      await connectMongo();
      console.log('MongoDB connected successfully.');
    } catch (dbErr: any) {
      if (process.env.NODE_ENV === 'production') {
        console.error('MongoDB connection failed and is required in production:', dbErr.message);
        process.exit(1);
      } else {
        console.warn('MongoDB unavailable; starting in degraded mode.');
      }
    }

    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, server };
