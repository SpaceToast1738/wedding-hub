-- v1.30.5: drop legacy ScheduleEvent.audience column. Replaced by
-- attendeeIds (user IDs) in v1.27.1; the column has been kept for
-- backward-compat read fallback for one release. Buffer elapsed.

ALTER TABLE "ScheduleEvent" DROP COLUMN "audience";
