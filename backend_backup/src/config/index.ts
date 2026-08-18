import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  wsPort: parseInt(process.env.WS_PORT || '4001', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/streamweaver',
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10737418240', 10),
  batchSize: parseInt(process.env.BATCH_SIZE || '5000', 10),
  sandbox: {
    timeout: parseInt(process.env.SANDBOX_TIMEOUT || '5000', 10),
    memoryMb: parseInt(process.env.SANDBOX_MEMORY || '128', 10),
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
};
