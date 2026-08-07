# Memory Profile

## Current Status

Large-file memory profiling has not started.

The current foundation does not contain the streaming upload or ETL pipeline, so recording large-file memory numbers now would be misleading.

## Metrics

Future Node.js profiling will record:

- rss
- heapTotal
- heapUsed
- external

using process.memoryUsage().

## Planned Tests

1. Small CSV
2. Approximately 1,500 rows
3. Approximately 50,000 rows
4. Approximately 100MB
5. Approximately 500MB
6. Approximately 1GB
7. Approximately 2GB

No benchmark result will be recorded until the corresponding test is actually performed.
