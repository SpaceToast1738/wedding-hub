-- v1.42.0: rename UserGroup → PermissionGroup (clearer intent: this
-- is the "permission inheritance" track for app users), and add a
-- new GuestGroup model for organising wedding guests (entirely
-- different cohort — used for ceremony-seating colour-coding etc.).
--
-- The rename is structural-only — no data lost. Pre-existing custom
-- groups (e.g. the seeded "After-party") survive intact under the
-- new table name.

-- 1. Rename the table + indexes + unique constraint.
ALTER TABLE "UserGroup" RENAME TO "PermissionGroup";
ALTER INDEX "UserGroup_pkey" RENAME TO "PermissionGroup_pkey";
ALTER INDEX "UserGroup_slug_key" RENAME TO "PermissionGroup_slug_key";

-- 2. Rename the implicit m2m table (Prisma convention is
--    _<RelationName>; v1.40.0 used "UserGroupMembers" so the join
--    table was _UserGroupMembers — now _PermissionGroupMembers).
ALTER TABLE "_UserGroupMembers" RENAME TO "_PermissionGroupMembers";
ALTER INDEX "_UserGroupMembers_AB_pkey" RENAME TO "_PermissionGroupMembers_AB_pkey";
ALTER INDEX "_UserGroupMembers_B_index" RENAME TO "_PermissionGroupMembers_B_index";
ALTER TABLE "_PermissionGroupMembers"
    RENAME CONSTRAINT "_UserGroupMembers_A_fkey" TO "_PermissionGroupMembers_A_fkey";
ALTER TABLE "_PermissionGroupMembers"
    RENAME CONSTRAINT "_UserGroupMembers_B_fkey" TO "_PermissionGroupMembers_B_fkey";

-- 3. New GuestGroup model.
CREATE TABLE "GuestGroup" (
    "id"          TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "colour"      TEXT,
    "order"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestGroup_slug_key" ON "GuestGroup"("slug");

-- 4. Implicit m2m for Guest ↔ GuestGroup. Prisma's relation name
--    "GuestGroupMembers" maps to a join table named _GuestGroupMembers
--    (alphabetical AB convention: A=Guest, B=GuestGroup).
CREATE TABLE "_GuestGroupMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GuestGroupMembers_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_GuestGroupMembers_B_index" ON "_GuestGroupMembers"("B");

-- A = Guest.id, B = GuestGroup.id.
ALTER TABLE "_GuestGroupMembers"
    ADD CONSTRAINT "_GuestGroupMembers_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Guest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_GuestGroupMembers"
    ADD CONSTRAINT "_GuestGroupMembers_B_fkey"
    FOREIGN KEY ("B") REFERENCES "GuestGroup"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
