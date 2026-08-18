import { Transform, TransformCallback } from 'stream';
import { PipelineNode } from '../types';
import { SandboxService } from '../sandbox/SandboxService';
import { RejectedRecord } from '../models/RejectedRecord';

export interface TransformResult {
  record: Record<string, unknown> | null;
  rejected: boolean;
  reason?: string;
  field?: string;
}

export class MappingTransform extends Transform {
  constructor(private mappings: Array<{ source: string; destination: string }>) {
    super({ objectMode: true });
  }

  _transform(
    record: Record<string, unknown>,
    _enc: BufferEncoding,
    callback: TransformCallback
  ): void {
    const mapped: Record<string, unknown> = {};
    // Keep internal fields
    if (record._row !== undefined) mapped._row = record._row;

    if (this.mappings.length === 0) {
      // Pass through if no mappings defined
      this.push(record);
    } else {
      for (const m of this.mappings) {
        if (m.source in record) {
          mapped[m.destination] = record[m.source];
        }
      }
      this.push(mapped);
    }
    callback();
  }
}

export class TrimTransform extends Transform {
  constructor(private fields: string[]) {
    super({ objectMode: true });
  }

  _transform(
    record: Record<string, unknown>,
    _enc: BufferEncoding,
    callback: TransformCallback
  ): void {
    const result = { ...record };
    const targets = this.fields.length > 0 ? this.fields : Object.keys(result);
    for (const field of targets) {
      if (typeof result[field] === 'string') {
        result[field] = (result[field] as string).trim();
      }
    }
    this.push(result);
    callback();
  }
}

export class LowercaseTransform extends Transform {
  constructor(private fields: string[]) {
    super({ objectMode: true });
  }

  _transform(
    record: Record<string, unknown>,
    _enc: BufferEncoding,
    callback: TransformCallback
  ): void {
    const result = { ...record };
    const targets = this.fields.length > 0 ? this.fields : Object.keys(result);
    for (const field of targets) {
      if (typeof result[field] === 'string') {
        result[field] = (result[field] as string).toLowerCase();
      }
    }
    this.push(result);
    callback();
  }
}

export class UppercaseTransform extends Transform {
  constructor(private fields: string[]) {
    super({ objectMode: true });
  }

  _transform(
    record: Record<string, unknown>,
    _enc: BufferEncoding,
    callback: TransformCallback
  ): void {
    const result = { ...record };
    const targets = this.fields.length > 0 ? this.fields : Object.keys(result);
    for (const field of targets) {
      if (typeof result[field] === 'string') {
        result[field] = (result[field] as string).toUpperCase();
      }
    }
    this.push(result);
    callback();
  }
}

export class RenameTransform extends Transform {
  constructor(private renames: Array<{ from: string; to: string }>) {
    super({ objectMode: true });
  }

  _transform(
    record: Record<string, unknown>,
    _enc: BufferEncoding,
    callback: TransformCallback
  ): void {
    const result = { ...record };
    for (const r of this.renames) {
      if (r.from in result) {
        result[r.to] = result[r.from];
        delete result[r.from];
      }
    }
    this.push(result);
    callback();
  }
}

export class FilterTransform extends Transform {
  constructor(
    private field: string,
    private operator: string,
    private value: unknown
  ) {
    super({ objectMode: true });
  }

  _transform(
    record: Record<string, unknown>,
    _enc: BufferEncoding,
    callback: TransformCallback
  ): void {
    const fieldVal = record[this.field];
    let pass = true;

    switch (this.operator) {
      case 'eq': pass = fieldVal === this.value; break;
      case 'neq': pass = fieldVal !== this.value; break;
      case 'gt': pass = Number(fieldVal) > Number(this.value); break;
      case 'gte': pass = Number(fieldVal) >= Number(this.value); break;
      case 'lt': pass = Number(fieldVal) < Number(this.value); break;
      case 'lte': pass = Number(fieldVal) <= Number(this.value); break;
      case 'contains': pass = String(fieldVal).includes(String(this.value)); break;
      case 'notNull': pass = fieldVal !== null && fieldVal !== undefined && fieldVal !== ''; break;
    }

    if (pass) this.push(record);
    callback();
  }
}

