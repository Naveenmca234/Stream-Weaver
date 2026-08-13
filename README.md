# StreamWeaver

## High-Throughput No-Code ETL Pipeline

StreamWeaver is a MERN-oriented data-engineering application developed for the Infotact Solutions internship program. Its core goal is to process very large CSV datasets using streaming and bounded-memory techniques instead of loading complete files into browser or Node.js memory.

## Current Project Status

### Week 1 — Streaming Upload and Virtualized Preview ✅

Completed:

- React + Vite application shell
- Express backend and health API
- Structured API error responses
- Busboy multipart CSV streaming
- Direct stream-to-disk temporary storage
- UUID-based server filenames
- Configurable upload limits
- Empty-file, invalid-extension and multiple-file rejection
- Interrupted/incomplete upload cleanup
- Temporary upload lifecycle
- `fs.createReadStream()` CSV preview pipeline
- Streaming CSV parsing with `csv-parse`
- Header detection
- Preview bounded to a maximum of 1,000 rows
- `hasMoreRows` detection
- Malformed CSV handling
- Column-count mismatch warnings
- Header-only CSV handling
- UTF-8/BOM support
- React virtualized preview grid
- Responsive professional import/preview UI
- Automated backend verification: **15/15 tests passed**

### Week 2 — Mapping and ETL Transform Streams ✅

Completed:

- Visual source-column → destination-field mapping workflow
- Mapping configuration validation
- Duplicate destination-field rejection
- Missing source-column validation
- Invalid destination-field validation
- CSV row-object Transform stream
- Mapping Transform stream
- Bounded transformed-row preview
- Real backend mapping preview API
- Preview → Mapping workflow integration
- Automated Week 2 verification: **7/7 tests passed**

### Mid-Project Review — 2GB Performance Audit ✅

A real **2GB CSV** was generated and processed locally through the streaming upload pipeline.

Measured result:

| Metric | Result |
| --- | ---: |
| Dataset size | 2048 MB |
| Generated rows | 30,246,247 |
| Baseline backend working set | 63.26 MB |
| Peak backend working set | **94.17 MB** |
| Working-set increase | 30.91 MB |
| Peak private memory | 98.37 MB |
| Upload duration | 28.88 s |
| Throughput | 70.91 MB/s |
| Preview rows returned | 1,000 |
| Additional rows detected | Yes |
| Preview generation time | 0.194 s |
| Required RAM target | < 150 MB |
| Result | **PASS** |

Frontend virtualization was also verified with **1,000 preview rows available while only 15 `.preview-data-row` elements were mounted in the DOM** during the test.

The raw benchmark result is stored in:

```text
docs/benchmarks/memory-audit.csv
```

## Current Architecture

```text
Browser CSV
    ↓
multipart/form-data
    ↓
Busboy
    ↓
Node.js Readable Stream
    ↓
fs.WriteStream
    ↓
Temporary UUID.csv
    ↓
fs.createReadStream()
    ↓
csv-parse streaming parser
    ↓
Row Object Transform
    ↓
Mapping Transform
    ↓
Bounded preview / mapped preview
```

The project deliberately avoids reading the complete dataset into one array or one large Buffer.

## Product Flow

Current working flow:

```text
Upload Dataset
    ↓
Preview Dataset
    ↓
Map Columns
    ↓
Test Mapping Pipeline
```

Planned full flow:

```text
Upload Dataset
    ↓
Preview Dataset
    ↓
Map Columns
    ↓
Configure Transformations
    ↓
Configure Validation
    ↓
Start ETL Job
    ↓
Monitor Live Progress
    ↓
Bulk Ingest to MongoDB
    ↓
Review Results and Failed Rows
```

## Technology Stack

### Frontend

- React
- Vite
- Axios
- React Router
- react-dropzone
- react-window
- Lucide React

### Backend

- Node.js
- Express
- Native Node.js Streams
- Busboy
- csv-parse
- Transform streams

### Planned Later Phases

- Socket.IO / WebSocket live processing progress
- isolated-vm sandboxed JavaScript transformations
- MongoDB
- MongoDB `bulkWrite()` batching
- Validation/rejection pipeline
- Job history and failed-row review
- Authentication
- JSON streaming support

## Repository Structure

```text
Stream-Weaver/
├── client/
├── server/
├── docs/
│   └── benchmarks/
├── sample-data/
├── scripts/
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js 22.12+
- Node.js 24 LTS recommended
- npm
- Git
- Visual Studio Code or another editor

MongoDB is intentionally not required yet because persistent ETL ingestion belongs to a later project phase.

## Local Setup

Clone the repository and install dependencies:

```powershell
git clone https://github.com/Naveenmca234/Stream-Weaver.git
cd Stream-Weaver

cd server
npm install

cd ..\client
npm install
```

Create local environment files:

```powershell
cd ..
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

Never commit real `.env` files.

## Run the Backend

```powershell
cd server
npm run dev
```

Backend:

```text
http://localhost:5000
```

Health API:

```text
http://localhost:5000/api/health
```

## Run the Frontend

```powershell
cd client
npm run dev
```

Frontend:

```text
http://localhost:5173
```

## Automated Verification

### Week 1

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\week1-tests.ps1
```

Expected status:

```text
Passed: 15
Failed: 0
```

### Week 2

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\week2-tests.ps1
```

Expected status:

```text
Passed: 7
Failed: 0
```

### Mid-Project Memory Audit

The audit script supports progressive tests:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\midproject-memory-audit.ps1 -TargetMB 100
powershell -ExecutionPolicy Bypass -File .\scripts\midproject-memory-audit.ps1 -TargetMB 500
powershell -ExecutionPolicy Bypass -File .\scripts\midproject-memory-audit.ps1 -TargetMB 1024
powershell -ExecutionPolicy Bypass -File .\scripts\midproject-memory-audit.ps1 -TargetMB 2048
```

Large benchmark source files and temporary server uploads are excluded from Git.

## Memory-Safety Rules

- Do not use `fs.readFile()` for large datasets.
- Do not accumulate complete datasets in JavaScript arrays.
- Do not use memory-based multipart storage for very large uploads.
- Respect Node.js stream backpressure.
- Keep preview buffers bounded.
- Keep future MongoDB write batches bounded.
- Release completed batches as soon as possible.
- Measure real memory usage before making performance claims.

## Current Limitations

The current implementation intentionally has the following limitations because the corresponding company phases have not started yet:

- Upload metadata is stored in memory and is lost when the backend restarts.
- Uploaded CSV files are temporary local files.
- MongoDB persistence is not implemented yet.
- Sandboxed JavaScript transformations are not implemented yet.
- WebSocket live job progress is not implemented yet.
- Validation rules and failed-row persistence are not implemented yet.
- Authentication is not implemented yet.
- JSON streaming support is not implemented yet.

## Next Phase

The next development phase is **Week 3**:

- Sandboxed inline JavaScript transformations using `isolated-vm`
- Real-time ETL progress over WebSocket / Socket.IO
- Progress bar
- Rows processed
- Rows processed per second
- Processing state and completion/failure events

MongoDB bulk ingestion will be added only in the later phase where it is officially required.

---

**Current milestone:** Week 1 ✅ · Week 2 ✅ · Mid-Project Review ✅ · Week 3 next
