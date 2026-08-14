import { Transform, TransformCallback } from 'stream';
import { parse } from 'csv-parse';

export class CSVParserStream extends Transform {
  private parser: ReturnType<typeof parse>;
  private headerRow: string[] | null = null;
  private rowNumber = 0;
  private buffer = '';

  constructor() {
    super({ readableObjectMode: true, writableObjectMode: false });

    this.parser = parse({
      relaxColumnCount: true,
      skipEmptyLines: true,
      trim: true,
      bom: true,
    });

    this.parser.on('readable', () => {
      let record: string[];
      while ((record = this.parser.read()) !== null) {
        if (this.headerRow === null) {
          this.headerRow = record.map((h: string) => h.trim());
        } else {
          this.rowNumber++;
          const obj: Record<string, string> = {};
          for (let i = 0; i < this.headerRow.length; i++) {
            obj[this.headerRow[i]] = record[i] ?? '';
          }
          this.push({ _row: this.rowNumber, ...obj });
        }
      }
    });

    this.parser.on('error', (err) => {
      this.emit('error', err);
    });
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.parser.write(chunk, callback as (error?: Error | null) => void);
  }

  _flush(callback: TransformCallback): void {
    this.parser.end(() => {
      callback();
    });
  }

  getRowCount(): number {
    return this.rowNumber;
  }
}
