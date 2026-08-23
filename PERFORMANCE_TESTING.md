# StreamWeaver Performance Testing Guide

This guide explains how to test StreamWeaver's streaming and memory management capabilities with massive datasets.

## Quick Start

### 1. Generate Test Data

Generate a test CSV file with your desired number of rows (uses streaming, doesn't buffer the entire file in RAM):

```bash
# 100,000 rows (~25 MB)
node scripts/generate-test-csv.js --rows 100000

# 1,000,000 rows (~250 MB)
node scripts/generate-test-csv.js --rows 1000000

# 5,000,000 rows (~1.2 GB)
node scripts/generate-test-csv.js --rows 5000000

# 10,000,000 rows (~2.4 GB)
node scripts/generate-test-csv.js --rows 10000000 --output tmp/test-data-10m.csv
```

### 2. Start the Application

```bash
npm run dev
```

### 3. Run the ETL Pipeline

1. Open http://localhost:5173 in your browser.
2. Go to the **Upload** page and select the generated CSV file.
3. Configure your mapping and validation rules.
4. Click **Run Transformation**.
5. Navigate to the **History** tab to watch the live progress. The ETL pipeline runs in a background `worker_thread`.
6. Watch live progress metrics:
   - Progress percentage
   - Rows processed
   - Rows/sec throughput

## Memory Target

**Architecture Goal:**
- File Size: 10+ GB
- Peak Server RAM (RSS): **≤ 150 MB**
- Storage: Streamed directly to `storage/processed.csv`.

**How it achieves this:**
Unlike traditional CRUD apps that load datasets into arrays or database documents (like MongoDB), StreamWeaver streams the raw CSV file directly from disk, runs it through a `Transform` pipeline to apply sandboxed user scripts, and immediately pipes the output back to disk (`processed.csv`). Backpressure ensures the chunk size never exceeds Node's internal buffer.

## Expected Results

### Scenario 1: Baseline (100K rows, ~25 MB)
- **Time:** < 5 seconds
- **Peak Memory:** ~35 MB
- **Result:** Success

### Scenario 2: Large Load (5M rows, ~1.2 GB)
- **Time:** ~60-90 seconds
- **Peak Memory:** ~120 MB
- **Result:** Success

### Scenario 3: Stress Test (10M rows, ~2.4 GB)
- **Time:** ~180 seconds
- **Peak Memory:** ~130 MB
- **Result:** Success (Memory remains flat due to streaming)

## Troubleshooting

### WebSocket Progress Stops Updating
- Verify the server is running on port 5000.
- Check the terminal for worker thread crashes.

### Application Hangs
- Ensure you have enough disk space! A 10GB input file will generate a 10GB output file. The local filesystem (`storage/`) must have sufficient capacity.
