import { Router } from 'express';
import * as monitoring from '../controllers/monitoringController';
import * as connections from '../controllers/connectionController';
import * as sandbox from '../controllers/sandboxController';
import * as schedules from '../controllers/scheduleController';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();

// Monitoring
router.get('/monitoring', authenticate, authorize('view_monitoring'), monitoring.getMonitoringMetrics);
router.get('/health', monitoring.getHealth);
router.get('/audit-logs', authenticate, authorize('view_monitoring'), monitoring.getAuditLogs);

// Connections
router.get('/connections', authenticate, authorize('manage_connections'), connections.listConnections);
router.post('/connections', authenticate, authorize('manage_connections'), auditLog('connection_created', 'connection'), connections.createConnection);
router.post('/connections/:id/test', authenticate, authorize('manage_connections'), auditLog('connection_tested', 'connection'), connections.testConnection);
router.delete('/connections/:id', authenticate, authorize('manage_connections'), connections.deleteConnection);

// Sandbox
router.post('/sandbox/execute', authenticate, sandbox.executeTransform);
router.post('/sandbox/validate', authenticate, sandbox.validateCode);

// Schedules
router.get('/schedules', authenticate, schedules.listSchedules);
router.post('/schedules', authenticate, authorize('create_pipeline'), schedules.createSchedule);
router.put('/schedules/:id', authenticate, authorize('edit_pipeline'), schedules.updateSchedule);
router.delete('/schedules/:id', authenticate, authorize('delete_pipeline'), schedules.deleteSchedule);

export default router;
