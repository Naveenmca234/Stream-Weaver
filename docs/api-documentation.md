# API Documentation

## GET /api/health

Checks whether the StreamWeaver backend is operational.

### Success

HTTP 200

{
  "success": true,
  "message": "StreamWeaver backend is running",
  "timestamp": "ISO timestamp"
}

## Unknown Route

Example:

GET /api/anything

HTTP 404

{
  "success": false,
  "message": "The requested API route was not found.",
  "error": {
    "code": "ROUTE_NOT_FOUND",
    "details": []
  }
}

## Standard Success Response

{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}

## Standard Error Response

{
  "success": false,
  "message": "Human-readable error",
  "error": {
    "code": "ERROR_CODE",
    "details": []
  }
}

Streaming file APIs will be documented when they are implemented.
