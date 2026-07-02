-- v2.1.0 phase 0: AI planner foundation.
--
-- Adds the four new tables the AI surface needs (thread + messages +
-- proposals + usage) and one nullable column on WeddingSettings for
-- the monthly-spend cap. Append-only — no existing table structure
-- changes, no data backfill, safe to apply on a live prod DB.
--
-- See CLAUDE.md → "AI planner (v2.1.0)" for the design.

-- CreateEnum
CREATE TYPE "AiProposalStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED', 'EDITED_AND_APPLIED');

-- AlterTable
ALTER TABLE "WeddingSettings" ADD COLUMN "aiMonthlyCapPence" INTEGER;

-- CreateTable
CREATE TABLE "AiThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "contextRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProposal" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "createdById" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" "AiProposalStatus" NOT NULL DEFAULT 'PENDING',
    "appliedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "AiProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costPence" INTEGER NOT NULL,
    "feature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiThread_userId_updatedAt_idx" ON "AiThread"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AiMessage_threadId_createdAt_idx" ON "AiMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AiProposal_createdById_status_createdAt_idx" ON "AiProposal"("createdById", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_userId_createdAt_idx" ON "AiUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- AddForeignKey
ALTER TABLE "AiThread" ADD CONSTRAINT "AiThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AiThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProposal" ADD CONSTRAINT "AiProposal_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AiMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProposal" ADD CONSTRAINT "AiProposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
