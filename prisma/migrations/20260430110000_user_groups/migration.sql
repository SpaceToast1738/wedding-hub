-- v1.40.0 (backlog #3): UserGroup model + User m2m. Foundation for
-- the schedule-attendees rework (backlog #4) and any future per-group
-- permission overrides. Additive only — no existing data touched.

CREATE TABLE "UserGroup" (
    "id"          TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "order"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserGroup_slug_key" ON "UserGroup"("slug");

-- Implicit m2m for User ↔ UserGroup. Prisma's relation name
-- "UserGroupMembers" maps to a join table named _UserGroupMembers.
CREATE TABLE "_UserGroupMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserGroupMembers_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_UserGroupMembers_B_index" ON "_UserGroupMembers"("B");

-- A = UserGroup.id, B = User.id (alphabetical convention used by
-- Prisma's implicit m2m).
ALTER TABLE "_UserGroupMembers"
    ADD CONSTRAINT "_UserGroupMembers_A_fkey"
    FOREIGN KEY ("A") REFERENCES "UserGroup"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_UserGroupMembers"
    ADD CONSTRAINT "_UserGroupMembers_B_fkey"
    FOREIGN KEY ("B") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
