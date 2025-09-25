/*
  Warnings:

  - You are about to drop the `IdempotencyKey` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `OutboundMessage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `idempotencyKey` to the `OutboundMessage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."OutboundMessage" ADD COLUMN     "idempotencyKey" TEXT NOT NULL,
ALTER COLUMN "externalId" DROP NOT NULL;

-- DropTable
DROP TABLE "public"."IdempotencyKey";

-- CreateIndex
CREATE UNIQUE INDEX "OutboundMessage_idempotencyKey_key" ON "public"."OutboundMessage"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OutboundMessage_status_scheduledAt_idx" ON "public"."OutboundMessage"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "OutboundMessage_providerId_idx" ON "public"."OutboundMessage"("providerId");
