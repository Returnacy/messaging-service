import cron from 'node-cron';
import { prisma } from '@messaging-service/db';
import type { OutboundMessage, MessagePayload, PayloadRecipient } from '@messaging-service/types';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';

const logger = pino();

// Helper to ensure logs are visible in Railway cron jobs
function log(level: 'info' | 'error', message: string, data?: any) {
  const runOnce = process.env.SCHEDULER_RUN_ONCE === 'true' || process.argv.includes('--run-once');

  // For cron jobs, use console to ensure immediate visibility
  if (runOnce) {
    const timestamp = new Date().toISOString();
    const logData = data ? JSON.stringify(data) : '';
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message} ${logData}`.trim());
  }

  // Also log to pino for consistency
  if (level === 'error') {
    logger.error(data || {}, message);
  } else {
    logger.info(data || {}, message);
  }
}

const BATCH_SIZE = Number(process.env.SCHEDULER_BATCH_SIZE ?? 100);

// Initialize connections lazily to allow proper error handling
let connection: Redis | null = null;
let dispatchQueue: Queue | null = null;

function initializeConnections() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  dispatchQueue = new Queue('messages.dispatch', { connection });
}

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

  const ids = rows.map((r: any) => r.id);
  const dbMessages = await prisma.outboundMessage.findMany({
    where: { id: { in: ids } },
    include: { payload: true, provider: true },
    orderBy: { scheduledAt: 'asc' }
  });

  // Map DB records to OutboundMessage type
  const messages: OutboundMessage[] = dbMessages.map((db: any) => ({
    id: db.id,
    idempotencyKey: db.idempotencyKey,
    externalId: db.externalId ?? undefined,
    campaignId: db.campaignId ?? undefined,
    recipientId: db.recipientId,
    channel: db.channel,
    providerId: db.providerId,
    payload: {
      id: db.payload.id,
      subject: db.payload.subject ?? null,
      bodyText: db.payload.bodyText ?? null,
      bodyHtml: db.payload.bodyHtml ?? null,
      to: db.payload.to as PayloadRecipient,
      from: db.payload.from,
      metadata: db.payload.metadata ?? undefined,
      createdAt: db.payload.createdAt,
    } as MessagePayload,
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
  if (!dispatchQueue) {
    throw new Error('Dispatch queue not initialized');
  }

  const now = new Date();

  const messages = await claimDueMessages(now, BATCH_SIZE);
  if (messages.length === 0) {
    log('info', 'No messages due for scheduling');
    return;
  }

  // Enqueue messages. Dispatcher fetches full message.
  await dispatchQueue.addBulk(
    messages.map(m => ({ name: 'dispatch', data: m }))
  );

  log('info', 'Scheduled messages', { count: messages.length });
}

// Start in cron mode or one-off mode to enable scale-to-zero on Railway.
async function start() {
  const runOnce = process.env.SCHEDULER_RUN_ONCE === 'true' || process.argv.includes('--run-once');

  log('info', `Starting scheduler in ${runOnce ? 'run-once' : 'cron'} mode`);

  // Log environment configuration for debugging
  log('info', 'Environment check', {
    hasRedisUrl: !!process.env.REDIS_URL,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    batchSize: BATCH_SIZE,
    nodeEnv: process.env.NODE_ENV,
  });

  try {
    // Initialize connections before scheduling
    initializeConnections();
    log('info', 'Scheduler connections initialized successfully');
  } catch (err) {
    log('error', 'Failed to initialize scheduler', { error: String(err) });
    process.exitCode = 1;
    process.exit(1);
  }

  if (runOnce) {
    try {
      log('info', 'Executing scheduled message check...');
      await scheduleDueMessages();
      log('info', 'Scheduler run-once completed successfully');
    } catch (err) {
      log('error', 'Scheduler runOnce error', { error: String(err) });
      process.exitCode = 1;
    } finally {
      log('info', 'Cleaning up connections...');
      try { if (dispatchQueue) await dispatchQueue.close(); } catch {}
      try { if (connection) await connection.quit(); } catch {}
      try { await prisma.$disconnect(); } catch {}
      log('info', 'Scheduler exiting');
      process.exit();
    }
  } else {
    log('info', 'Starting scheduler in cron mode (every minute)');
    cron.schedule('* * * * *', async () => {
      try {
        await scheduleDueMessages();
      } catch (err) {
        log('error', 'Scheduler error', { error: String(err) });
      }
    });
  }
}

start();