import app from './app.js';
import env from './config/env.js';
import fs from 'fs';

const pkg = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

import {
  initializeUploadLifecycle,
} from './services/uploadCleanupService.js';

const stopUploadLifecycle =
  await initializeUploadLifecycle();

const server = app.listen(
  env.port,
  () => {
    console.log('');
    console.log(
      '======================================',
    );

    console.log(
      ' StreamWeaver Backend',
    );

    console.log(
      '======================================',
    );

    console.log(
      `Environment : ${env.nodeEnv}`,
    );

    console.log(
      `Server      : http://localhost:${env.port}`,
    );

    console.log(
      `Health API  : http://localhost:${env.port}/api/health`,
    );

    console.log(
      `Upload API  : http://localhost:${env.port}/api/files/upload`,
    );

    console.log(
      `Version     : ${pkg.version}`,
    );

    console.log(
      `Max Upload  : ${env.maxUploadBytes} bytes`,
    );

    console.log(
      '======================================',
    );

    console.log('');
  },
);

server.on(
  'error',
  (error) => {
    console.error(
      'Server startup error:',
      error,
    );
  },
);

function shutdown(signal) {
  console.log(
    `\n${signal} received. Closing server...`,
  );

  stopUploadLifecycle();

  server.close((error) => {
    if (error) {
      console.error(
        'Failed to close server cleanly:',
        error,
      );

      process.exit(1);
    }

    console.log(
      'StreamWeaver backend stopped.',
    );

    process.exit(0);
  });
}

process.on(
  'SIGINT',
  () => shutdown('SIGINT'),
);

process.on(
  'SIGTERM',
  () => shutdown('SIGTERM'),
);