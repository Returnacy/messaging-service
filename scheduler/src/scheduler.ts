import cron from 'node-cron';
import { prisma } from '@messaging-service/db';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import Redlock from 'redlock';
import pino from 'pino';

import type { MessageStatus, OutboundMessage } from '@messaging-service/types';

const logger = pino();

console.log('REDIS_URL:', process.env.REDIS_URL);

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL not set in the environment!');
}

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

const dispatchQueue = new Queue('messages.dispatch', { connection });

const redlock = new Redlock(
  [connection], // You can add more Redis clients for higher availability
  { retryCount: 0 } // Don't retry, just skip if lock not acquired
);

const LOCK_KEY = 'scheduler:lock';
const LOCK_TTL_MS = 60_000; // 1 minute

export async function scheduleDueMessages() {
  const now = new Date();

  const dueMessages = await prisma.outboundMessage.findMany({
    where: {
      status: 'SCHEDULED' as MessageStatus,
      scheduledAt: { lte: now },
    },
    include: { 
      payload: true,
      provider: true
    },
    orderBy: { scheduledAt: 'asc' },
    take: 100,
  });

  if (dueMessages.length === 0) return;

  for (const msg of dueMessages) {
    /* await */ dispatchQueue.add('dispatch', msg);

    await prisma.outboundMessage.update({
      where: { id: msg.id },
      data: { status: 'QUEUED'},
    });
  }

  logger.info(`[${new Date().toISOString()}] Scheduled ${dueMessages.length} messages.`);
}

cron.schedule('* * * * *', async () => {
  let lock;
  try {
    lock = await redlock.acquire([LOCK_KEY], LOCK_TTL_MS);
    await scheduleDueMessages();
  } catch (err) {
    if (err && typeof err === 'object' && (err as any).name === 'LockError') {
      // Lock not acquired, another instance is running
    } else {
      logger.error(err, 'Scheduler error');
    }
  } finally {
    if (lock) {
      try {
        await lock.release();
      } catch (releaseErr) {
        logger.error(releaseErr, 'Error releasing lock');
      }
    }
  }
});
