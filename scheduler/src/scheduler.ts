import cron from 'node-cron';
import { prisma } from '@messaging-service/db';
import type { OutboundMessage } from '@messaging-service/types';
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
async function claimDueMessages(now: Date, batchSize: number): Promise<OutboundMessage[]> {
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
  if (!rows.length) return [];

  const ids = rows.map(r => r.id);
  const dbMessages = await prisma.outboundMessage.findMany({
    where: { id: { in: ids } },
    include: { payload: true, provider: true },
    orderBy: { scheduledAt: 'asc' }
  });

  // Map DB records to OutboundMessage type
  const messages: OutboundMessage[] = dbMessages.map((db: any) => ({
    id: db.id,
    externalId: db.externalId,
    campaignId: db.campaignId ?? undefined,
    recipientId: db.recipientId,
    channel: db.channel,
    providerId: db.providerId,
    payload: {
      id: db.payload.id,
      subject: db.payload.subject ?? null,
      bodyText: db.payload.bodyText ?? null,
      bodyHtml: db.payload.bodyHtml ?? null,
      to: db.payload.to as any,
      from: db.payload.from,
      metadata: db.payload.metadata ?? undefined,
    } as any,
    provider: {
      id: db.provider.id,
      name: db.provider.name,
      channel: db.provider.channel,
      credentialRef: db.provider.credentialRef,
    },
    status: db.status,
    attempt: db.attempt,
    maxAttempts: db.maxAttempts,
    scheduledAt: db.scheduledAt ?? null,
  }));

  return messages;
}

export async function scheduleDueMessages() {
  const now = new Date();

  const messages = await claimDueMessages(now, BATCH_SIZE);
  if (messages.length === 0) return;

  // Enqueue minimal payload: only id. Dispatcher fetches full message.
  await dispatchQueue.addBulk(
    messages.map(m => ({ name: 'dispatch', data: m }))
  );

  logger.info({ count: messages.length }, 'Scheduled messages');
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