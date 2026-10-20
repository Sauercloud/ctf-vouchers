-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VoucherSource" AS ENUM ('SEED', 'REPLICATED', 'MANUAL');

-- CreateEnum
CREATE TYPE "InboundStatus" AS ENUM ('PROCESSED', 'UNMATCHED', 'NO_CODE', 'HELD', 'IGNORED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OutboundKind" AS ENUM ('VOUCHER', 'ADMIN_ALERT');

-- CreateEnum
CREATE TYPE "OutboundStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Team" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "requested" INTEGER NOT NULL DEFAULT 0,
    "registeredAt" TIMESTAMP(3),
    "frozenRequested" INTEGER,
    "raises" JSONB NOT NULL DEFAULT '[]',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "State" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "frozenAt" TIMESTAMP(3),
    "frozenTeamIds" INTEGER[],
    "seed" TEXT,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" "VoucherSource" NOT NULL,
    "held" BOOLEAN NOT NULL DEFAULT false,
    "heldReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentAssignmentId" TEXT,
    "inboundMailId" TEXT,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voucherId" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmNote" TEXT,
    "replicatedAt" TIMESTAMP(3),
    "unconfirmedFlaggedAt" TIMESTAMP(3),
    "overdueFlaggedAt" TIMESTAMP(3),
    "flagsClearedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "slotRefunded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundMail" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyPlain" TEXT NOT NULL,
    "headers" JSONB NOT NULL,
    "status" "InboundStatus" NOT NULL,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundMail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundMail" (
    "id" TEXT NOT NULL,
    "kind" "OutboundKind" NOT NULL,
    "to" TEXT NOT NULL,
    "replyTo" TEXT,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "OutboundStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "mailgunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "assignmentId" TEXT,

    CONSTRAINT "OutboundMail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_token_key" ON "Assignment"("token");

-- CreateIndex
CREATE INDEX "Assignment_teamId_idx" ON "Assignment"("teamId");

-- CreateIndex
CREATE INDEX "Assignment_voucherId_idx" ON "Assignment"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundMail_messageId_key" ON "InboundMail"("messageId");

-- CreateIndex
CREATE INDEX "OutboundMail_status_sentAt_idx" ON "OutboundMail"("status", "sentAt");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_parentAssignmentId_fkey" FOREIGN KEY ("parentAssignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_inboundMailId_fkey" FOREIGN KEY ("inboundMailId") REFERENCES "InboundMail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMail" ADD CONSTRAINT "OutboundMail_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

