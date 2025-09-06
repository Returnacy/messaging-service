import { beforeEach, describe, expect, test } from "vitest";
import { Queue } from "bullmq";
import { prisma } from "@messaging-service/db";
import { scheduleDueMessages } from "@/scheduler.js";
import { randomUUID } from "crypto";
import { Redis } from 'ioredis';

console.log('REDIS_URL:', process.env.REDIS_URL);

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL not set in the environment!');
}

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

const testQueue = new Queue("messages.dispatch", { connection });

describe("scheduleDueMessages integration", () => {
  beforeEach(async () => {
    // Clean up the queue before each test
    await testQueue.drain();
    await testQueue.clean(0, 100, "wait");
    await testQueue.clean(0, 100, "active");
    await testQueue.clean(0, 100, "delayed");
    await testQueue.clean(0, 100, "completed");
    await testQueue.clean(0, 100, "failed");
    // Clean up DB if needed
    await prisma.outboundMessage.deleteMany({});
  });

  test("schedules due messages and enqueues jobs in Redis", async () => {
    const provider = await prisma.provider.create({
      data: {
        name: "resend",
        channel: "EMAIL",
        credentialRef: "fake-ref",
      },
    });

    const payload = await prisma.messagePayload.create({
      data: {
        subject: "Test",
        bodyText: "This is a test message",
        from: "sender@example.com",
        to: { email: "test@example.com" },
      },
    });

    const msg = await prisma.outboundMessage.create({
      data: {
        externalId: randomUUID(),
        recipientId: "user-123",
        channel: "EMAIL",
        provider: {
          connect: { id: provider.id },
        },
        payload: {
          connect: { id: payload.id },
        },
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() - 1000),
      },
      include: { provider: true, payload: true },
    });

    await scheduleDueMessages();

    // Check that a job was added to the queue
    const jobs = await testQueue.getJobs(["wait", "delayed", "active"]);
    expect(jobs.length).toBe(1);
    const job = jobs[0]!; // ensured by the length expectation above
    expect(job.data).toMatchObject({
        channel: "EMAIL",
        id: msg.id,
        payload: expect.objectContaining({
          id: expect.any(String),
          subject: "Test",
          bodyHtml: null,
          bodyText: "This is a test message",
          from: "sender@example.com",
          to: { email: "test@example.com" },
          createdAt: expect.any(String),
        }),
        provider: expect.anything(),
      });

    // Optionally, check DB status update
    const updated = await prisma.outboundMessage.findUnique({ where: { id: msg.id } });
    expect(updated?.status).toBe("QUEUED");
  });
});