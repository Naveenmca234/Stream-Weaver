import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function errorHandler(
  err: Error & { status?: number; code?: string },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status || 500;
  const isDev = config.nodeEnv === 'development';

  console.error('[ERROR]', {
    message: err.message,
    stack: isDev ? err.stack : undefined,
    url: req.url,
    method: req.method,
  });

  res.status(status).json({
    error:
      status === 500 && !isDev
        ? 'Internal server error'
        : err.message,
    ...(isDev && { stack: err.stack }),
  });
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}
