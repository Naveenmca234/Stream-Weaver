import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');

const targetMb = Number(process.argv[2]);
const requestedOutput = process.argv[3];

if (!Number.isFinite(targetMb) || targetMb <= 0) {
  console.error('Usage: node scripts/generate-benchmark-csv.mjs <sizeMB> [outputPath]');
  process.exit(1);
}

const outputPath = requestedOutput
  ? path.resolve(requestedOutput)
  : path.join(projectRoot, 'benchmark-data', `streamweaver-${targetMb}mb.csv`);

const targetBytes = Math.floor(targetMb * 1024 * 1024);
const header = Buffer.from('employee_id,name,department,email,salary\n', 'utf8');
const row = Buffer.from(
  '1,Benchmark Employee,Engineering,benchmark.employee@example.test,42000\n',
  'utf8',
);

if (targetBytes <= header.length + row.length) {
  throw new Error('Target size is too small for a valid benchmark CSV.');
}

await mkdir(path.dirname(outputPath), { recursive: true });

const rowsPerChunk = 16384;
const chunk = Buffer.from(row.toString('utf8').repeat(rowsPerChunk), 'utf8');
const stream = createWriteStream(outputPath, {
  encoding: null,
  highWaterMark: 1024 * 1024,
});

let writtenBytes = 0;
let writtenRows = 0;

async function writeBuffer(buffer) {
  if (!stream.write(buffer)) {
    await once(stream, 'drain');
  }
  writtenBytes += buffer.length;
}

await writeBuffer(header);

while (writtenBytes + chunk.length <= targetBytes) {
  await writeBuffer(chunk);
  writtenRows += rowsPerChunk;
}

const remainingBytes = targetBytes - writtenBytes;
const remainingRows = Math.floor(remainingBytes / row.length);

if (remainingRows > 0) {
  const tail = Buffer.from(row.toString('utf8').repeat(remainingRows), 'utf8');
  await writeBuffer(tail);
  writtenRows += remainingRows;
}

stream.end();
await once(stream, 'finish');

const fileStats = await stat(outputPath);
const actualMb = fileStats.size / 1024 / 1024;

console.log(`Generated: ${outputPath}`);
console.log(`Rows: ${writtenRows}`);
console.log(`Bytes: ${fileStats.size}`);
console.log(`Size: ${actualMb.toFixed(2)} MB`);
