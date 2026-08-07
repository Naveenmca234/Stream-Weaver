# Testing

## Week 1 Foundation Tests

### Backend

Verified:

- Express starts successfully
- GET /api/health returns HTTP 200
- Correct health response is returned
- Unknown API route returns structured HTTP 404
- Backend remains operational after invalid requests

### Frontend

Verified:

- Vite frontend starts
- Frontend requests GET /api/health
- Checking connection state works
- Backend connected state works
- Backend unavailable state works
- Retry connection works
- Connection recovers when backend restarts

## Production Build Test

Run:

cd A:\StreamWeaver\client
npm run build

The build must complete without errors.

## Upcoming Week 1 Tests

Tests for multipart streaming, interrupted uploads, CSV preview, malformed input, and dataset virtualization will be added with those modules.
