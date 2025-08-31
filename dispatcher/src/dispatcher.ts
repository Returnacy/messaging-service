import 'dotenv/config';
import { Processor } from './processor.js';
import { createQueue } from './queue.js';
import { createWorker } from './worker.js';
import { RepositoryPrisma } from '@messaging-service/db';
import { Redis } from "ioredis";
import pino from 'pino';

const logger = pino();

console.log('REDIS_URL:', process.env.REDIS_URL);

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL not set in the environment!');
}

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

async function start() {
  const repo = new RepositoryPrisma();
  const processor = new Processor(repo);

  const dispatchQueue = createQueue('messages.dispatch', connection);
  const retriesQueue = createQueue('messages.retries', connection);

  const dispatchWorker = createWorker('messages.dispatch', processor, logger, connection, 5);
  const retriesWorker = createWorker('messages.retries', processor, logger, connection, 2);

  logger.info('All workers started');
}

start().catch(err => {
  logger.error('Worker failed to start', err);
  process.exit(1);
});