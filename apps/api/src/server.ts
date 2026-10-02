import { buildApp } from './app.js';
import { config } from './config/index.js';

const app = buildApp();

async function start() {
  try {
    const address = await app.listen({
      port: config.APP_PORT,
      host: config.APP_HOST,
    });
    console.log(`PADUPOS API listening on ${address}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

export { app };
