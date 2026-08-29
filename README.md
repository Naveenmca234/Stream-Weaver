# StreamWeaver

## High-Throughput No-Code ETL Pipeline

StreamWeaver is a memory-safe ETL application built to process very large CSV datasets through streaming pipelines instead of loading entire files into Node.js or browser memory.

## Current Status

The first-month implementation is complete through **Week 4**.

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
- Node.js globals such as `process`, `require`, and `Buffer` are not exposed
- Infinite-loop protection with `SANDBOX_TIMEOUT`
- Streaming sandbox Transform
- Streaming progress Transform
- Socket.IO live job updates
- Rows processed, rows/sec, elapsed time and completion/failure state
- Live React processing dashboard
- Sandbox verification: **10/10 tests passed**
- Realtime ETL verification: **6/6 tests passed**
- Production frontend lint/build verification

### Week 4 — MongoDB Bulk Ingestion & Validation
- MongoDB Atlas integration using the official Node.js driver
- Validation Transform for malformed/empty transformed rows
- Bounded MongoDB persistence with configurable **5,000-row batches**
- `bulkWrite()` ingestion with unordered writes
- Invalid rows excluded from MongoDB persistence without terminating the whole job
- Failed-row samples retained for the processing result UI
- Live Socket.IO updates include inserted rows, failed rows and batches written
- Processing dashboard shows MongoDB inserted count, validation failures, bulk batches and failed-row preview
- Automated Week 4 verification: **7/7 tests passed**
- UI validation proof: **5 processed, 3 inserted, 2 failed validation, 1 bounded batch**
- Frontend lint and production build passed

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
Validation Transform
   ↓
Progress Transform
   ↓
5,000-row bounded MongoDB buffer
   ↓
MongoDB bulkWrite()
   ↓
Socket.IO progress + final ingestion summary
```

The implementation avoids full-file buffering. The large-file upload/preview path and final MongoDB persistence path are both stream-oriented and bounded.

## Repository Structure

```text
Stream-Weaver/
├── client/          React + Vite frontend
├── server/          Node.js + Express streaming backend
├── docs/            Architecture, testing and benchmark evidence
├── sample-data/     Local verification datasets
├── scripts/         Week 1–3 verification and memory-audit scripts
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
- MongoDB Node.js Driver
- MongoDB Atlas

## Environment

Create `server/.env` from `server/.env.example`. Never commit real credentials.

Week 4 MongoDB configuration includes:

```text
MONGODB_URI=<your MongoDB connection string>
MONGODB_DATABASE=streamweaver
MONGODB_COLLECTION=ingested_rows
MONGODB_BATCH_SIZE=5000
```

## Local Setup

Install backend dependencies:

```powershell
cd server
npm ci
```

Install frontend dependencies:

```powershell
cd ..\client
npm ci
```

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

Week 1:

```powershell
.\scripts\week1-tests.ps1
```

Week 2:

```powershell
.\scripts\week2-tests.ps1
```

Week 3 sandbox:

```powershell
cd server
npm run test:sandbox
```

Week 3 realtime:

```powershell
cd client
$env:WEEK3_BACKEND_ORIGIN="http://localhost:5000"
npm run test:week3
```

Week 4 MongoDB bulk ingestion:

```powershell
cd server
npm run test:week4
```

Frontend quality/build:

```powershell
cd client
npm run lint
npm run build
```

## Verified First-Month Result

StreamWeaver now supports the complete first-month ETL flow:

```text
Upload large CSV
→ bounded preview
→ map destination fields
→ optional sandboxed JavaScript transformations
→ validate transformed rows
→ stream live processing progress
→ persist valid rows to MongoDB in bounded bulk batches
→ report inserted/failed rows and validation errors
```

Week 1 through Week 4 are complete and verified as the stable first-month baseline.
