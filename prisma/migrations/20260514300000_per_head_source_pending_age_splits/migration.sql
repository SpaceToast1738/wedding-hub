-- v1.82.0: split the "Confirmed + pending" headcount source by age.
-- Some vendors price by adult/child differently (e.g. children's meal
-- £15 vs adult £25). Previously the enum only had ADULTS_CONFIRMED /
-- CHILDREN_CONFIRMED (confirmed-only) and CONFIRMED_PLUS_PENDING
-- (everyone). These two new values close the gap.
--
-- Postgres ALTER TYPE ADD VALUE is non-transactional on Postgres < 12
-- but is on 12+. We're on Postgres 16 — fine.
ALTER TYPE "PerHeadSource" ADD VALUE IF NOT EXISTS 'ADULTS_PENDING_OR_CONFIRMED';
ALTER TYPE "PerHeadSource" ADD VALUE IF NOT EXISTS 'CHILDREN_PENDING_OR_CONFIRMED';
