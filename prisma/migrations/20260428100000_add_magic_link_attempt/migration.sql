-- R2/A3: magic-link rate-limit tracking. Standalone table; no FK relations.
CREATE TABLE "MagicLinkAttempt" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLinkAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MagicLinkAttempt_identifier_createdAt_idx"
    ON "MagicLinkAttempt"("identifier", "createdAt");

CREATE INDEX "MagicLinkAttempt_createdAt_idx"
    ON "MagicLinkAttempt"("createdAt");
