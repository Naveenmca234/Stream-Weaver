import {
  createWriteStream,
} from 'node:fs';

import {
  once,
} from 'node:events';

import {
  dirname,
  join,
} from 'node:path';

import {
  fileURLToPath,
} from 'node:url';

const currentDirectory =
  dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const departments = [
  'Engineering',
  'Finance',
  'Operations',
  'Sales',
  'Support',
];

async function writeLine(
  stream,
  value,
) {
  if (!stream.write(value)) {
    await once(
      stream,
      'drain',
    );
  }
}

async function generateValidCsv(
  filename,
  rowCount,
) {
  const filePath =
    join(
      currentDirectory,
      filename,
    );

  const stream =
    createWriteStream(
      filePath,
      {
        encoding: 'utf8',
      },
    );

  await writeLine(
    stream,
    'employee_id,name,department,email,salary\n',
  );

  for (
    let index = 1;
    index <= rowCount;
    index += 1
  ) {
    const department =
      departments[
        index %
          departments.length
      ];

    const padded =
      String(index).padStart(
        5,
        '0',
      );

    const row =
      [
        index,
        `Employee ${padded}`,
        department,
        `employee${padded}@example.test`,
        30000 +
          (index % 25000),
      ].join(',') + '\n';

    await writeLine(
      stream,
      row,
    );
  }

  stream.end();

  await once(
    stream,
    'finish',
  );

  console.log(
    `Generated ${filename}: ${rowCount} rows`,
  );
}

async function generateInvalidCsv() {
  const filePath =
    join(
      currentDirectory,
      'employees-invalid.csv',
    );

  const content = [
    'employee_id,name,department,email,salary',
    '1,Arun Kumar,Engineering,arun@example.test,42000',
    '2,,Finance,priya@example.test,39000',
    '3,Kavin R,Operations,,41000',
    '4,"Meena, V",Engineering,meena@example.test,45000',
    '5,Ajay M,Sales,ajay@example.test',
    '6,Divya K,Finance,divya@example.test,40000,EXTRA_VALUE',
    '6,Duplicate ID,Support,duplicate@example.test,37000',
    '7,Rahul P,,rahul@example.test,',
  ].join('\n');

  const stream =
    createWriteStream(
      filePath,
      {
        encoding: 'utf8',
      },
    );

  stream.end(
    `${content}\n`,
  );

  await once(
    stream,
    'finish',
  );

  console.log(
    'Generated employees-invalid.csv',
  );
}

async function generateMalformedCsv() {
  const filePath =
    join(
      currentDirectory,
      'employees-malformed.csv',
    );

  const content =
    [
      'employee_id,name,department',
      '1,Arun,Engineering',
      '2,"Broken quoted value,Finance',
      '3,Meena,Sales',
    ].join('\n') + '\n';

  const stream =
    createWriteStream(
      filePath,
      {
        encoding: 'utf8',
      },
    );

  stream.end(content);

  await once(
    stream,
    'finish',
  );

  console.log(
    'Generated employees-malformed.csv',
  );
}

await generateValidCsv(
  'employees-small.csv',
  20,
);

await generateValidCsv(
  'employees-preview-limit.csv',
  1500,
);

await generateValidCsv(
  'employees-medium.csv',
  50000,
);

await generateInvalidCsv();

await generateMalformedCsv();

console.log(
  '\nSample generation complete.',
);