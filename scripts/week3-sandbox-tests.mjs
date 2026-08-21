import assert from 'node:assert/strict';

import {
  Readable,
  Writable,
} from 'node:stream';

import {
  pipeline,
} from 'node:stream/promises';

import {
  executeSandboxTransformation,
} from '../server/src/services/sandboxService.js';

import {
  SandboxTransform,
} from '../server/src/streams/sandboxTransform.js';

let passed = 0;
let failed = 0;

async function test(
  name,
  fn,
) {
  try {
    await fn();

    passed += 1;

    console.log(
      `[PASS] ${name}`,
    );
  } catch (error) {
    failed += 1;

    console.error(
      `[FAIL] ${name}`,
    );

    console.error(
      `       ${error.message}`,
    );
  }
}

await test(
  'Uppercase transformation',
  async () => {
    const result =
      await executeSandboxTransformation({
        sourceCode:
          'return String(value).toUpperCase();',

        value:
          'streamweaver',
      });

    assert.equal(
      result,
      'STREAMWEAVER',
    );
  },
);

await test(
  'Trim transformation',
  async () => {
    const result =
      await executeSandboxTransformation({
        sourceCode:
          'return String(value).trim();',

        value:
          '   hello   ',
      });

    assert.equal(
      result,
      'hello',
    );
  },
);

await test(
  'Numeric transformation',
  async () => {
    const result =
      await executeSandboxTransformation({
        sourceCode:
          'return Number(value) * 2;',

        value:
          '21',
      });

    assert.equal(
      result,
      42,
    );
  },
);

await test(
  'Row context available',
  async () => {
    const result =
      await executeSandboxTransformation({
        sourceCode:
          'return row.department + ":" + value;',

        value:
          'Arun',

        row: {
          department:
            'Engineering',
        },
      });

    assert.equal(
      result,
      'Engineering:Arun',
    );
  },
);

await test(
  'process inaccessible',
  async () => {
    const result =
      await executeSandboxTransformation({
        sourceCode:
          'return typeof process;',

        value: null,
      });

    assert.equal(
      result,
      'undefined',
    );
  },
);

await test(
  'require inaccessible',
  async () => {
    const result =
      await executeSandboxTransformation({
        sourceCode:
          'return typeof require;',

        value: null,
      });

    assert.equal(
      result,
      'undefined',
    );
  },
);

await test(
  'Buffer inaccessible',
  async () => {
    const result =
      await executeSandboxTransformation({
        sourceCode:
          'return typeof Buffer;',

        value: null,
      });

    assert.equal(
      result,
      'undefined',
    );
  },
);

await test(
  'Infinite loop timeout',
  async () => {
    await assert.rejects(
      () =>
        executeSandboxTransformation({
          sourceCode:
            'while (true) {}',

          value: null,

          timeoutMs: 30,
        }),

      (error) =>
        error.code ===
        'SANDBOX_TIMEOUT',
    );
  },
);

await test(
  'Invalid JavaScript rejected',
  async () => {
    await assert.rejects(
      () =>
        executeSandboxTransformation({
          sourceCode:
            'return (',

          value: null,
        }),

      (error) =>
        error.code ===
        'SANDBOX_SYNTAX_ERROR',
    );
  },
);

await test(
  'Sandbox Transform stream',
  async () => {
    const source =
      Readable.from(
        [
          {
            rowNumber: 1,
            data: {
              name: ' arun ',
            },
          },

          {
            rowNumber: 2,
            data: {
              name: ' priya ',
            },
          },
        ],
        {
          objectMode: true,
        },
      );

    const sandbox =
      new SandboxTransform({
        transformations: [
          {
            field: 'name',

            code:
              'return String(value).trim().toUpperCase();',
          },
        ],
      });

    const output = [];

    const collector =
      new Writable({
        objectMode: true,

        write(
          row,
          _encoding,
          callback,
        ) {
          output.push(row);
          callback();
        },
      });

    await pipeline(
      source,
      sandbox,
      collector,
    );

    assert.equal(
      output.length,
      2,
    );

    assert.equal(
      output[0].data.name,
      'ARUN',
    );

    assert.equal(
      output[1].data.name,
      'PRIYA',
    );
  },
);

console.log('');
console.log(
  '============================================',
);
console.log(
  ' StreamWeaver Week 3 Sandbox Verification',
);
console.log(
  '============================================',
);
console.log(
  `Passed: ${passed}`,
);
console.log(
  `Failed: ${failed}`,
);

if (failed === 0) {
  console.log('');
  console.log(
    'WEEK 3 SANDBOX VERIFICATION PASSED.',
  );

  process.exit(0);
}

process.exit(1);
