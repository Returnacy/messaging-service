import { prisma } from './prismaClient.js';
import type { OutboundMessage, MessageStatus, Message } from "@messaging-service/types";
import { Prisma } from "@prisma/client";
import type { ProviderRequestLog } from "@prisma/client";

type DBOutbound = Prisma.OutboundMessageGetPayload<{
  include: { payload: true, provider: true };
}>;

export class RepositoryPrisma {
 

  async createOutboundMessage(data: Message): Promise<OutboundMessage | null> {
    const providerId = await prisma.provider.findFirst({
      where: { channel: data.channel }
    });

    if (!providerId)
      throw new Error(`No provider found for channel ${data.channel}`);

    const db = await prisma.outboundMessage.create({
      data: {
        ...data,
        status: data.scheduledAt ? 'SCHEDULED' : 'QUEUED',
        payload: {
          create: data.payload
        },
        provider: {
          connect: { id: providerId.id }
        }
      },
      include: { payload: true, provider: true }
    });
    return this.mapDbToOutbound(db);
  }

  async getOutboundMessage(id: string): Promise<OutboundMessage | null> {
    const db = await prisma.outboundMessage.findUnique({
      where: { id },
      include: { payload: true, provider: true }
    });

    if (!db) return null;
    return this.mapDbToOutbound(db);
  }

  async getOutboundMessageByIdempotencyKey(key: string): Promise<OutboundMessage | null> {
    const db = await prisma.outboundMessage.findFirst({
      where: { idempotencyKey: key },
      include: { payload: true, provider: true }
    });
    if (!db) return null;
    return this.mapDbToOutbound(db);
  }

  // use getOutboundMessageByExternalId below

  mapDbToOutbound(db: DBOutbound): OutboundMessage {
    return {
      id: db.id,
      externalId: db.externalId,
      campaignId: db.campaignId ?? undefined,
      recipientId: db.recipientId,
      channel: db.channel as any,
      providerId: db.providerId,
      payload: {
        id: db.payload.id,
        subject: db.payload.subject ?? null,
        bodyText: db.payload.bodyText ?? null,
        bodyHtml: db.payload.bodyHtml ?? null,
        to: db.payload.to as any,
        from: db.payload.from,
        metadata: db.payload.metadata ?? undefined
      },
      provider: {
        id: db.provider.id,
        name: db.provider.name,
        channel: db.provider.channel,
        credentialRef: db.provider.credentialRef
      },
      status: db.status as MessageStatus,
      attempt: db.attempt,
      maxAttempts: db.maxAttempts,
      scheduledAt: db.scheduledAt ?? null
    } as OutboundMessage;
  }

  async createProviderRequestLog(opts: {
    outboundMessageId: string;
    providerId: string;
    request: any;
    response: any;
    httpStatus?: number;
  }): Promise<ProviderRequestLog> {
    return await prisma.providerRequestLog.create({
      data: {
        outboundMessageId: opts.outboundMessageId,
        providerId: opts.providerId,
        requestPayload: opts.request ?? null,
        responsePayload: opts.response ?? null,
        httpStatus: opts.httpStatus ?? null,
      }
    });
  }

  // externalId update implemented later with optional arg

  /**
   * Atomic update: set status SENDING
   */
  async updateOutboundMessageStatusToSending(id: string): Promise<OutboundMessage> {
    const msg = await prisma.outboundMessage.update({
      where: { id },
      data: { status: 'SENDING' },
      include: { payload: true, provider: true }
    });
    return this.mapDbToOutbound(msg);
  }

