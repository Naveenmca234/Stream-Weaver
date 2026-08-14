import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';
import { AuthRequest } from './auth';

export function auditLog(action: string, resource: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      // Log after response is sent
      setImmediate(async () => {
        try {
          const resourceId =
            req.params?.id ||
            (typeof body === 'object' && body !== null
              ? (body as Record<string, unknown>)._id?.toString() ||
                (body as Record<string, unknown>).id?.toString()
              : undefined);

          await AuditLog.create({
            userId: req.user?.id,
            userEmail: req.user?.email,
            action,
            resource,
            resourceId,
            details: {
              method: req.method,
              path: req.path,
              query: req.query,
              body: req.method !== 'GET' ? '[redacted]' : undefined,
            },
            ip: req.ip,
            timestamp: new Date(),
          });
        } catch {
          // Audit log failures should not crash the app
        }
      });

      return originalJson(body);
    };

    next();
  };
}
