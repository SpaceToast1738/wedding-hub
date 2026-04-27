-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('EVERYONE', 'COUPLE_ONLY');

-- AlterTable
ALTER TABLE "File" ADD COLUMN "visibility" "FileVisibility" NOT NULL DEFAULT 'EVERYONE';
