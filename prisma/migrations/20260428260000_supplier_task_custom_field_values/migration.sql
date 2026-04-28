-- v1.22.0: extend custom-fields infrastructure to Supplier + Task.
-- Mirrors v1.15.0's addition of customFieldValues to Guest. Nullable
-- so existing rows aren't forced to populate.

ALTER TABLE "Supplier" ADD COLUMN "customFieldValues" JSONB;
ALTER TABLE "Task"     ADD COLUMN "customFieldValues" JSONB;
