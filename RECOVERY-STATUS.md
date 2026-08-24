# StreamWeaver Recovery Baseline

This branch preserves the verified StreamWeaver implementation through the end of Week 3.

## Week 1 — Streaming Upload + Virtualized Preview

- Busboy multipart CSV streaming
- Direct stream-to-disk temporary storage
- Upload validation and cleanup
- Streaming CSV preview using `fs.createReadStream()` + `csv-parse`
- Preview bounded to 1,000 rows
- React virtualized preview grid
- Week 1 automated verification completed previously: 15/15 tests passed

## Week 2 — Mapping + Transform Streams

- CSV row-object Transform stream
- Source-column → destination-field Mapping Transform
- Mapping validation
- Real mapped-preview backend API
- React mapping workspace
- Week 2 automated verification completed previously: 7/7 tests passed

## Mid-Project Review

Verified with a real 2 GB CSV dataset:

- 30,246,247 rows
- Peak backend working set: 94.17 MB
- Required target: under 150 MB
- Upload duration: 28.88 s
- Throughput: 70.91 MB/s
- Preview bounded to 1,000 rows
- Virtualized preview verified with only 15 mounted data-row DOM elements during the test

## Week 3 — Secure Transformations + Live Progress

- `isolated-vm` JavaScript sandbox
- Memory-capped sandbox execution
- Execution timeout protection
- `SANDBOX_TIMEOUT` handling for infinite loops
- Node.js globals such as `process`, `require`, and `Buffer` inaccessible inside the sandbox
- `SandboxTransform` in the ETL stream
- `ProgressTransform` with rows processed, rows/sec and elapsed time
- Socket.IO backend + frontend integration
- Live processing page
- Completed / failed job states
- Successful 1,500-row live processing verification
- Infinite-loop sandbox timeout verification
- Frontend production build verified

## Dependency Baseline

Backend includes:

- Express
- Busboy
- csv-parse
- isolated-vm
- Socket.IO

Frontend includes:

- React + Vite
- React Router
- Axios
- react-window
- socket.io-client

## Important

Use this branch as the recovery baseline for the original Week 1–Week 3 StreamWeaver implementation. Do not merge the unrelated rewritten `main` history directly into this branch.
