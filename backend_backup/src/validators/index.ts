import { Transform, TransformCallback } from 'stream';
import { PipelineNode } from '../types';

export interface ValidationRuleResult {
  passed: boolean;
  field: string;
  value: unknown;
  error?: string;
}

function validateRequired(value: unknown, _config: Record<string, unknown>): boolean {
  return value !== null && value !== undefined && value !== '';
}

function validateType(value: unknown, config: Record<string, unknown>): boolean {
  const expectedType = config.expectedType as string;
  if (value === null || value === undefined || value === '') return true; // nullable
  switch (expectedType) {
    case 'integer': return /^-?\d+$/.test(String(value));
    case 'float': return !isNaN(parseFloat(String(value)));
    case 'boolean': return ['true', 'false', '1', '0'].includes(String(value).toLowerCase());
    case 'date': return !isNaN(Date.parse(String(value)));
    case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
    default: return true;
  }
}

function validateRegex(value: unknown, config: Record<string, unknown>): boolean {
  if (value === null || value === undefined || value === '') return true;
  try {
    const regex = new RegExp(config.pattern as string, (config.flags as string) || '');
    return regex.test(String(value));
  } catch {
    return false;
  }
}

function validateEmail(value: unknown, _config: Record<string, unknown>): boolean {
  if (value === null || value === undefined || value === '') return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
}

function validateRange(value: unknown, config: Record<string, unknown>): boolean {
  if (value === null || value === undefined || value === '') return true;
  const num = parseFloat(String(value));
  if (isNaN(num)) return false;
  if (config.min !== undefined && num < (config.min as number)) return false;
  if (config.max !== undefined && num > (config.max as number)) return false;
  return true;
}

function validateLength(value: unknown, config: Record<string, unknown>): boolean {
  if (value === null || value === undefined) return true;
  const len = String(value).length;
  if (config.min !== undefined && len < (config.min as number)) return false;
  if (config.max !== undefined && len > (config.max as number)) return false;
  return true;
}

export class ValidationStream extends Transform {
  private errorPolicy: 'fail_fast' | 'collect' | 'skip' | 'threshold';
  private errorThreshold: number;
  private totalProcessed = 0;
  private totalFailed = 0;

  constructor(
    private rules: Array<{
      type: string;
      field: string;
      config: Record<string, unknown>;
      errorMessage?: string;
    }>,
    private onRejected: (
      record: Record<string, unknown>,
      field: string,
      value: unknown,
      error: string
    ) => void,
    options: {
      policy?: 'fail_fast' | 'collect' | 'skip' | 'threshold';
      errorThreshold?: number;
    } = {}
  ) {
    super({ objectMode: true });
    this.errorPolicy = options.policy || 'collect';
    this.errorThreshold = options.errorThreshold || 5;
  }

  _transform(
    record: Record<string, unknown>,
    _enc: BufferEncoding,
    callback: TransformCallback
  ): void {
    this.totalProcessed++;
    const errors: ValidationRuleResult[] = [];

    for (const rule of this.rules) {
      const value = record[rule.field];
      let passed = true;
      let errorMsg = rule.errorMessage || '';

      switch (rule.type) {
        case 'required':
          passed = validateRequired(value, rule.config);
          if (!passed) errorMsg = errorMsg || `Field "${rule.field}" is required`;
          break;
        case 'type_check':
          passed = validateType(value, rule.config);
          if (!passed) errorMsg = errorMsg || `Field "${rule.field}" type mismatch`;
          break;
        case 'regex':
          passed = validateRegex(value, rule.config);
          if (!passed) errorMsg = errorMsg || `Field "${rule.field}" does not match pattern`;
          break;
        case 'email':
          passed = validateEmail(value, rule.config);
          if (!passed) errorMsg = errorMsg || `Field "${rule.field}" is not a valid email`;
          break;
        case 'range':
          passed = validateRange(value, rule.config);
          if (!passed) errorMsg = errorMsg || `Field "${rule.field}" out of range`;
          break;
        case 'length':
          passed = validateLength(value, rule.config);
          if (!passed) errorMsg = errorMsg || `Field "${rule.field}" length invalid`;
          break;
      }

      if (!passed) {
        errors.push({ passed: false, field: rule.field, value, error: errorMsg });
      }
    }

    if (errors.length > 0) {
      this.totalFailed++;
      const errorRate = (this.totalFailed / this.totalProcessed) * 100;

      for (const e of errors) {
        this.onRejected(record, e.field, e.value, e.error || 'Validation failed');
      }

      if (this.errorPolicy === 'fail_fast') {
        callback(new Error(`Validation failed: ${errors[0].error}`));
        return;
      }

      if (this.errorPolicy === 'threshold' && errorRate > this.errorThreshold) {
        callback(
          new Error(
            `Error threshold exceeded: ${errorRate.toFixed(1)}% > ${this.errorThreshold}%`
          )
        );
        return;
      }

      if (this.errorPolicy === 'skip') {
        // Drop the record
        callback();
        return;
      }

      // collect policy: pass the record through with error metadata
      record._validationErrors = errors.map((e) => e.error).join('; ');
    }

    this.push(record);
    callback();
  }
}

export function buildValidationFromNode(
  node: PipelineNode,
  onRejected: (
    record: Record<string, unknown>,
    field: string,
    value: unknown,
    error: string
  ) => void
): Transform | null {
  const data = node.data as Record<string, unknown>;
  const rule = {
    type: node.type.replace('_validation', ''),
    field: data.field as string,
    config: data as Record<string, unknown>,
    errorMessage: data.errorMessage as string | undefined,
  };

  return new ValidationStream([rule], onRejected, {
    policy: (data.policy as 'fail_fast' | 'collect' | 'skip' | 'threshold') || 'collect',
    errorThreshold: (data.errorThreshold as number) || 5,
  });
}
