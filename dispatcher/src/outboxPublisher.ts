import { RepositoryPrisma } from '@messaging-service/db';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { prisma } from '@messaging-service/db/src/prismaClient.ts';
import { validateEvent } from '@returnacy/event-contracts';
let incrementMetric: ((name: 'eventsPublished' | 'eventsFailed') => void) | undefined;
try {
  // placeholder for future shared metrics import
} catch {}
import pino from 'pino';

const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS || 2000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 50);
const MAX_ATTEMPTS = Number(process.env.OUTBOX_MAX_ATTEMPTS || 10);

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'messaging-service.outbox' });
const repo = new RepositoryPrisma();
let running = false;
let stopping = false;
let intervalHandle: NodeJS.Timer | null = null;

function computeBackoffSeconds(nextAttemptNumber: number) {
  const exp = Math.min(Math.pow(2, nextAttemptNumber - 1), 60);
  return exp;
}

async function publishBatch() {
  if (running || stopping) return;
  running = true;
  try {
    const events = await (repo as any).fetchUnpublishedOutboxEvents(BATCH_SIZE, new Date());
    if (!events.length) return;
    for (const evt of events) {
      try {
        const validation = validateEvent(evt.payload);
        if (!validation.ok) {
          await (repo as any).markOutboxEventGiveUp(evt.id, 'validation_failed:' + validation.error);
          logger.error({ eventId: evt.id, type: evt.type, error: validation.error }, 'outbox validation failed – giving up');
          continue;
        }
        logger.info({ eventId: evt.id, type: evt.type, version: evt.version, attempt: evt.attempt }, 'publishing event');
        await (repo as any).markOutboxEventPublished(evt.id);
        incrementMetric?.('eventsPublished');
        logger.debug({ eventId: evt.id }, 'event published');
      } catch (err: any) {
        const nextAttemptNumber = evt.attempt + 1;
        const final = nextAttemptNumber >= (evt.maxAttempts ?? MAX_ATTEMPTS);
        if (final) {
          await (repo as any).markOutboxEventGiveUp(evt.id, (err?.message || 'publish_error').slice(0, 500));
          logger.error({ eventId: evt.id, attempt: nextAttemptNumber, error: err?.message }, 'permanent publish failure – giving up');
          incrementMetric?.('eventsFailed');
        } else {
          const backoff = computeBackoffSeconds(nextAttemptNumber);
          await (repo as any).markOutboxEventFailed(evt.id, (err?.message || 'publish_error').slice(0, 500), backoff);
          logger.warn({ eventId: evt.id, attempt: nextAttemptNumber, backoffSeconds: backoff, error: err?.message }, 'publish failed – retry scheduled');
          incrementMetric?.('eventsFailed');
        }
      }
    }
  } finally {
    running = false;
  }
}

function scheduleLoop() {
  intervalHandle = setInterval(publishBatch, POLL_INTERVAL_MS);
  (intervalHandle as any).unref?.();
}

async function start() {
  await prisma.$queryRaw`SELECT 1`;
  logger.info({ pollMs: POLL_INTERVAL_MS, batchSize: BATCH_SIZE }, 'outbox publisher started');
  scheduleLoop();
}

start().catch(err => {
  logger.fatal({ err }, 'outbox publisher failed to start');
  process.exit(1);
});

async function shutdown() {
  if (stopping) return;
  stopping = true;
  logger.info('shutting down outbox publisher');
  if (intervalHandle) clearInterval(intervalHandle as unknown as number);
  const check = () => running ? setTimeout(check, 100) : finish();
  const finish = () => { logger.info('outbox publisher stopped'); process.exit(0); };
  check();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
