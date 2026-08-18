import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  fileSize: string;
  format: string;
  records: number;
  durationSec: number;
  recordsPerSec: number;
  mbPerSec: number;
  peakRssMb: number;
  peakHeapMb: number;
  batches: number;
  errors: number;
}

async function generateBenchmarkFile(
  filePath: string,
  rowCount: number,
  format: 'csv' | 'ndjson'
): Promise<number> {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);
    let written = 0;
    let i = 0;

    if (format === 'csv') {
      writeStream.write('id,name,email,age,score,created_at\n');
    }

    function writeChunk() {
      let keepGoing = true;
      while (i < rowCount && keepGoing) {
        i++;
        let line: string;
        if (format === 'csv') {
          line = `${i},User${i},user${i}@example.com,${20 + (i % 60)},${(Math.random() * 100).toFixed(2)},${new Date().toISOString()}\n`;
        } else {
          line =
            JSON.stringify({
              id: i,
              name: `User${i}`,
              email: `user${i}@example.com`,
              age: 20 + (i % 60),
              score: parseFloat((Math.random() * 100).toFixed(2)),
              created_at: new Date().toISOString(),
            }) + '\n';
        }
        written += line.length;
        keepGoing = writeStream.write(line);
      }

      if (i >= rowCount) {
        writeStream.end(() => resolve(written));
      } else {
        writeStream.once('drain', writeChunk);
      }
    }

    writeStream.on('error', reject);
    writeChunk();
  });
}

async function runBenchmark(rowCount: number, format: 'csv' | 'ndjson'): Promise<BenchmarkResult> {
  const tmpDir = path.join(process.cwd(), 'benchmark_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const filePath = path.join(tmpDir, `bench_${rowCount}.${format}`);

  console.log(`\n📊 Benchmark: ${rowCount.toLocaleString()} rows (${format.toUpperCase()})`);
  console.log('  Generating test file...');

  const fileBytes = await generateBenchmarkFile(filePath, rowCount, format);
  const fileSizeMb = fileBytes / 1024 / 1024;

  console.log(`  File size: ${fileSizeMb.toFixed(2)} MB`);
  console.log('  Processing stream...');

  const { CSVParserStream } = await import('../parsers/CSVParser');
  const { NDJSONParserStream } = await import('../parsers/NDJSONParser');
  const { Transform } = await import('stream');
  const { pipeline: streamPipeline } = await import('stream/promises');

  let processed = 0;
  let errors = 0;
  let batches = 0;
  let peakRss = 0;
  let peakHeap = 0;
  const batchSize = 5000;
  let batchCount = 0;

  const counter = new Transform({
    objectMode: true,
    transform(record, _enc, cb) {
      processed++;
      if (record._parseError) errors++;
      batchCount++;

      if (batchCount >= batchSize) {
        batches++;
        batchCount = 0;
      }

      const mem = process.memoryUsage();
      if (mem.rss > peakRss) peakRss = mem.rss;
      if (mem.heapUsed > peakHeap) peakHeap = mem.heapUsed;

      this.push(record);
      cb();
    },
  });

  const devNull = new Transform({
    objectMode: true,
    transform(_rec, _enc, cb) { cb(); },
  });

  const startTime = performance.now();

  const readStream = fs.createReadStream(filePath);
  const parser = format === 'csv' ? new CSVParserStream() : new NDJSONParserStream();

  await streamPipeline(readStream, parser, counter, devNull);

  const durationMs = performance.now() - startTime;
  const durationSec = durationMs / 1000;

  // Cleanup
  fs.unlinkSync(filePath);

  const result: BenchmarkResult = {
    fileSize: `${fileSizeMb.toFixed(2)} MB`,
    format: format.toUpperCase(),
    records: processed,
    durationSec: parseFloat(durationSec.toFixed(2)),
    recordsPerSec: Math.round(processed / durationSec),
    mbPerSec: parseFloat((fileSizeMb / durationSec).toFixed(2)),
    peakRssMb: Math.round(peakRss / 1024 / 1024),
    peakHeapMb: Math.round(peakHeap / 1024 / 1024),
    batches: batches + (batchCount > 0 ? 1 : 0),
    errors,
  };

  return result;
}

async function main() {
  console.log('\n🚀 StreamWeaver Benchmark Suite');
  console.log('='.repeat(50));

  const results: BenchmarkResult[] = [];

  const configs: Array<{ rows: number; format: 'csv' | 'ndjson' }> = [
    { rows: 10_000, format: 'csv' },
    { rows: 100_000, format: 'csv' },
    { rows: 100_000, format: 'ndjson' },
    { rows: 1_000_000, format: 'csv' },
  ];

  for (const cfg of configs) {
    try {
      const result = await runBenchmark(cfg.rows, cfg.format);
      results.push(result);

      console.log('\n  Results:');
      console.log(`    Records:      ${result.records.toLocaleString()}`);
      console.log(`    Duration:     ${result.durationSec}s`);
      console.log(`    Throughput:   ${result.recordsPerSec.toLocaleString()} records/sec`);
      console.log(`    Data rate:    ${result.mbPerSec} MB/sec`);
      console.log(`    Peak RSS:     ${result.peakRssMb} MB`);
      console.log(`    Peak Heap:    ${result.peakHeapMb} MB`);
      console.log(`    Batches:      ${result.batches}`);
      console.log(`    Errors:       ${result.errors}`);
    } catch (err) {
      console.error(`  Error: ${(err as Error).message}`);
    }
  }

  console.log('\n\n📈 Summary');
  console.log('='.repeat(80));
  console.log(
    'Format   | Records      | File Size | Duration | Records/sec | Peak RSS | Peak Heap'
  );
  console.log('-'.repeat(80));
  for (const r of results) {
    console.log(
      `${r.format.padEnd(8)} | ${String(r.records.toLocaleString()).padEnd(12)} | ${r.fileSize.padEnd(9)} | ${String(r.durationSec + 's').padEnd(8)} | ${String(r.recordsPerSec.toLocaleString()).padEnd(11)} | ${String(r.peakRssMb + ' MB').padEnd(8)} | ${r.peakHeapMb} MB`
    );
  }
  console.log('='.repeat(80));
  console.log('\n✓ Benchmark complete\n');
}

main().catch(console.error);
