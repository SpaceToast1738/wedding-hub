-- v1.67.0: optional Guest.profilePictureFileId — links a guest row
-- to a File for use as their avatar across the app (guest list,
-- detail page, seating side panel). Reuses the existing File model
-- so the upload path, 25 MB cap, MIME allowlist, and signed-download
-- flow all carry over unchanged.
--
-- SetNull cascade so deleting the file row doesn't cascade-delete
-- the guest. Index for the lookup pattern (rare, but: "which guests
-- still reference this file?" needed for cleanup tooling).
--
-- Purely additive — no data movement.

ALTER TABLE "Guest"
    ADD COLUMN "profilePictureFileId" TEXT;

ALTER TABLE "Guest"
    ADD CONSTRAINT "Guest_profilePictureFileId_fkey"
    FOREIGN KEY ("profilePictureFileId") REFERENCES "File"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Guest_profilePictureFileId_idx"
    ON "Guest"("profilePictureFileId");
