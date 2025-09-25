import { RepositoryPrisma } from "@messaging-service/db";
import type { OutboundMessage } from "@messaging-service/types";

export class MockRepo extends RepositoryPrisma {
  messages: Record<string, OutboundMessage> = {} as any;
  logs: any[] = [];

  constructor() { 
    super();
  }
  
  async getOutboundMessage(id: string) { return this.messages[id] ?? null; }

  async createProviderRequestLog(opts: any) { 
    this.logs.push(opts);
    return opts;
  }

  async updateOutboundMessageStatusToSending(id: string): Promise<OutboundMessage> {
    const message = this.messages[id]!;
    message.status = 'SENDING';
    return message;
  }

  async updateOutboundMessageStatusToSent(id: string) {
    const message = this.messages[id]!;
    message.status = 'SENT';
  }

  async updateOutboundMessageStatusOnFailure(id: string, attempt: number, errorMessage: string, finalFailure = false) {
    const message = this.messages[id]!;
    if (!message) return false;
    const terminal = ['DELIVERED','BOUNCED','FAILED'];
    if (terminal.includes(message.status as any)) return false; // do not regress terminal states
    message.attempt = attempt;
    message.status = finalFailure ? 'FAILED' : 'QUEUED';
    return true;
  }

  async updateOutboundMessageExternalId(id: string, externalId?: string | null) {
    const message = this.messages[id]!;
    if (externalId) {
      (message as any).externalId = externalId;
    }
    return message;
  }

  // New methods referenced in delivery receipt path
  async getOutboundMessageByExternalId(externalId: string) {
    return Object.values(this.messages).find(m => (m as any).externalId === externalId) || null;
  }
  async createDeliveryReceipt(data: any) { this.logs.push({ type: 'receipt', ...data }); return data; }
  async updateOutboundMessageStatusToDelivered(id: string) { this.messages[id]!.status = 'DELIVERED' as any; }
  async updateOutboundMessageStatusToBounced(id: string) { this.messages[id]!.status = 'BOUNCED' as any; }
  async updateOutboundMessageStatusToFailed(id: string) { this.messages[id]!.status = 'FAILED' as any; }
}