import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { parse } from 'csv-parse';
import ndjson from 'ndjson';

export interface ColumnProfile {
  name: string;
  totalCount: number;
  nullCount: number;
  minLength: number;
  maxLength: number;
  typeGuess: 'string' | 'number' | 'boolean' | 'date';
  distinctSamples: Set<string>;
}

export const generateDataProfile = async (filePath: string, sampleSize: number = 50000): Promise<Record<string, Omit<ColumnProfile, 'distinctSamples'> & { distinctSamples: string[] }>> => {
  const isCsv = filePath.endsWith('.csv');
  const profiles: Record<string, ColumnProfile> = {};
  let rowCount = 0;

  const parser = isCsv
    ? parse({ columns: true, skip_empty_lines: true, relax_column_count: true })
    : ndjson.parse();

  const fileStream = fs.createReadStream(filePath);

  const processRow = async function* (source: AsyncIterable<any>) {
    for await (const row of source) {
      rowCount++;
      if (rowCount > sampleSize) {
        fileStream.destroy(); // stop reading early
        break;
      }

      for (const [key, value] of Object.entries(row)) {
        if (!profiles[key]) {
          profiles[key] = {
            name: key,
            totalCount: 0,
            nullCount: 0,
            minLength: Infinity,
            maxLength: 0,
            typeGuess: 'string', // Default, we will refine
            distinctSamples: new Set()
          };
        }

        const profile = profiles[key];
        profile.totalCount++;

        const strVal = value === null || value === undefined ? '' : String(value).trim();
        
        if (!strVal) {
          profile.nullCount++;
        } else {
          const len = strVal.length;
          if (len < profile.minLength) profile.minLength = len;
          if (len > profile.maxLength) profile.maxLength = len;
          
          if (profile.distinctSamples.size < 5) {
            profile.distinctSamples.add(strVal);
          }
        }
      }
      yield row;
    }
  };

  try {
    await pipeline(fileStream, parser, processRow, async function* (source) {
      for await (const _ of source) {
        // drain
      }
    });
  } catch (err: any) {
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      console.error('Profile stream error:', err);
    }
  }

  // Refine types and format output
  const result: Record<string, any> = {};
  for (const [key, profile] of Object.entries(profiles)) {
    // Basic type guessing based on sample values
    let isNum = true;
    let isBool = true;
    let isDate = true;

    for (const val of profile.distinctSamples) {
      if (!val) continue;
      if (isNaN(Number(val))) isNum = false;
      if (!['true', 'false', '1', '0', 'yes', 'no'].includes(val.toLowerCase())) isBool = false;
      if (isNaN(Date.parse(val))) isDate = false;
    }

    if (profile.distinctSamples.size > 0) {
      if (isBool) profile.typeGuess = 'boolean';
      else if (isNum) profile.typeGuess = 'number';
      else if (isDate) profile.typeGuess = 'date';
    }

    if (profile.minLength === Infinity) profile.minLength = 0;

    result[key] = {
      ...profile,
      distinctSamples: Array.from(profile.distinctSamples)
    };
  }

  return result;
};
