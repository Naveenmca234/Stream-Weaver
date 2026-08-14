import { Router } from 'express';
import client from 'prom-client';

const router = Router();

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'streamweaver',
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Define custom metrics
export const rowsProcessedTotal = new client.Counter({
  name: 'streamweaver_rows_processed_total',
  help: 'Total number of rows processed by pipelines',
});

export const activePipelines = new client.Gauge({
  name: 'streamweaver_active_pipelines',
  help: 'Number of currently active pipeline runs',
});

export const bulkWriteDuration = new client.Histogram({
  name: 'streamweaver_bulkwrite_duration_seconds',
  help: 'Duration of MongoDB bulk writes in seconds',
  buckets: [0.1, 0.5, 1, 2, 5],
});

export const sandboxErrorsTotal = new client.Counter({
  name: 'streamweaver_sandbox_errors_total',
  help: 'Total number of errors encountered during sandbox execution',
});

register.registerMetric(rowsProcessedTotal);
register.registerMetric(activePipelines);
register.registerMetric(bulkWriteDuration);
register.registerMetric(sandboxErrorsTotal);

// Expose metrics route
router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

export const metricsRoutes = router;
