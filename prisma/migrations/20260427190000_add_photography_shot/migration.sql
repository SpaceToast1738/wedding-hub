-- F2: photography shot list. Standalone table; no FK relations.
CREATE TABLE "PhotographyShot" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "withWhom" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "notes" TEXT,
    "captured" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotographyShot_pkey" PRIMARY KEY ("id")
);
