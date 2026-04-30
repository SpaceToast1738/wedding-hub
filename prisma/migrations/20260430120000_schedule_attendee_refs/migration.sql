-- v1.41.0 (backlog #4): polymorphic attendee references on
-- ScheduleEvent. Adds `attendeeRefs: String[]` and backfills it from
-- the existing `attendeeIds` by prefixing each id with "user:".
-- The legacy `attendeeIds` column stays one release as a
-- recoverability buffer (matches v1.30.5 / P5 / P7a standing
-- pattern). From this release on the editor + read paths use
-- `attendeeRefs` exclusively; `attendeeIds` will be dropped in a
-- later cleanup migration.

-- 1. Add the new column.
ALTER TABLE "ScheduleEvent"
    ADD COLUMN "attendeeRefs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2. Backfill — every existing attendeeIds value becomes a "user:<id>"
--    attendeeRefs entry. Idempotent: re-runs find attendeeRefs already
--    populated and skip. We use array_length on attendeeRefs because
--    the default ARRAY[]::TEXT[] reads as length 0; rows that are
--    already migrated (length > 0) skip.
UPDATE "ScheduleEvent"
SET "attendeeRefs" = (
    SELECT array_agg('user:' || x)
    FROM unnest("attendeeIds") AS x
    WHERE x IS NOT NULL AND length(x) > 0
)
WHERE COALESCE(array_length("attendeeRefs", 1), 0) = 0
  AND COALESCE(array_length("attendeeIds", 1), 0) > 0;
