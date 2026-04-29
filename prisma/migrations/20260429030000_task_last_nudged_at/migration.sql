-- v1.25.0: per-task last-nudged-at timestamp. Mirrors the Guest
-- column already in the schema (used by the unconfirmed-RSVP digest).
-- Lets the overdue-task digest rate-limit which tasks appear in each
-- send so the couple doesn't get the same task chased weekly.

ALTER TABLE "Task"
  ADD COLUMN "lastNudgedAt" TIMESTAMP(3);
