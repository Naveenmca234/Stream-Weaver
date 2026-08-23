import { createWriteStream, WriteStream } from 'node:fs';
import { stringify } from 'csv-stringify';
import { DestinationConnector } from './connector';

export class CsvConnector implements DestinationConnector {
  private outStream: WriteStream | null = null;
  private stringifier: any | null = null;
  private isFirstBatch = true;
  private columns: string[] = [];

  constructor(private outPath: string) {}

  async connect(): Promise<void> {
    this.outStream = createWriteStream(this.outPath);
  }

  async writeBatch(batch: any[]): Promise<void> {
    if (!this.outStream) throw new Error('Not connected');
    if (batch.length === 0) return;
    
    if (this.isFirstBatch) {
      this.columns = Object.keys(batch[0]);
      this.stringifier = stringify({ header: true, columns: this.columns });
      this.stringifier.pipe(this.outStream);
      this.isFirstBatch = false;
    }

    for (const row of batch) {
      this.stringifier.write(row);
    }
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.stringifier && !this.outStream) {
        return resolve();
      }
      if (this.outStream) {
        this.outStream.on('finish', resolve);
        this.outStream.on('error', reject);
      }
      if (this.stringifier) {
        this.stringifier.end();
      } else if (this.outStream) {
        this.outStream.end();
      }
    });
  }
}
