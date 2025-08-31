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

  async updateOutboundMessageOnSuccess(id: string) {
    const message = this.messages[id]!;
    message.status = 'SENT';
    message.scheduledAt = new Date();
  }

  async updateOutboundMessageOnFailure(id: string, attempt: number, errorMessage: string, finalFailure = false) {
    const message = this.messages[id]!;
    message.attempt = attempt;
    message.status = finalFailure ? 'FAILED' : 'QUEUED';
  }
}