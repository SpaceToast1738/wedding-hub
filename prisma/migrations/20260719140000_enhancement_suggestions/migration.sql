-- CreateTable
CREATE TABLE "EnhancementSuggestion" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "EnhancementSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnhancementSuggestion_status_createdAt_idx" ON "EnhancementSuggestion"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "EnhancementSuggestion" ADD CONSTRAINT "EnhancementSuggestion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
