"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, Side } from "@prisma/client";
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
  // v1.48.0: per-group side constraint for the ceremony seating
  // allocator. Default BOTH so existing callers don't need to opt in.
  side: z.nativeEnum(Side).default(Side.BOTH),
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
    const rawSide = String(formData.get("side") ?? "BOTH").trim();
    const slug = rawSlug || slugify(rawName);
    const parsed = groupSchema.parse({
      name: rawName,
      slug,
      description,
      colour: rawColour,
      side: rawSide,
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
        side: parsed.side,
        order: (last?.order ?? -1) + 1,
      },
    });
    await audit(user, {
      action: "create",
      entity: "GuestGroup",
      entityId: created.id,
      metadata: { slug: created.slug, name: created.name, colour: created.colour, side: created.side },
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
    const rawSide = String(formData.get("side") ?? "BOTH").trim();
    const slug = rawSlug || slugify(rawName);
    const parsed = groupSchema.parse({
      name: rawName,
      slug,
      description,
      colour: rawColour,
      side: rawSide,
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
        side: parsed.side,
      },
    });
    const changedFields: string[] = [];
    if (before.slug !== parsed.slug) changedFields.push("slug");
    if (before.name !== parsed.name) changedFields.push("name");
    if (before.description !== parsed.description) changedFields.push("description");
    if (before.colour !== colour) changedFields.push("colour");
    if (before.side !== parsed.side) changedFields.push("side");

    await audit(user, {
      action: "update",
      entity: "GuestGroup",
      entityId: id,
      metadata: {
        slug: parsed.slug,
        name: parsed.name,
        colour,
        side: parsed.side,
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

// v1.48.0: nudge a guest group up or down in the ordered list. The
// ceremony seating allocator walks groups in `order` ascending — the
// first group fills the front aisle, the next fills behind, etc.
// Couples need to reorder without dropping into Settings to set
// numeric values manually.
//
// Implementation: swap the `order` field with the adjacent group on
// the chosen direction. Done in a transaction so two simultaneous
// reorders can't end up with duplicate `order` values.
const reorderSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

export async function reorderGuestGroup(input: {
  id: string;
  direction: "up" | "down";
}): Promise<GuestGroupActionResult> {
  const actor = await requireCoupleEditor();
  try {
    const parsed = reorderSchema.parse(input);
    const target = await db.guestGroup.findUnique({
      where: { id: parsed.id },
      select: { id: true, order: true, name: true },
    });
    if (!target) return { ok: false, error: "Guest group not found" };

    // Find the adjacent group: "up" means the one with the highest
    // `order` strictly less than ours; "down" means the lowest above.
    const neighbour = await db.guestGroup.findFirst({
      where:
        parsed.direction === "up"
          ? { order: { lt: target.order } }
          : { order: { gt: target.order } },
      orderBy: { order: parsed.direction === "up" ? "desc" : "asc" },
      select: { id: true, order: true, name: true },
    });
    if (!neighbour) {
      // Already at the edge — no-op rather than an error so the
      // button can stay clickable without throwing.
      return { ok: true };
    }

    // Swap orders in a transaction. Note the schema doesn't have a
    // unique constraint on `order` so the intermediate state where
    // both rows briefly hold the same value is fine.
    await db.$transaction([
      db.guestGroup.update({
        where: { id: target.id },
        data: { order: neighbour.order },
      }),
      db.guestGroup.update({
        where: { id: neighbour.id },
        data: { order: target.order },
      }),
    ]);

    await audit(actor, {
      action: "reorder",
      entity: "GuestGroup",
      entityId: target.id,
      metadata: {
        name: target.name,
        direction: parsed.direction,
        neighbourId: neighbour.id,
        neighbourName: neighbour.name,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/seating");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't reorder guest group",
    };
  }
}
