import type { FastifyRequest } from "fastify";
import type { Batch } from "@messaging-service/types";
import { processOutboundMessage } from "../../../../../utils/processOutboundMessage.js";
import type { OutboundMessage } from "@messaging-service/types/outboundMessage.js";

export async function batchService(request: FastifyRequest, input: Batch) {
  const outboundMsg: OutboundMessage[] = [];

  for (let i = 0; i < input.length; i++) {
    const msgInput = input[i];
    if (!msgInput)
      throw new Error(`Input at index ${i} is invalid`);
    
    outboundMsg.push(await processOutboundMessage(request, msgInput));
  }

  return { messageId: outboundMsg.map(msg => msg.id) };
}