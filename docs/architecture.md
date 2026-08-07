# StreamWeaver Architecture

## Current Foundation

React / Vite
    |
    | Axios
    v
Express API
    |
    +-- Environment configuration
    +-- CORS
    +-- Health route
    +-- 404 middleware
    +-- Central error handling

## Target Streaming Upload

Browser File
    |
    v
multipart/form-data
    |
    v
Busboy
    |
    v
Node.js readable stream
    |
    v
fs.WriteStream
    |
    v
Temporary file

The complete upload must never be buffered into Node.js memory.

## Target ETL Pipeline

fs.createReadStream()
    |
    v
Streaming Parser
    |
    v
Mapping Transform
    |
    v
Validation Transform
    |
    v
Safe Transformation
    |
    v
Bounded Batch Buffer
    |
    v
MongoDB bulkWrite
    |
    v
Progress Events

## Memory Safety Rules

- Never use fs.readFile for large datasets.
- Never store millions of rows in one array.
- Never use memory-based multipart storage for huge uploads.
- Respect stream backpressure.
- Keep preview buffers bounded.
- Keep MongoDB batches bounded.
- Release completed batches.
- Measure real memory usage before claiming performance.
