import app from './app.js';
import env from './config/env.js';

const server = app.listen(env.port, () => {
  console.log('');
  console.log('======================================');
  console.log(' StreamWeaver Backend');
  console.log('======================================');
  console.log(`Environment : ${env.nodeEnv}`);
  console.log(`Server      : http://localhost:${env.port}`);
  console.log(
    `Health API  : http://localhost:${env.port}/api/health`,
  );
  console.log(`Client      : ${env.clientOrigin}`);
  console.log('======================================');
  console.log('');
});

server.on('error', (error) => {
  console.error('Server startup error:', error);
});

function shutdown(signal) {
  console.log(`\n${signal} received. Closing server...`);

  server.close((error) => {
    if (error) {
      console.error('Failed to close server cleanly:', error);
      process.exit(1);
    }

    console.log('StreamWeaver backend stopped.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));