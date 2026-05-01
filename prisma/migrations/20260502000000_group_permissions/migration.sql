-- v1.43.0: group-level permissions
--
-- Adds the GroupPermission table — permissions live on groups now,
-- members inherit. The legacy per-user `Permission` table stays
-- untouched as an override layer: effective level becomes
-- max(group-inherited, per-user-override). No data movement; nobody
-- loses access. See src/lib/permissions.ts for the resolver and
-- prisma/schema.prisma for the field-level commentary.

CREATE TABLE "GroupPermission" (
    "id" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "level" "PermissionLevel" NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupPermission_pkey" PRIMARY KEY ("id")
);

-- One row per (group, section) — the resolver expects at most one
-- level per pair; upsert against this constraint.
CREATE UNIQUE INDEX "GroupPermission_groupKey_section_key"
    ON "GroupPermission"("groupKey", "section");

-- Lookup index for "all permissions for these groupKeys" — the
-- effective-permissions resolver fans out group keys into a single
-- IN-list query, so an index on groupKey alone is enough.
CREATE INDEX "GroupPermission_groupKey_idx"
    ON "GroupPermission"("groupKey");
