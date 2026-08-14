import { FieldSchema, FieldType, DatasetSchema } from '../types';

const PII_PATTERNS = [
  /\bemail\b/i,
  /\bphone\b/i,
  /\bssn\b/i,
  /\bpassword\b/i,
  /\bcredit.?card\b/i,
  /\bcc.?num\b/i,
  /\bsocial.?security\b/i,
  /\bdate.?of.?birth\b/i,
  /\bdob\b/i,
  /\baddress\b/i,
  /\bzip\b/i,
  /\bpostcode\b/i,
  /\bip.?address\b/i,
  /\bpassport\b/i,
  /\bnatid\b/i,
];

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/,
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
  /^\d{1,2}-\d{1,2}-\d{4}$/,
];

function inferType(value: string): FieldType {
  if (value === '' || value === 'null' || value === 'NULL' || value === 'N/A') return 'null';
  if (value === 'true' || value === 'false' || value === 'TRUE' || value === 'FALSE') return 'boolean';
  if (/^-?\d+$/.test(value)) return 'integer';
  if (/^-?\d+\.\d+$/.test(value)) return 'float';
  for (const pattern of DATE_PATTERNS) {
    if (pattern.test(value)) return 'date';
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return 'array';
    if (typeof parsed === 'object' && parsed !== null) return 'object';
  } catch {
    // Not JSON
  }
  return 'string';
}

function dominantType(types: FieldType[]): FieldType {
  const counts: Partial<Record<FieldType, number>> = {};
  for (const t of types) {
    if (t !== 'null') counts[t] = (counts[t] || 0) + 1;
  }
  let max = 0;
  let dominant: FieldType = 'string';
  for (const [type, count] of Object.entries(counts) as [FieldType, number][]) {
    if (count > max) {
      max = count;
      dominant = type;
    }
  }
  return dominant;
}

export interface SchemaAccumulator {
  fieldNames: string[];
  fieldData: Map<
    string,
    {
      types: FieldType[];
      values: string[];
      nullCount: number;
      valuesSet: Set<string>;
      min?: string | number;
      max?: string | number;
    }
  >;
  sampleSize: number;
}

export function createAccumulator(): SchemaAccumulator {
  return {
    fieldNames: [],
    fieldData: new Map(),
    sampleSize: 0,
  };
}

export function accumulateRecord(
  acc: SchemaAccumulator,
  record: Record<string, string>,
  maxSamples = 10000
): void {
  // Initialize fields from first record
  if (acc.fieldNames.length === 0) {
    for (const key of Object.keys(record)) {
      if (key.startsWith('_')) continue;
      acc.fieldNames.push(key);
      acc.fieldData.set(key, {
        types: [],
        values: [],
        nullCount: 0,
        valuesSet: new Set(),
        min: undefined,
        max: undefined,
      });
    }
  }

  if (acc.sampleSize >= maxSamples) return;
  acc.sampleSize++;

  for (const key of acc.fieldNames) {
    const val = String(record[key] ?? '');
    const fd = acc.fieldData.get(key)!;
    const type = inferType(val);
    fd.types.push(type);

    if (type === 'null') {
      fd.nullCount++;
    } else {
      if (fd.values.length < 10) fd.values.push(val);
      fd.valuesSet.add(val);

      // Track min/max for numeric fields
      if (type === 'integer' || type === 'float') {
        const num = parseFloat(val);
        if (fd.min === undefined || num < (fd.min as number)) fd.min = num;
        if (fd.max === undefined || num > (fd.max as number)) fd.max = num;
      }
    }
  }
}

export function buildSchema(acc: SchemaAccumulator): DatasetSchema {
  const fields: FieldSchema[] = [];

  for (const name of acc.fieldNames) {
    const fd = acc.fieldData.get(name)!;
    const total = fd.types.length;
    const nullPct = total > 0 ? (fd.nullCount / total) * 100 : 0;
    const inferredType = dominantType(fd.types);

    fields.push({
      name,
      type: inferredType,
      nullable: nullPct > 0,
      nullPercentage: Math.round(nullPct * 100) / 100,
      uniqueCount: fd.valuesSet.size,
      min: fd.min,
      max: fd.max,
      sampleValues: fd.values.slice(0, 5),
      isPotentialPii: PII_PATTERNS.some((p) => p.test(name)),
    });
  }

  return {
    fields,
    totalFields: fields.length,
    sampleSize: acc.sampleSize,
    detectedAt: new Date(),
  };
}
