-- CreateEnum
CREATE TYPE "public"."Channel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'WHATSAPP', 'VIBER', 'VOICE');

-- CreateEnum
CREATE TYPE "public"."MessageStatus" AS ENUM ('QUEUED', 'SCHEDULED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."Provider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "public"."Channel" NOT NULL,
    "credentialRef" TEXT NOT NULL,
    "config" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxRps" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MessagePayload" (
    "id" TEXT NOT NULL,
    "subject" TEXT,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "from" TEXT NOT NULL,
    "to" JSONB NOT NULL,
    "metadata" JSONB,
    "attachments" JSONB,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagePayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OutboundMessage" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "campaignId" TEXT,
    "recipientId" TEXT NOT NULL,
    "channel" "public"."Channel" NOT NULL,
    "providerId" TEXT NOT NULL,
    "payloadId" TEXT NOT NULL,
    "status" "public"."MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 10,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryReceipt" (
    "id" TEXT NOT NULL,
    "outboundMessageId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProviderRequestLog" (
    "id" TEXT NOT NULL,
    "outboundMessageId" TEXT,
    "providerId" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "httpStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IdempotencyKey" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseRef" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboundMessage_externalId_key" ON "public"."OutboundMessage"("externalId");

-- AddForeignKey
ALTER TABLE "public"."OutboundMessage" ADD CONSTRAINT "OutboundMessage_payloadId_fkey" FOREIGN KEY ("payloadId") REFERENCES "public"."MessagePayload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OutboundMessage" ADD CONSTRAINT "OutboundMessage_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryReceipt" ADD CONSTRAINT "DeliveryReceipt_outboundMessageId_fkey" FOREIGN KEY ("outboundMessageId") REFERENCES "public"."OutboundMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderRequestLog" ADD CONSTRAINT "ProviderRequestLog_outboundMessageId_fkey" FOREIGN KEY ("outboundMessageId") REFERENCES "public"."OutboundMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderRequestLog" ADD CONSTRAINT "ProviderRequestLog_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
