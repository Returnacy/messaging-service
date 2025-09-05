import { execSync } from 'child_process';
import { prisma } from '../../src/prismaClient.js';
import { RepositoryPrisma } from '../../src/repository.prisma.js';
import { beforeEach, beforeAll, afterAll, afterEach, expect, test, vi, describe } from "vitest";

describe('RepositoryPrisma Integration', () => {

  /**
   * Clean DB state used by tests.
   * Adjust the deletion order if you expand the schema.
   */
  async function cleanDb() {
    // Delete logs, outbound messages, payloads
    // Order matters if you have FK constraints
    await prisma.providerRequestLog.deleteMany({});
    await prisma.outboundMessage.deleteMany({});
    await prisma.messagePayload.deleteMany({});
    await prisma.provider.deleteMany({});
  }

  beforeAll(async () => {
    // Ensure DATABASE_URL is present
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL env var is required for integration tests (point to Postgres or PgBouncer)');
    }

    // 1) Wait for DB to accept connections
    await waitForDbReady();

    // 2) Generate Prisma client and push schema to DB (safe for dev/integration)
    // You can skip these steps in CI if you run migrations elsewhere (set SKIP_PRISMA_SETUP=1)
    if (!process.env.SKIP_PRISMA_SETUP) {
      // eslint-disable-next-line no-console
      console.log('Running `npx prisma generate` ...');
      execSync('npx prisma generate', { stdio: 'inherit' });

      // eslint-disable-next-line no-console
      console.log('Running `npx prisma db push` to ensure schema exists ...');
      execSync('npx prisma db push', { stdio: 'inherit' });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDb();
  });

  afterEach(async () => {
    await cleanDb();
  });

  test('create log + update success (integration)', async () => {
    const repo = new RepositoryPrisma();

    // create payload & outbound via prisma directly for test setup
    const payload = await prisma.messagePayload.create({
      data: {
        from: 'sender@example.com',
        to: { email: 'a@b.com' },
        subject: 'integration test',
        bodyText: 'hi'
      }
    });

    const provider = await prisma.provider.create({
      data: {
        id: 'test-provider-id',
        name: 'Test Provider',
        channel: 'EMAIL',
        credentialRef: 'test-credential',
      }
    });

    const msg = await prisma.outboundMessage.create({
      data: {
        payload: {
          connect: { id: payload.id },
        },
        channel: 'EMAIL',
        maxAttempts: 3,
        // attempt defaults to 0 via schema, but explicit here helps clarity
        attempt: 0,
        externalId: 'test-external-id',
        recipientId: 'test-recipient-id',
        provider: {
          connect: { id: provider.id },
        },
      }
    });

    // sanity check that record created
    const loaded = await prisma.outboundMessage.findUnique({ where: { id: msg.id }});
    expect(loaded).not.toBeNull();

    // run repo methods under test
    const providerRequestLog = await repo.createProviderRequestLog({
      outboundMessageId: msg.id,
      providerId: 'test-provider-id',
      request: { foo: 'bar' },
      response: { ok: true },
      httpStatus: 200
    });

    await repo.updateOutboundMessageStatusToSent(msg.id);

    const updated = await prisma.outboundMessage.findUnique({ where: { id: msg.id }});
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('SENT');

    // confirm log exists
    const logs = await prisma.providerRequestLog.findMany({ where: { outboundMessageId: msg.id }});
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

}, { timeout: 120_000 });

const MAX_RETRIES = 60;
const RETRY_DELAY_MS = 1000;

async function waitForDbReady(): Promise<void> {
  let attempts = 0;
  while (attempts < MAX_RETRIES) {
    try {
      // simple query to check DB connectivity
      // NOTE: Prisma will create a connection pool lazily on first use
      // so this both tests connectivity and initializes the client
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      attempts += 1;
      // eslint-disable-next-line no-console
      console.log(`DB not ready yet (attempt ${attempts}/${MAX_RETRIES}) - retrying in ${RETRY_DELAY_MS}ms`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw new Error('Timed out waiting for DB to become available');
}

beforeAll(async () => {
  // Ensure DATABASE_URL is present
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL env var is required for integration tests (point to Postgres or PgBouncer)');
  }

  // 1) Wait for DB to accept connections
  await waitForDbReady();

  // 2) Generate Prisma client and push schema to DB (safe for dev/integration)
  // You can skip these steps in CI if you run migrations elsewhere (set SKIP_PRISMA_SETUP=1)
  if (!process.env.SKIP_PRISMA_SETUP) {
    // eslint-disable-next-line no-console
    console.log('Running `npx prisma generate` ...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // eslint-disable-next-line no-console
    console.log('Running `npx prisma db push` to ensure schema exists ...');
    execSync('npx prisma db push', { stdio: 'inherit' });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Clean DB state used by tests.
 * Adjust the deletion order if you expand the schema.
 */
async function cleanDb() {
  // Delete logs, outbound messages, payloads
  // Order matters if you have FK constraints
  await prisma.providerRequestLog.deleteMany({});
  await prisma.outboundMessage.deleteMany({});
  await prisma.messagePayload.deleteMany({});
}

beforeEach(async () => {
  await cleanDb();
});

afterEach(async () => {
  await cleanDb();
});

test('create log + update success (integration)', async () => {
  const repo = new RepositoryPrisma();

  // create payload & outbound via prisma directly for test setup
  const payload = await prisma.messagePayload.create({
    data: {
      from: 'sender@example.com',
      to: { email: 'a@b.com' },
      subject: 'integration test',
      bodyText: 'hi'
    }
  });

  const provider = await prisma.provider.create({
    data: {
      id: 'test-provider-id',
      name: 'Test Provider',
      channel: 'EMAIL',
      credentialRef: 'test-credential',
    }
  });

  const msg = await prisma.outboundMessage.create({
    data: {
      payload: {
        connect: { id: payload.id },
      },
      channel: 'EMAIL',
      maxAttempts: 3,
      // attempt defaults to 0 via schema, but explicit here helps clarity
      attempt: 0,
      externalId: 'test-external-id',
      recipientId: 'test-recipient-id',
      provider: {
        connect: { id: provider.id },
      },
    }
  });

  // sanity check that record created
  const loaded = await prisma.outboundMessage.findUnique({ where: { id: msg.id }});
  expect(loaded).not.toBeNull();

  // run repo methods under test
  const providerRequestLog = await repo.createProviderRequestLog({
    outboundMessageId: msg.id,
    providerId: 'test-provider-id',
    request: { foo: 'bar' },
    response: { ok: true },
    httpStatus: 200
  });

  await repo.updateOutboundMessageStatusToSent(msg.id);

  const updated = await prisma.outboundMessage.findUnique({ where: { id: msg.id }});
  expect(updated).not.toBeNull();
  expect(updated!.status).toBe('SENT');

  // confirm log exists
  const logs = await prisma.providerRequestLog.findMany({ where: { outboundMessageId: msg.id }});
  expect(logs.length).toBeGreaterThanOrEqual(1);
});
