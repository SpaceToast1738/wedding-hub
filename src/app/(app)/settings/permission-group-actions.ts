"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, PermissionLevel } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireUser } from "@/lib/actions";
import { BUILTIN_GROUP_SLUGS } from "@/lib/group-members";
import { SECTIONS } from "@/lib/permissions";

// v1.40.0 (backlog #3): PermissionGroup CRUD. Couple-only — group
// management is part of the couple's domain (deciding who's in the
// after-party / who gets a Sunday-brunch invite / etc.). Audit
// every mutating action with snapshot fields per the v1.30.5
// standing rule.
//
// v1.42.0: renamed from UserGroup → PermissionGroup. The model
// bundles admin app users for permission inheritance (future) and
// schedule-attendee picking (today). Distinct from GuestGroup,
// which lives in guest-group-actions.ts and bundles wedding guests.

export type GroupActionResult = { ok: true } | { ok: false; error: string };

const groupSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, digits, hyphens"),
  description: z.string().max(2000).nullable(),
});

async function requireCoupleEditor() {
  const user = await requireUser();
  if (!user.isCouple) throw new Error("Forbidden: groups are couple-only");
  return user;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureNotBuiltin(slug: string): void {
  if (BUILTIN_GROUP_SLUGS.has(slug)) {
    throw new Error(
      `Slug "${slug}" is reserved for a built-in group. Pick another.`,
    );
  }
}

export async function createPermissionGroup(formData: FormData): Promise<GroupActionResult> {
  const user = await requireCoupleEditor();
  try {
    const rawName = String(formData.get("name") ?? "").trim();
    const rawSlug = String(formData.get("slug") ?? "").trim();
    const description = (formData.get("description") as string | null)?.trim() || null;
    const slug = rawSlug || slugify(rawName);
    const parsed = groupSchema.parse({ name: rawName, slug, description });
    ensureNotBuiltin(parsed.slug);
    const last = await db.permissionGroup.findFirst({ orderBy: { order: "desc" } });
    const created = await db.permissionGroup.create({
      data: {
        slug: parsed.slug,
        name: parsed.name,
        description: parsed.description,
        order: (last?.order ?? -1) + 1,
      },
    });
    await audit(user, {
      action: "create",
      entity: "PermissionGroup",
      entityId: created.id,
      metadata: { slug: created.slug, name: created.name },
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "A group with that slug already exists" };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't create group" };
  }
}

export async function updatePermissionGroup(
  id: string,
  formData: FormData,
): Promise<GroupActionResult> {
  const user = await requireCoupleEditor();
  try {
    const rawName = String(formData.get("name") ?? "").trim();
    const rawSlug = String(formData.get("slug") ?? "").trim();
    const description = (formData.get("description") as string | null)?.trim() || null;
    const slug = rawSlug || slugify(rawName);
    const parsed = groupSchema.parse({ name: rawName, slug, description });
    ensureNotBuiltin(parsed.slug);

    const before = await db.permissionGroup.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "Group not found" };

    await db.permissionGroup.update({
      where: { id },
      data: {
        slug: parsed.slug,
        name: parsed.name,
        description: parsed.description,
      },
    });
    const changedFields: string[] = [];
    if (before.slug !== parsed.slug) changedFields.push("slug");
    if (before.name !== parsed.name) changedFields.push("name");
    if (before.description !== parsed.description) changedFields.push("description");

    await audit(user, {
      action: "update",
      entity: "PermissionGroup",
      entityId: id,
      metadata: { slug: parsed.slug, name: parsed.name, changedFields },
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "A group with that slug already exists" };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't update group" };
  }
}

export async function deletePermissionGroup(id: string): Promise<GroupActionResult> {
  const user = await requireCoupleEditor();
  try {
    const before = await db.permissionGroup.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!before) return { ok: false, error: "Group not found" };
    await db.permissionGroup.delete({ where: { id } });
    await audit(user, {
      action: "delete",
      entity: "PermissionGroup",
      entityId: id,
      metadata: {
        slug: before.slug,
        name: before.name,
        memberCount: before._count.members,
      },
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't delete group" };
  }
}

const memberToggleSchema = z.object({
  groupId: z.string().min(1),
  userId: z.string().min(1),
  on: z.boolean(),
});

export async function togglePermissionGroupMember(input: {
  groupId: string;
  userId: string;
  on: boolean;
}): Promise<GroupActionResult> {
  const actor = await requireCoupleEditor();
  try {
    const parsed = memberToggleSchema.parse(input);
    const group = await db.permissionGroup.findUnique({
      where: { id: parsed.groupId },
      select: { id: true, slug: true, name: true },
    });
    if (!group) return { ok: false, error: "Group not found" };
    const member = await db.user.findUnique({
      where: { id: parsed.userId },
      select: { id: true, email: true, firstName: true, lastName: true, name: true },
    });
    if (!member) return { ok: false, error: "User not found" };

    if (parsed.on) {
      // Adding — set adds; safe to call even if already a member.
      await db.permissionGroup.update({
        where: { id: group.id },
        data: { members: { connect: { id: member.id } } },
      });
    } else {
      await db.permissionGroup.update({
        where: { id: group.id },
        data: { members: { disconnect: { id: member.id } } },
      });
    }
    await audit(actor, {
      action: parsed.on ? "member-add" : "member-remove",
      entity: "PermissionGroup",
      entityId: group.id,
      metadata: {
        slug: group.slug,
        name: group.name,
        memberId: member.id,
        memberEmail: member.email,
        memberName:
          [member.firstName, member.lastName].filter(Boolean).join(" ").trim() ||
          member.name ||
          null,
      },
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't update group membership",
    };
  }
}

// ─── Group permission setter (v1.43.0) ───────────────────────────────
//
// Sets the level of one (group, section) pair. Accepts a polymorphic
// `groupKey` string in the same `"builtin:<slug>"` / `"group:<slug>"`
// format used everywhere else (Schedule attendees, group-members
// helpers, GroupPermission table). Validates that the slug refers to
// either a known built-in or an existing PermissionGroup row before
// writing — guards against typo'd keys silently going nowhere.
//
// Couple-only. Audited with the resolved group name + section + level
// per the v1.30.5 standing rule.

const setGroupPermSchema = z.object({
  groupKey: z.string().min(1),
  section: z.enum(SECTIONS),
  level: z.nativeEnum(PermissionLevel),
});

export async function setGroupPermission(input: {
  groupKey: string;
  section: string;
  level: PermissionLevel;
}): Promise<GroupActionResult> {
  const actor = await requireCoupleEditor();
  try {
    const parsed = setGroupPermSchema.parse(input);

    // Resolve groupKey → display name for the audit log + validate
    // that the key actually points at something. Built-in slugs live
    // in BUILTIN_GROUP_SLUGS; custom slugs come from PermissionGroup.
    let groupName: string;
    if (parsed.groupKey.startsWith("builtin:")) {
      const slug = parsed.groupKey.slice("builtin:".length);
      if (!BUILTIN_GROUP_SLUGS.has(slug)) {
        return { ok: false, error: `Unknown built-in group: ${slug}` };
      }
      groupName = slug; // the BUILTIN_GROUPS array would give a prettier label, but the slug is fine for audits
    } else if (parsed.groupKey.startsWith("group:")) {
      const slug = parsed.groupKey.slice("group:".length);
      const row = await db.permissionGroup.findUnique({
        where: { slug },
        select: { name: true },
      });
      if (!row) return { ok: false, error: `Unknown group: ${slug}` };
      groupName = row.name;
    } else {
      return {
        ok: false,
        error: `groupKey must start with "builtin:" or "group:"`,
      };
    }

    await db.groupPermission.upsert({
      where: {
        groupKey_section: {
          groupKey: parsed.groupKey,
          section: parsed.section,
        },
      },
      create: {
        groupKey: parsed.groupKey,
        section: parsed.section,
        level: parsed.level,
      },
      update: { level: parsed.level },
    });

    await audit(actor, {
      action: "group-permission",
      entity: "PermissionGroup",
      entityId: parsed.groupKey,
      metadata: {
        groupKey: parsed.groupKey,
        groupName,
        section: parsed.section,
        level: parsed.level,
      },
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't set group permission",
    };
  }
}
