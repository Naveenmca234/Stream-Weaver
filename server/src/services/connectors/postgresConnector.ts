import { Client } from 'pg';
import { DestinationConnector } from './connector';

export interface PostgresConfig {
  connectionString: string;
  tableName: string;
}

export class PostgresConnector implements DestinationConnector {
  private client: Client;
  private isTableCreated = false;

  constructor(private config: PostgresConfig) {
    this.client = new Client({ connectionString: config.connectionString });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async writeBatch(batch: any[]): Promise<void> {
    if (batch.length === 0) return;

    const columns = Object.keys(batch[0]);

    if (!this.isTableCreated) {
      const colsDef = columns.map(c => `"${c}" TEXT`).join(', ');
      await this.client.query(`CREATE TABLE IF NOT EXISTS "${this.config.tableName}" (${colsDef})`);
      this.isTableCreated = true;
    }

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO "${this.config.tableName}" ("${columns.join('", "')}") VALUES (${placeholders})`;

    await this.client.query('BEGIN');
    try {
      for (const row of batch) {
        const values = columns.map(c => row[c] === undefined ? null : String(row[c]));
        await this.client.query(query, values);
      }
      await this.client.query('COMMIT');
    } catch (err) {
      await this.client.query('ROLLBACK');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }
}
