# StreamWeaver

## High-Throughput No-Code ETL Pipeline

StreamWeaver is a memory-safe ETL application built to process very large CSV datasets through streaming pipelines instead of loading entire files into Node.js or browser memory.

## Current Status

Development is complete through **Week 3**.

### Week 1 — Streaming Upload & Virtualized Preview
- Multipart CSV streaming with Busboy
- Direct stream-to-disk temporary storage
- Upload validation and cleanup
- Streaming CSV preview with `fs.createReadStream()` + `csv-parse`
- Preview bounded to 1,000 rows
- React virtualized preview grid
- Automated verification: **15/15 tests passed**

### Week 2 — Mapping & ETL Transform Streams
- Visual source-column → destination-field mapping
- Mapping validation
- CSV row-object Transform stream
- Mapping Transform stream
- Bounded mapped preview
- Automated verification: **7/7 tests passed**

### Mid-Project Performance Audit
A real **2 GB CSV** containing **30,246,247 rows** was tested.

| Metric | Result |
| --- | ---: |
| Dataset size | 2048 MB |
| Peak backend working set | **94.17 MB** |
| Required RAM target | < 150 MB |
| Upload duration | 28.88 s |
| Throughput | 70.91 MB/s |
| Preview rows | 1,000 |
| Preview generation | 0.194 s |
| Result | **PASS** |

Frontend virtualization was also verified with 1,000 preview records available while only 15 preview-row DOM elements were mounted during the test.

### Week 3 — Sandboxed Transformations & Live ETL Progress
- `isolated-vm` JavaScript sandbox
- Per-script memory limits and execution timeout
- Node.js globals such as `process`, `require`, and `Buffer` not exposed
- Infinite-loop protection with `SANDBOX_TIMEOUT`
- Streaming sandbox Transform
- Streaming progress Transform
- Socket.IO live job updates
- Rows processed, rows/sec, elapsed time and completion/failure state
- Live React processing dashboard
- Successful 1,500-row processing verification
- Production frontend lint/build verification

## Processing Architecture

```text
CSV upload
   ↓
Busboy multipart stream
   ↓
Temporary file on disk
   ↓
fs.createReadStream()
   ↓
csv-parse
   ↓
CSV row-object Transform
   ↓
Mapping Transform
   ↓
Sandbox Transform (optional)
   ↓
Progress Transform
   ↓
Live Socket.IO progress / bounded result handling
```

The current implementation deliberately avoids full-file buffering.

## Repository Structure

```text
Stream-Weaver/
├── client/          React + Vite frontend
├── server/          Node.js + Express streaming backend
├── docs/            Architecture, testing and benchmark evidence
├── sample-data/     Local verification datasets
├── scripts/         Week 1–3 tests and memory-audit scripts
├── .github/         CI and code-quality workflows
├── .gitignore
└── README.md
```

## Technology Stack

**Frontend**
- React
- Vite
- Axios
- React Router
- react-window
- Socket.IO Client
- Lucide React

**Backend**
- Node.js
- Express
- Native Node.js Streams
- Busboy
- csv-parse
- isolated-vm
- Socket.IO

## Local Setup

Install backend dependencies:

```powershell
cd server
npm install
```

Install frontend dependencies:

```powershell
cd ..\client
npm install
```

Create local environment files from the provided `.env.example` files. Never commit real credentials.

Start backend:

```powershell
cd server
npm run dev
```

Start frontend in a second terminal:

```powershell
cd client
npm run dev
```

## Verification

Backend sandbox tests:

```powershell
cd server
npm run test:sandbox
```

Frontend Week 3 realtime verification:

```powershell
cd client
npm run test:week3
```

Frontend quality/build:

```powershell
npm run lint
npm run build
```

Week 1, Week 2 and mid-project verification scripts are available under `scripts/`.

## Next Planned Phase

Week 4 will add persistent MongoDB ingestion using bounded `bulkWrite()` batches after the existing streaming, mapping, sandbox and realtime-processing layers are verified as the stable baseline.
