import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import * as mongoDb from '../storage/mongodb/database.js';
import * as sqliteDb from '../storage/sqlite/database.js';

// Mock the database modules
vi.mock('../storage/mongodb/database.js', () => ({
  getMongoDb: vi.fn(),
  connectMongo: vi.fn(),
  isMongoConnected: vi.fn()
}));

vi.mock('../storage/sqlite/database.js', () => ({
  db: {
    prepare: vi.fn(() => ({
      get: vi.fn()
    }))
  },
  initDb: vi.fn()
}));

describe('Health Endpoint (/api/health)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('should return 200 and ok when both SQLite and MongoDB are connected', async () => {
    // Mock SQLite success
    const mockSqliteGet = vi.fn().mockReturnValue({ 1: 1 });
    (sqliteDb.db.prepare as any).mockReturnValue({ get: mockSqliteGet });

    // Mock MongoDB success
    const mockMongoCommand = vi.fn().mockResolvedValue({ ok: 1 });
    (mongoDb.getMongoDb as any).mockReturnValue({ command: mockMongoCommand });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      mongodb: 'connected',
      sqlite: 'connected'
    });
  });

  it('should return 200 and degraded when MongoDB is disconnected in development', async () => {
    process.env.NODE_ENV = 'development';

    // Mock SQLite success
    const mockSqliteGet = vi.fn().mockReturnValue({ 1: 1 });
    (sqliteDb.db.prepare as any).mockReturnValue({ get: mockSqliteGet });

    // Mock MongoDB failure
    (mongoDb.getMongoDb as any).mockImplementation(() => {
      throw new Error('MongoDB is not connected');
    });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'degraded',
      mongodb: 'error',
      sqlite: 'connected'
    });
  });

  it('should return 503 when MongoDB is disconnected in production', async () => {
    process.env.NODE_ENV = 'production';

    // Mock SQLite success
    const mockSqliteGet = vi.fn().mockReturnValue({ 1: 1 });
    (sqliteDb.db.prepare as any).mockReturnValue({ get: mockSqliteGet });

    // Mock MongoDB failure
    (mongoDb.getMongoDb as any).mockImplementation(() => {
      throw new Error('MongoDB is not connected');
    });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'degraded',
      mongodb: 'error',
      sqlite: 'connected'
    });
  });
});
