-- v1.27.1: schedule polish — attendees + all-day toggle.
--
-- Adds:
--   * ScheduleEvent.attendeeIds (User IDs) — replaces the persona-
--     based `audience` column for new events. Legacy column kept
--     for backward-compat read; a future cleanup release will drop
--     it once all rows are migrated.
--   * ScheduleEvent.allDay boolean — events that span the whole day
--     (e.g. "Hen do") render without a time component.

ALTER TABLE "ScheduleEvent"
  ADD COLUMN "attendeeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "allDay" BOOLEAN NOT NULL DEFAULT false;
