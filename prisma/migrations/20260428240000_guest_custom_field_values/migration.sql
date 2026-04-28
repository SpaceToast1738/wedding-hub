-- C10 (v1.15.0): per-guest custom field values keyed by CustomField.id.
-- The CustomField table itself already exists; this column adds the
-- instance-data column to Guest. Nullable so existing rows aren't
-- forced to populate.
ALTER TABLE "Guest" ADD COLUMN "customFieldValues" JSONB;
