import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Connection } from '../models/Connection';
import mongoose from 'mongoose';

export async function listConnections(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const connections = await Connection.find()
      .populate('createdBy', 'name email')
      .select('-config.password -config.connectionString');
    res.json(connections);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function createConnection(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { name, type, config: connConfig } = req.body;
    if (!name || !type || !connConfig) {
      res.status(400).json({ error: 'name, type, and config are required' });
      return;
    }

    const connection = await Connection.create({
      name,
      type,
      config: connConfig,
      status: 'untested',
      createdBy: req.user!.id,
    });

    // Don't return password
    const safe = connection.toObject();
    if (safe.config?.password) safe.config.password = '[hidden]';

    res.status(201).json(safe);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function testConnection(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    let success = false;
    let message = '';
    const startTime = Date.now();

    try {
      if (connection.type === 'mongodb') {
        const uri = connection.config.uri as string;
        const testClient = new mongoose.mongo.MongoClient(uri, {
          serverSelectionTimeoutMS: 5000,
        });
        await testClient.connect();
        await testClient.db().admin().ping();
        await testClient.close();
        success = true;
        message = 'Connection successful';
      } else if (connection.type === 'rest_api') {
        const url = connection.config.url as string;
        const resp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
        success = resp.ok;
        message = `HTTP ${resp.status}`;
      } else {
        message = `Connection type ${connection.type} test not yet implemented`;
        success = false;
      }
    } catch (err: unknown) {
      const error = err as Error;
      message = error.message;
    }

    const latencyMs = Date.now() - startTime;

    await Connection.findByIdAndUpdate(req.params.id, {
      status: success ? 'connected' : 'failed',
      lastTestedAt: new Date(),
    });

    res.json({ success, message, latencyMs });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function deleteConnection(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    await Connection.findByIdAndDelete(req.params.id);
    res.json({ message: 'Connection deleted' });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}
