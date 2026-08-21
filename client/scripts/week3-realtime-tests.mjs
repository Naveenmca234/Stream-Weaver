import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { io } from 'socket.io-client';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..', '..');
const samplePath = path.join(
  projectRoot,
  'sample-data',
  'employees-preview-limit.csv',
);

const backendOrigin =
  process.env.WEEK3_BACKEND_ORIGIN?.trim() ||
  'http://localhost:5001';

const apiBase = `${backendOrigin}/api`;
const socketOrigin = backendOrigin;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${name}`);
    console.error(`       ${error.message}`);
  }
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`${body?.error?.code || response.status}: ${body?.message || 'Request failed'}`);
  }

  return body.data ?? body;
}

let upload;
let job;
let progressEvents = 0;
let terminalSocketEvent = null;
let socket;

await test('Health API', async () => {
  const response = await fetch(`${apiBase}/health`);
  const body = await response.json();
  assert.equal(response.ok, true);
  assert.equal(body.success, true);
});

await test('Upload Week 3 sample dataset', async () => {
  const fileBytes = await readFile(samplePath);
  const form = new FormData();
  form.append(
    'file',
    new Blob([fileBytes], { type: 'text/csv' }),
    'employees-preview-limit.csv',
  );

  upload = await jsonRequest(`${apiBase}/files/upload`, {
    method: 'POST',
    body: form,
  });

  assert.ok(upload.uploadId);
});

await test('Socket.IO connection', async () => {
  socket = io(socketOrigin, {
    transports: ['websocket', 'polling'],
    reconnection: false,
    timeout: 5000,
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Socket.IO connection timed out.')),
      6000,
    );

    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  assert.equal(socket.connected, true);
});

await test('Start stream job with sandbox transformation', async () => {
  const mappings = [
    { sourceKey: 'employee_id', sourceIndex: 0, destinationField: 'employeeId' },
    { sourceKey: 'name', sourceIndex: 1, destinationField: 'name' },
    { sourceKey: 'department', sourceIndex: 2, destinationField: 'department' },
    { sourceKey: 'email', sourceIndex: 3, destinationField: 'email' },
    { sourceKey: 'salary', sourceIndex: 4, destinationField: 'salary' },
  ];

  job = await jsonRequest(
    `${apiBase}/files/${encodeURIComponent(upload.uploadId)}/process`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mappings,
        transformations: [
          {
            field: 'name',
            code: 'return String(value).trim().toUpperCase();',
          },
        ],
      }),
    },
  );

  assert.ok(job.jobId);
  assert.equal(job.status, 'queued');

  socket.emit('job:subscribe', job.jobId);

  socket.on('job:progress', (payload) => {
    if (payload?.jobId === job.jobId) {
      progressEvents += 1;
    }
  });

  socket.on('job:completed', (payload) => {
    if (payload?.jobId === job.jobId) {
      terminalSocketEvent = payload;
    }
  });

  socket.on('job:failed', (payload) => {
    if (payload?.jobId === job.jobId) {
      terminalSocketEvent = payload;
    }
  });
});

await test('Receive live progress and completion', async () => {
  const deadline = Date.now() + 20000;
  let current = null;

  while (Date.now() < deadline) {
    current = await jsonRequest(
      `${apiBase}/jobs/${encodeURIComponent(job.jobId)}`,
    );

    if (current.status === 'completed' || current.status === 'failed') {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  assert.ok(current, 'Job status was not available.');
  assert.equal(current.status, 'completed');
  assert.equal(current.progressPercent, 100);
  assert.ok(current.rowsProcessed >= 1000);
  assert.ok(current.successfulRows >= 1000);
  assert.ok(current.rowsPerSecond >= 0);

  await new Promise((resolve) => setTimeout(resolve, 250));

  assert.ok(
    progressEvents > 0 || terminalSocketEvent?.status === 'completed',
    'No realtime Socket.IO job event was observed.',
  );
});

await test('Backend survives completed Week 3 job', async () => {
  const response = await fetch(`${apiBase}/health`);
  const body = await response.json();
  assert.equal(response.ok, true);
  assert.equal(body.success, true);
});

if (socket) {
  socket.disconnect();
}

console.log('');
console.log('============================================');
console.log(' StreamWeaver Week 3 Realtime Verification');
console.log('============================================');
console.log(`Backend: ${backendOrigin}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Progress events observed: ${progressEvents}`);

if (failed === 0) {
  console.log('');
  console.log('WEEK 3 REALTIME VERIFICATION PASSED.');
  process.exit(0);
}

process.exit(1);
