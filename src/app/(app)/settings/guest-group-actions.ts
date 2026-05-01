"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireUser } from "@/lib/actions";
import {
  BUILTIN_GUEST_GROUP_SLUGS,
  normaliseHexColour,
} from "@/lib/guest-group-members";

// v1.42.0: GuestGroup CRUD. Couple-only — bundling wedding guests
// is the couple's organisational call (who's family / who's uni
// friends / who's after-party). Distinct from PermissionGroup,
// which bundles admin app users in permission-group-actions.ts.

export type GuestGroupActionResult = { ok: true } | { ok: false; error: string };

const groupSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, digits, hyphens"),
  description: z.string().max(2000).nullable(),
  // Hex string is validated + normalised by normaliseHexColour
  // before write; here we just allow it through Zod for shape.
  colour: z.string().max(20).nullable(),
});

async function requireCoupleEditor() {
  const user = await requireUser();
  if (!user.isCouple) throw new Error("Forbidden: guest groups are couple-only");
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
  if (BUILTIN_GUEST_GROUP_SLUGS.has(slug)) {
    throw new Error(
      `Slug "${slug}" is reserved for a built-in guest group. Pick another.`,
    );
  }
}

export async function createGuestGroup(formData: FormData): Promise<GuestGroupActionResult> {
  const user = await requireCoupleEditor();
  try {
    const rawName = String(formData.get("name") ?? "").trim();
    const rawSlug = String(formData.get("slug") ?? "").trim();
    const description = (formData.get("description") as string | null)?.trim() || null;
    const rawColour = (formData.get("colour") as string | null)?.trim() || null;
    const slug = rawSlug || slugify(rawName);
    const parsed = groupSchema.parse({
      name: rawName,
      slug,
      description,
      colour: rawColour,
    });
    ensureNotBuiltin(parsed.slug);
    const colour = normaliseHexColour(parsed.colour);
    const last = await db.guestGroup.findFirst({ orderBy: { order: "desc" } });
    const created = await db.guestGroup.create({
      data: {
        slug: parsed.slug,
        name: parsed.name,
        description: parsed.description,
        colour,
        order: (last?.order ?? -1) + 1,
      },
    });
    await audit(user, {
      action: "create",
      entity: "GuestGroup",
      entityId: created.id,
      metadata: { slug: created.slug, name: created.name, colour: created.colour },
    });
    revalidatePath("/settings");
    revalidatePath("/seating");
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "A guest group with that slug already exists" };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't create guest group" };
  }
}

export async function updateGuestGroup(
  id: string,
  formData: FormData,
): Promise<GuestGroupActionResult> {
  const user = await requireCoupleEditor();
  try {
    const rawName = String(formData.get("name") ?? "").trim();
    const rawSlug = String(formData.get("slug") ?? "").trim();
    const description = (formData.get("description") as string | null)?.trim() || null;
    const rawColour = (formData.get("colour") as string | null)?.trim() || null;
    const slug = rawSlug || slugify(rawName);
    const parsed = groupSchema.parse({
      name: rawName,
      slug,
      description,
      colour: rawColour,
    });
    ensureNotBuiltin(parsed.slug);
    const colour = normaliseHexColour(parsed.colour);

    const before = await db.guestGroup.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "Guest group not found" };

    await db.guestGroup.update({
      where: { id },
      data: {
        slug: parsed.slug,
        name: parsed.name,
        description: parsed.description,
        colour,
      },
    });
    const changedFields: string[] = [];
    if (before.slug !== parsed.slug) changedFields.push("slug");
    if (before.name !== parsed.name) changedFields.push("name");
    if (before.description !== parsed.description) changedFields.push("description");
    if (before.colour !== colour) changedFields.push("colour");

    await audit(user, {
      action: "update",
      entity: "GuestGroup",
      entityId: id,
      metadata: {
        slug: parsed.slug,
        name: parsed.name,
        colour,
        changedFields,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/seating");
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "A guest group with that slug already exists" };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't update guest group" };
  }
}

export async function deleteGuestGroup(id: string): Promise<GuestGroupActionResult> {
  const user = await requireCoupleEditor();
  try {
    const before = await db.guestGroup.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!before) return { ok: false, error: "Guest group not found" };
    await db.guestGroup.delete({ where: { id } });
    await audit(user, {
      action: "delete",
      entity: "GuestGroup",
      entityId: id,
      metadata: {
        slug: before.slug,
        name: before.name,
        memberCount: before._count.members,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/seating");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't delete guest group" };
  }
}

const memberToggleSchema = z.object({
  groupId: z.string().min(1),
  guestId: z.string().min(1),
  on: z.boolean(),
});

export async function toggleGuestGroupMember(input: {
  groupId: string;
  guestId: string;
  on: boolean;
}): Promise<GuestGroupActionResult> {
  const actor = await requireCoupleEditor();
  try {
    const parsed = memberToggleSchema.parse(input);
    const group = await db.guestGroup.findUnique({
      where: { id: parsed.groupId },
      select: { id: true, slug: true, name: true },
    });
    if (!group) return { ok: false, error: "Guest group not found" };
    const guest = await db.guest.findUnique({
      where: { id: parsed.guestId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!guest) return { ok: false, error: "Guest not found" };

    if (parsed.on) {
      await db.guestGroup.update({
        where: { id: group.id },
        data: { members: { connect: { id: guest.id } } },
      });
    } else {
      await db.guestGroup.update({
        where: { id: group.id },
        data: { members: { disconnect: { id: guest.id } } },
      });
    }
    await audit(actor, {
      action: parsed.on ? "member-add" : "member-remove",
      entity: "GuestGroup",
      entityId: group.id,
      metadata: {
        slug: group.slug,
        name: group.name,
        guestId: guest.id,
        guestName: [guest.firstName, guest.lastName].filter(Boolean).join(" ").trim(),
      },
    });
    revalidatePath("/settings");
    revalidatePath("/seating");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't update guest-group membership",
    };
  }
}
