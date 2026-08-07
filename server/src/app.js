import cors from 'cors';
import express from 'express';

import env from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import healthRoutes from './routes/healthRoutes.js';

const app = express();

app.disable('x-powered-by');

const corsOptions = {
  origin(origin, callback) {
    if (!origin || origin === env.clientOrigin) {
      callback(null, true);
      return;
    }

    const error = new Error(
      'This origin is not allowed to access the API.',
    );

    error.statusCode = 403;
    error.code = 'CORS_ORIGIN_DENIED';

    callback(error);
  },
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
};

app.use(cors(corsOptions));

app.use(
  express.json({
    limit: '100kb',
  }),
);

app.get('/', (_request, response) => {
  response.status(200).json({
    success: true,
    message: 'StreamWeaver API',
    data: {
      healthEndpoint: '/api/health',
    },
  });
});

app.use('/api/health', healthRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;