  /**
   * Atomic success update: set status SENT, sentAt, lastAttemptAt
   */
  async updateOutboundMessageStatusToSent(id: string) {
    await prisma.outboundMessage.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        lastAttemptAt: new Date(), // last attempt equals now
      }
    });
  }

  /**
   * Atomic delivery update: set status DELIVERED, deliveredAt, lastAttemptAt on webhook event mapping
   */
  async updateOutboundMessageStatusToDelivered(id: string) {
    await prisma.outboundMessage.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        lastAttemptAt: new Date(), // last attempt equals now
      }
    });
  }

  /**
   * Atomic bounce update: set status BOUNCED, deliveredAt, lastAttemptAt on webhook event mapping
   */
  async updateOutboundMessageStatusToBounced(id: string) {
    await prisma.outboundMessage.update({
      where: { id },
      data: {
        status: 'BOUNCED',
        deliveredAt: new Date(),
        lastAttemptAt: new Date(), // last attempt equals now
      }
    });
  }

  /**
   * Atomic failure update: set status FAILED, lastAttemptAt on webhook event mapping
   * or other failure indication from provider
   */
  async updateOutboundMessageStatusToFailed(id: string) {
    await prisma.outboundMessage.update({
      where: { id },
      data: {
        status: 'FAILED',
        lastAttemptAt: new Date()
      }
    });
  }

  /**
   * Update on failure: increment attempt, set lastError, optionally set final FAILED status.
   * Uses conditional update if necessary for optimistic control.
   */
  async updateOutboundMessageStatusOnFailure(id: string, attempt: number, errorMessage: string, finalFailure = false) {
    const data: Prisma.OutboundMessageUpdateInput = {
      attempt,
      lastError: errorMessage,
      lastAttemptAt: new Date()
    };
    if (finalFailure) {
      (data as any).status = 'FAILED';
    } else {
      // Optionally set status to SENDING or keep as QUEUED depending on your retry policy
      (data as any).status = 'QUEUED';
    }

    await prisma.outboundMessage.update({
      where: { id },
      data
    });
  }

  /**
   * Create a delivery receipt row for provider callbacks/webhooks
   */
  async createDeliveryReceipt(opts: {
    outboundMessageId: string;
    provider: string;
    eventType: string;
    status: string;
    timestamp?: Date;
    raw: any;
    providerMessageId?: string | null;
  }) {
    const dr = await prisma.deliveryReceipt.create({
      data: {
        outboundMessageId: opts.outboundMessageId,
        provider: opts.provider,
        eventType: opts.eventType,
        status: opts.status,
        timestamp: opts.timestamp ?? new Date(),
        raw: opts.raw ?? {},
        providerMessageId: opts.providerMessageId ?? null,
      }
    });
    return dr;
  }

  async getOutboundMessageByExternalId(externalId: string): Promise<OutboundMessage | null> {
    const db = await prisma.outboundMessage.findUnique({
      where: { externalId },
      include: { payload: true, provider: true }
    });
    if (!db) return null;
    return this.mapDbToOutbound(db);
  }

  // aliases not needed; concrete methods exist above

  /**
   * Set provider external id on the outbound message if provided, and return the mapped message
   */
  async updateOutboundMessageExternalId(id: string, externalId?: string | null): Promise<OutboundMessage> {
    if (!externalId) {
      const existing = await this.getOutboundMessage(id);
      if (!existing) throw new Error('OutboundMessage not found: ' + id);
      return existing;
    }
    const msg = await prisma.outboundMessage.update({
      where: { id },
      data: { externalId: externalId as string },
      include: { payload: true, provider: true }
    });
    return this.mapDbToOutbound(msg);
  }
  /**
   * Optional: helper to claim a message atomically by id only if status is QUEUED or SENDING.
   * This prevents two workers processing the same message concurrently.
   *
   * Returns true if claim succeeded (update count > 0).
   */
  async claimMessage(id: string, expectedStatus: MessageStatus = 'QUEUED'): Promise<boolean> {
    // Prisma has no direct update where returning count; use updateMany to perform conditional update and inspect count
    const res = await prisma.outboundMessage.updateMany({
      where: { id, status: expectedStatus },
      data: { status: 'SENDING', updatedAt: new Date() }
    });
    return res.count === 1;
  }
}