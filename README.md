# StreamWeaver

## High-Throughput No-Code ETL Pipeline

StreamWeaver is an advanced MERN data-engineering application being developed for the Infotact Solutions internship program.

The system is designed to process very large CSV and JSON datasets without loading complete files into browser or Node.js memory.

## Problem Statement

Traditional upload and ETL applications may exhaust browser memory or the Node.js V8 heap when processing massive datasets.

StreamWeaver will use streaming, bounded buffers, database bulk operations, and frontend virtualization to provide a memory-safe no-code ETL workflow.

## Target Product Flow

Upload Dataset
→ Preview Dataset
→ Map Columns
→ Configure Transformations
→ Configure Validation
→ Start ETL Job
→ Monitor Processing
→ Review Results and Failed Rows

## Technology Stack

### Frontend

- React
- Vite
- Axios
- React Router
- react-dropzone
- react-window or react-virtualized
- Socket.io Client

### Backend

- Node.js
- Express
- Native Node.js Streams
- Busboy
- Streaming CSV parser
- MongoDB
- MongoDB bulkWrite
- Socket.io
- isolated-vm in a later phase

## Completed

- React/Vite frontend
- Express backend
- Environment configuration
- CORS configuration
- Centralized API error responses
- GET /api/health
- Structured 404 handling
- React-to-Express connectivity
- Backend connected state
- Backend unavailable state
- Retry connection behaviour

## Not Yet Implemented

- Streaming CSV upload
- Temporary-file lifecycle
- Streaming CSV preview
- Dataset virtualization
- MongoDB integration
- Mapping
- Transform streams
- Validation
- WebSocket progress
- Bulk ingestion
- isolated-vm
- Authentication

## Development Location

A:\StreamWeaver

## Prerequisites

- Node.js 22.12 or newer
- Node.js 24 LTS recommended
- npm
- Git
- Visual Studio Code

MongoDB will be configured when required by the project phase.

## Running the Backend

cd A:\StreamWeaver\server
npm install
npm run dev

Backend:

http://localhost:5000

Health API:

http://localhost:5000/api/health

## Running the Frontend

cd A:\StreamWeaver\client
npm install
npm run dev

Frontend:

http://localhost:5173

## Environment Configuration

Backend environment:

NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173

Frontend environment:

VITE_API_BASE_URL=http://localhost:5000/api

Never commit real .env files.

## Performance Policy

No large-file benchmark will be claimed until the corresponding test has actually been performed.

The project will gradually progress from small CSV tests to approximately 2GB.

## Current Limitation

The current frontend verifies system connectivity.

It will be replaced by the real StreamWeaver application shell and streaming dataset-import workflow in the next implementation block.
