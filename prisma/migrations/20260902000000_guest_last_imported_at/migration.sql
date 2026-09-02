-- v2.15.0: when the CSV importer last created or merged this guest.
ALTER TABLE "Guest" ADD COLUMN "lastImportedAt" TIMESTAMP(3);
