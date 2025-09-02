import cron from 'node-cron';
import { prisma } from '@messaging-service/db';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';

const logger = pino();

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL not set in the environment!');
}

const BATCH_SIZE = Number(process.env.SCHEDULER_BATCH_SIZE ?? 100);

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  lazyConnect: true, // connect only when first used
});

const dispatchQueue = new Queue('messages.dispatch', { connection });

/**
 * Atomically claim up to BATCH_SIZE due messages using SKIP LOCKED,
 * set them to QUEUED, and return their ids.
 */
async function claimDueMessageIds(now: Date, batchSize: number): Promise<string[]> {
  // Prisma model is OutboundMessage => default table "OutboundMessage"
  // Use CTE + FOR UPDATE SKIP LOCKED to safely claim rows without external locks.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH cte AS (
      SELECT id
      FROM "OutboundMessage"
      WHERE status = 'SCHEDULED' AND "scheduledAt" <= ${now}
      ORDER BY "scheduledAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    UPDATE "OutboundMessage" om
    SET status = 'QUEUED'
    FROM cte
    WHERE om.id = cte.id
    RETURNING om.id;
  `;
  return rows.map(r => r.id);
}

export async function scheduleDueMessages() {
  const now = new Date();

  const ids = await claimDueMessageIds(now, BATCH_SIZE);
  if (ids.length === 0) return;

  // Enqueue minimal payload: only id. Dispatcher fetches full message.
  await dispatchQueue.addBulk(
    ids.map(id => ({ name: 'dispatch', data: { id } }))
  );

  logger.info({ count: ids.length }, 'Scheduled messages');
}

// Start in cron mode or one-off mode to enable scale-to-zero on Railway.
async function start() {
  const runOnce = process.env.SCHEDULER_RUN_ONCE === 'true' || process.argv.includes('--run-once');

  if (runOnce) {
    try {
      await scheduleDueMessages();
    } catch (err) {
      logger.error(err, 'Scheduler runOnce error');
      process.exitCode = 1;
    } finally {
      try { await dispatchQueue.close(); } catch {}
      try { await connection.quit(); } catch {}
      try { await prisma.$disconnect(); } catch {}
      process.exit();
    }
  } else {
    cron.schedule('* * * * *', async () => {
      try {
        await scheduleDueMessages();
      } catch (err) {
        logger.error(err, 'Scheduler error');
      }
    });
  }
}

start();