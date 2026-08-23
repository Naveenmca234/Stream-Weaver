import { runTransform } from '../sandboxService';

export default async function processBatch(data: {
  batch: any[];
  cleaning: any[];
  mappings: any[];
  transforms: any[];
  validations: any[];
}) {
  const { batch, cleaning, mappings, transforms, validations } = data;
  const processedBatch = [];

  for (const row of batch) {
    let outputRow: any = {};
    let failed = false;
    let failReason = '';

    // Apply Auto-Cleaning rules
    for (const rule of cleaning) {
      if (!rule.config) continue;
      const conf = JSON.parse(rule.config);
      if (row[conf.column] !== undefined && row[conf.column] !== null) {
        if (conf.operation === 'trim') {
          row[conf.column] = String(row[conf.column]).trim();
        } else if (conf.operation === 'uppercase') {
          row[conf.column] = String(row[conf.column]).toUpperCase();
        } else if (conf.operation === 'lowercase') {
          row[conf.column] = String(row[conf.column]).toLowerCase();
        } else if (conf.operation === 'extractNumbers') {
          const match = String(row[conf.column]).match(/\d+/g);
          row[conf.column] = match ? match.join('') : '';
        }
      }
    }

    // Apply Mappings
    for (const map of mappings) {
      const val = row[map.source_field];
      if (map.transform_rule) {
        const tconf = JSON.parse(map.transform_rule);
        if (tconf.customCode) {
          const res = await runTransform(tconf.customCode, val, row);
          if (res.success) {
            outputRow[map.target_field] = res.value;
          } else {
            failed = true;
            failReason = `Sandbox error on ${map.target_field}: ${res.error}`;
            break;
          }
        } else {
          outputRow[map.target_field] = val;
        }
      } else {
        outputRow[map.target_field] = val;
      }
    }

    // Apply Transforms
    if (!failed) {
      for (const rule of transforms) {
        if (!rule.config) continue;
        const conf = JSON.parse(rule.config);
        if (conf.customCode) {
          const res = await runTransform(conf.customCode, outputRow[conf.field], outputRow);
          if (res.success) outputRow[conf.field] = res.value;
          else {
            failed = true;
            failReason = `Transform error: ${res.error}`;
            break;
          }
        }
      }
    }

    // Apply Validations
    if (!failed) {
      for (const rule of validations) {
        const val = outputRow[rule.field];
        if (rule.rule_type === 'required' && (val === undefined || val === null || String(val).trim() === '')) {
          failed = true;
          failReason = `${rule.field} is required`;
          break;
        } else if (rule.rule_type === 'number' && isNaN(Number(val))) {
          failed = true;
          failReason = `${rule.field} must be a number`;
          break;
        }
      }
    }

    processedBatch.push({
      failed,
      failReason,
      row, // Original row (for failures)
      outputRow // Transformed row
    });
  }

  return processedBatch;
}
