export type ProviderResponse = {
  outboundMessageId: string;
  providerId: string;
  providerMessageId: string;
  requestPayload: any;
  responsePayload: any;
  httpStatus: number;
};