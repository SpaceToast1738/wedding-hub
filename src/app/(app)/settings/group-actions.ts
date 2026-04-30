"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireUser } from "@/lib/actions";
import { BUILTIN_GROUP_SLUGS } from "@/lib/group-members";

// v1.40.0 (backlog #3): UserGroup CRUD. Couple-only — group
// management is part of the couple's domain (deciding who's in the
// after-party / who gets a Sunday-brunch invite / etc.). Audit
// every mutating action with snapshot fields per the v1.30.5
// standing rule.

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

export async function createUserGroup(formData: FormData): Promise<GroupActionResult> {
  const user = await requireCoupleEditor();
  try {
    const rawName = String(formData.get("name") ?? "").trim();
    const rawSlug = String(formData.get("slug") ?? "").trim();
    const description = (formData.get("description") as string | null)?.trim() || null;
    const slug = rawSlug || slugify(rawName);
    const parsed = groupSchema.parse({ name: rawName, slug, description });
    ensureNotBuiltin(parsed.slug);
    const last = await db.userGroup.findFirst({ orderBy: { order: "desc" } });
    const created = await db.userGroup.create({
      data: {
        slug: parsed.slug,
        name: parsed.name,
        description: parsed.description,
        order: (last?.order ?? -1) + 1,
      },
    });
    await audit(user, {
      action: "create",
      entity: "UserGroup",
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

export async function updateUserGroup(
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

    const before = await db.userGroup.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "Group not found" };

    await db.userGroup.update({
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
      entity: "UserGroup",
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

export async function deleteUserGroup(id: string): Promise<GroupActionResult> {
  const user = await requireCoupleEditor();
  try {
    const before = await db.userGroup.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!before) return { ok: false, error: "Group not found" };
    await db.userGroup.delete({ where: { id } });
    await audit(user, {
      action: "delete",
      entity: "UserGroup",
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

export async function toggleUserGroupMember(input: {
  groupId: string;
  userId: string;
  on: boolean;
}): Promise<GroupActionResult> {
  const actor = await requireCoupleEditor();
  try {
    const parsed = memberToggleSchema.parse(input);
    const group = await db.userGroup.findUnique({
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
      await db.userGroup.update({
        where: { id: group.id },
        data: { members: { connect: { id: member.id } } },
      });
    } else {
      await db.userGroup.update({
        where: { id: group.id },
        data: { members: { disconnect: { id: member.id } } },
      });
    }
    await audit(actor, {
      action: parsed.on ? "member-add" : "member-remove",
      entity: "UserGroup",
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
