import { Transform, TransformCallback } from 'stream';

export class NDJSONParserStream extends Transform {
  private buffer = '';
  private rowNumber = 0;

  constructor() {
    super({ readableObjectMode: true, writableObjectMode: false });
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.buffer += chunk.toString('utf8');
    const lines = this.buffer.split('\n');
    // Keep the last (potentially incomplete) line in buffer
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        this.rowNumber++;
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          this.push({ _row: this.rowNumber, ...parsed });
        } else {
          this.push({ _row: this.rowNumber, _value: parsed });
        }
      } catch {
        // Emit a parse error as a special record
        this.push({
          _row: this.rowNumber,
          _parseError: `Invalid JSON: ${trimmed.substring(0, 100)}`,
        });
      }
    }

    callback();
  }

  _flush(callback: TransformCallback): void {
    const trimmed = this.buffer.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        this.rowNumber++;
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          this.push({ _row: this.rowNumber, ...parsed });
        }
      } catch {
        // Skip incomplete final line
      }
    }
    callback();
  }

  getRowCount(): number {
    return this.rowNumber;
  }
}
