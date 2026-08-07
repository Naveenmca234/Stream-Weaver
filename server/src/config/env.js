import dotenv from 'dotenv';

dotenv.config();

const port = Number.parseInt(process.env.PORT || '5000', 10);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error('PORT must be a valid port number.');
}

const clientOrigin = process.env.CLIENT_ORIGIN?.trim();

if (!clientOrigin) {
  throw new Error('CLIENT_ORIGIN environment variable is required.');
}

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port,
  clientOrigin,
});

export default env;