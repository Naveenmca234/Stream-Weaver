# API Response Format Guidelines

All API endpoints should follow this standardized response format.

## Success Response

```json
{
  "success": true,
  "data": {
    // Response payload
  },
  "timestamp": "2024-08-17T10:30:45.123Z",
  "path": "/api/datasets"
}
```

## Error Response

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  },
  "timestamp": "2024-08-17T10:30:45.123Z",
  "path": "/api/datasets"
}
```

## Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET, PUT, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE or HEAD |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (missing auth) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 409 | Conflict (e.g., duplicate resource) |
| 422 | Unprocessable entity |
| 429 | Too many requests (rate limited) |
| 500 | Internal server error |
| 503 | Service unavailable |

## Common Error Codes

| Code | Meaning |
|------|---------|
| VALIDATION_ERROR | Request validation failed |
| UNAUTHORIZED | Authentication required or failed |
| FORBIDDEN | User lacks permission |
| NOT_FOUND | Resource not found |
| CONFLICT | Resource already exists |
| RATE_LIMIT_EXCEEDED | Too many requests |
| DATABASE_ERROR | Database operation failed |
| FILE_ERROR | File upload/processing failed |
| TIMEOUT_ERROR | Operation timed out |

## Pagination

```json
{
  "success": true,
  "data": [
    // Items array
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## List Query Parameters

- `page=1` - Page number (1-indexed)
- `limit=20` - Items per page
- `sort=createdAt:desc` - Sort field and direction
- `filter[field]=value` - Field filters

## Example: Get Datasets

```bash
GET /api/datasets?page=1&limit=20&sort=createdAt:desc&filter[status]=active
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Employee Data",
      "status": "active",
      "recordCount": 1000,
      "createdAt": "2024-08-17T10:30:45.123Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  },
  "timestamp": "2024-08-17T10:30:45.123Z"
}
```

## Async Operations

For long-running operations, return a job ID immediately:

```json
{
  "success": true,
  "data": {
    "jobId": "job_507f1f77bcf86cd799439011",
    "status": "processing",
    "estimatedTime": 30000
  }
}
```

Then provide a status endpoint:

```bash
GET /api/jobs/{jobId}
```

```json
{
  "success": true,
  "data": {
    "jobId": "job_507f1f77bcf86cd799439011",
    "status": "completed",
    "progress": 100,
    "result": {
      // Result data
    }
  }
}
```

## WebSocket Events

Event format:
```json
{
  "type": "event_type",
  "data": {
    // Event data
  },
  "timestamp": "2024-08-17T10:30:45.123Z"
}
```

Examples:
- `pipeline:started` - Pipeline execution started
- `pipeline:progress` - Pipeline progress update
- `pipeline:completed` - Pipeline execution completed
- `pipeline:error` - Pipeline execution error
- `dataset:uploaded` - Dataset uploaded
- `validation:error` - Validation error found

## Implementation Example

```typescript
// Success response
res.json({
  success: true,
  data: { id: '123', name: 'My Dataset' },
  timestamp: new Date().toISOString(),
  path: req.path,
});

// Error response
res.status(400).json({
  success: false,
  error: {
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: errors,
  },
  timestamp: new Date().toISOString(),
  path: req.path,
});

// Pagination response
res.json({
  success: true,
  data: items,
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: Math.ceil(150 / 20),
  },
  timestamp: new Date().toISOString(),
  path: req.path,
});
```