export class NumberConversionTransform extends Transform {
  constructor(private fields: string[]) {
    super({ objectMode: true });
  }

  _transform(
    record: Record<string, unknown>,
    _enc: BufferEncoding,
    callback: TransformCallback
  ): void {
    const result = { ...record };
    const targets = this.fields.length > 0 ? this.fields : Object.keys(result);
    for (const field of targets) {
      const val = result[field];
      if (val !== null && val !== undefined && val !== '') {
        const num = Number(val);
        if (!isNaN(num)) result[field] = num;
      }
    }
    this.push(result);
    callback();
  }
}

export class ParseDateTransform extends Transform {
  constructor(private fields: string[], private format?: string) {
    super({ objectMode: true });
  }

  _transform(
    record: Record<string, unknown>,
    _enc: BufferEncoding,
    callback: TransformCallback
  ): void {
    const result = { ...record };
    for (const field of this.fields) {
      if (result[field]) {
        const d = new Date(String(result[field]));
        if (!isNaN(d.getTime())) {
          result[field] = d.toISOString();
        }
      }
    }
    this.push(result);
    callback();
  }
}

export class CustomJSTransform extends Transform {
  constructor(
    private field: string,
    private code: string,
    private runId: string,
    private onRejected: (record: Record<string, unknown>, reason: string) => void
  ) {
    super({ objectMode: true });
  }

  async _transform(
    record: Record<string, unknown>,
    _enc: BufferEncoding,
    callback: TransformCallback
  ): Promise<void> {
    try {
      const result = await SandboxService.execute(this.code, record[this.field], record);
      if (result.success) {
        const transformed = { ...record };
        transformed[this.field] = result.value;
        this.push(transformed);
      } else if (result.timedOut) {
        this.onRejected(record, `Sandbox timeout in field ${this.field}`);
        this.push(record); // Pass through on timeout to not crash pipeline
      } else {
        this.onRejected(record, `Sandbox error in field ${this.field}: ${result.error}`);
        this.push(record);
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.onRejected(record, `Transform error: ${error.message}`);
      this.push(record);
    }
    callback();
  }
}

export class DeduplicateTransform extends Transform {
  private seen = new Set<string>();

  constructor(private fields: string[]) {
    super({ objectMode: true });
  }

  _transform(
    record: Record<string, unknown>,
    _enc: BufferEncoding,
    callback: TransformCallback
  ): void {
    const key = this.fields.map((f) => String(record[f] ?? '')).join('::');
    if (!this.seen.has(key)) {
      this.seen.add(key);
      this.push(record);
    }
    callback();
  }

  _flush(callback: TransformCallback): void {
    this.seen.clear();
    callback();
  }
}

export function buildTransformFromNode(
  node: PipelineNode,
  runId: string,
  onRejected: (record: Record<string, unknown>, reason: string, field?: string) => void
): Transform | null {
  const data = node.data as Record<string, unknown>;

  switch (node.type) {
    case 'map_fields':
      return new MappingTransform(
        (data.mappings as Array<{ source: string; destination: string }>) || []
      );
    case 'trim':
      return new TrimTransform((data.fields as string[]) || []);
    case 'lowercase':
      return new LowercaseTransform((data.fields as string[]) || []);
    case 'uppercase':
      return new UppercaseTransform((data.fields as string[]) || []);
    case 'rename':
      return new RenameTransform(
        (data.renames as Array<{ from: string; to: string }>) || []
      );
    case 'filter':
      return new FilterTransform(
        data.field as string,
        data.operator as string,
        data.value
      );
    case 'number_conversion':
      return new NumberConversionTransform((data.fields as string[]) || []);
    case 'parse_date':
      return new ParseDateTransform((data.fields as string[]) || []);
    case 'custom_js':
      return new CustomJSTransform(
        data.field as string,
        data.code as string,
        runId,
        (record, reason) => onRejected(record, reason, data.field as string)
      );
    case 'deduplicate':
      return new DeduplicateTransform((data.fields as string[]) || []);
    default:
      return null;
  }
}
