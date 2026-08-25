import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import type { OutboundMessage } from "@messaging-service/types";
import { Processor } from "@/processor.js";
import { Redis } from 'ioredis';
import { MockRepo } from "@tests/mock/mock.repository.prisma.js";

// --- Define mocks inside vi.mock factories ---
vi.mock("@/adapters/resend.js", () => {
  return {
    sendWithResendAdapter: vi.fn(),
  };
});

vi.mock("@/adapters/decisionTelecom.js", () => {
  return {
    sendWithDecisionTelecomAdapter: vi.fn(),
  };
});

// Now import the mocked functions
import { sendWithResendAdapter } from "@/adapters/resend.js";
import { sendWithDecisionTelecomAdapter } from "@/adapters/decisionTelecom.js";

describe("Processor", () => {
  let repo: MockRepo;
  let proc: Processor;

  beforeEach(() => {
    repo = new MockRepo();
    // Use a mock Redis client; for unit tests we can stub only eval
    const redis = {
      eval: vi.fn().mockResolvedValue(1),
    } as unknown as Redis;
    proc = new Processor(repo as any, redis as any);

    // Reset mocks before each test
    vi.mocked(sendWithResendAdapter).mockReset();
    vi.mocked(sendWithDecisionTelecomAdapter).mockReset();
  });

  it("processes email successfully", async () => {
    const msg: OutboundMessage = {
      id: "m1",
      channel: "EMAIL",
      payload: { id: "p1", to: { email: "a@b.com" } },
      status: "QUEUED",
      attempt: 0,
      maxAttempts: 3,
    } as any;

    repo.messages[msg.id] = msg;

    vi.mocked(sendWithResendAdapter).mockResolvedValue({
      outboundMessageId: msg.id,
      providerId: msg.providerId || 'resend',
      providerMessageId: 'external-email-123',
      requestPayload: msg,
      responsePayload: {},
      httpStatus: 200,
    } as any);

    const res = await proc.processJob(msg);
    expect(res.success).toBe(true);
    expect(repo.logs.length).toBe(1);
    expect(repo.messages[msg.id]!.status).toBe("SENT");
  });

  it("retries on transient error", async () => {
    const msg: OutboundMessage = {
      id: "m4",
      channel: "EMAIL",
      payload: { id: "p4", to: { email: "a@b.com" } },
      status: "QUEUED",
      attempt: 0,
      maxAttempts: 3,
    } as any;

    repo.messages[msg.id] = msg;

    vi.mocked(sendWithResendAdapter).mockRejectedValue(new Error("ETIMEDOUT"));

    await expect(proc.processJob(msg))
      .rejects.toThrow("ETIMEDOUT");

    expect(repo.messages[msg.id]!.attempt).toBe(1);
    expect(repo.messages[msg.id]!.status).toBe("QUEUED");
  });

  it("final failure after max attempts", async () => {
    const msg: OutboundMessage = {
      id: "m5",
      channel: "EMAIL",
      payload: { id: "p5", to: { email: "a@b.com" } },
      status: "QUEUED",
      attempt: 2,
      maxAttempts: 3,
    } as any;

    repo.messages[msg.id] = msg;

    vi.mocked(sendWithResendAdapter).mockRejectedValue(new Error("500"));

    const res = await proc.processJob(msg);

    expect(repo.messages[msg.id]!.status).toBe("FAILED");
    expect(res.failed).toBe(true);
    expect(res.finalFailure).toBe(true);
  });

  describe("MESSAGING_DRY_RUN", () => {
    // Provisioning default for every new tenant: the pipeline runs end to end
    // but nothing leaves the building. "Just don't set the API keys" is an
    // omission, not a control — one copied env block undoes it.
    afterEach(() => {
      delete process.env.MESSAGING_DRY_RUN;
    });

    it("marks an email sent without calling the provider", async () => {
      process.env.MESSAGING_DRY_RUN = "true";
      const msg: OutboundMessage = {
        id: "m-dry-1",
        channel: "EMAIL",
        payload: { id: "pd1", to: { email: "real.customer@example.com" } },
        status: "QUEUED",
        attempt: 0,
        maxAttempts: 3,
      } as any;
      repo.messages[msg.id] = msg;

      const res = await proc.processJob(msg);

      expect(sendWithResendAdapter).not.toHaveBeenCalled();
      expect(res.success).toBe(true);
      expect(repo.messages[msg.id]!.status).toBe("SENT");
      expect(repo.logs[0]?.request).toEqual({ dryRun: true });
    });

    it("does not call the SMS provider either", async () => {
      process.env.MESSAGING_DRY_RUN = "true";
      const msg: OutboundMessage = {
        id: "m-dry-2",
        channel: "SMS",
        payload: { id: "pd2", to: { phone: "+390000000000" } },
        status: "QUEUED",
        attempt: 0,
        maxAttempts: 3,
      } as any;
      repo.messages[msg.id] = msg;

      await proc.processJob(msg);

      expect(sendWithDecisionTelecomAdapter).not.toHaveBeenCalled();
      expect(repo.messages[msg.id]!.status).toBe("SENT");
    });

    it("still rejects an unsupported channel", async () => {
      // Same failure path as a real send (the processor catches and marks the
      // message failed) — a dry run must not turn a bad message into a success.
      process.env.MESSAGING_DRY_RUN = "true";
      const msg: OutboundMessage = {
        id: "m-dry-3",
        channel: "PUSH",
        payload: { id: "pd3" },
        status: "QUEUED",
        attempt: 0,
        maxAttempts: 3,
      } as any;
      repo.messages[msg.id] = msg;

      const res = await proc.processJob(msg);
      expect(res.success).toBeUndefined();
      expect(res.failed).toBe(true);
      expect(repo.messages[msg.id]!.status).not.toBe("SENT");
    });

    it("sends normally when the flag is absent", async () => {
      const msg: OutboundMessage = {
        id: "m-dry-4",
        channel: "EMAIL",
        payload: { id: "pd4", to: { email: "a@b.com" } },
        status: "QUEUED",
        attempt: 0,
        maxAttempts: 3,
      } as any;
      repo.messages[msg.id] = msg;
      vi.mocked(sendWithResendAdapter).mockResolvedValue({
        outboundMessageId: msg.id, providerId: 'resend', providerMessageId: 'x',
        requestPayload: msg, responsePayload: {}, httpStatus: 200,
      } as any);

      await proc.processJob(msg);
      expect(sendWithResendAdapter).toHaveBeenCalledTimes(1);
    });
  });

  it("processes SMS successfully", async () => {
    const msg: OutboundMessage = {
      id: "m6",
      channel: "SMS",
      payload: { id: "p6", to: { phone: "+123" } },
      status: "QUEUED",
      attempt: 0,
      maxAttempts: 3,
    } as any;

    repo.messages[msg.id] = msg;

    vi.mocked(sendWithDecisionTelecomAdapter).mockResolvedValue({
      outboundMessageId: msg.id,
      providerId: msg.providerId || 'unknown',
      providerMessageId: 'external-123',
      requestPayload: msg,
      responsePayload: {},
      httpStatus: 200
    });

    const res = await proc.processJob(msg);
    expect(res.success).toBe(true);
    expect(repo.messages[msg.id]!.status).toBe("SENT");
  });
});
