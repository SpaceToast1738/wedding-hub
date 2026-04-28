-- A: +1 as own Guest row. Self-referential nullable FK on Guest.
-- Hard-delete of the host cascades to the +1 row (the soft-archive path
-- is handled in actions.ts so the +1 inherits archived state explicitly).

ALTER TABLE "Guest" ADD COLUMN "parentGuestId" TEXT;

ALTER TABLE "Guest" ADD CONSTRAINT "Guest_parentGuestId_fkey"
    FOREIGN KEY ("parentGuestId") REFERENCES "Guest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Guest_parentGuestId_idx" ON "Guest"("parentGuestId");
