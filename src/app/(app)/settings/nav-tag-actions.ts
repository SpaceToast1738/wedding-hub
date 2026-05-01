"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireUser } from "@/lib/actions";

// v1.30.5: NavTag CRUD. Settings is couple-only — couple is the
// audience for nav-tag management. Audit metadata follows the
// audit-aware-feature-design standing rule: capture name + slug +
// route on every mutating action so the audit log reads usefully
// without rejoining.

async function requireCoupleEditor() {
  const user = await requireUser();
  if (!user.isCouple) throw new Error("Forbidden: nav tags are couple-only");
  return user;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  slug: z.string().min(1).max(60).optional(),
  route: z.string().max(200).optional().nullable(),
  order: z.number().int().optional(),
});

export async function createNavTag(formData: FormData) {
  const user = await requireCoupleEditor();
  const parsed = createSchema.parse({
    name: String(formData.get("name") ?? ""),
    slug: formData.get("slug") ? String(formData.get("slug")) : undefined,
    route: formData.get("route") ? String(formData.get("route")) : null,
    order: formData.get("order") ? Number(formData.get("order")) : undefined,
  });
  const slug = parsed.slug && parsed.slug.trim() ? slugify(parsed.slug) : slugify(parsed.name);
  if (!slug) throw new Error("Slug must contain at least one alphanumeric character");
  // Auto-pick next order if not given.
  let order = parsed.order;
  if (order === undefined) {
    const last = await db.navTag.findFirst({ orderBy: { order: "desc" } });
    order = (last?.order ?? 0) + 1;
  }
  const created = await db.navTag.create({
    data: {
      name: parsed.name,
      slug,
      route: parsed.route ?? null,
      order,
    },
  });
  await audit(user, {
    action: "create",
    entity: "NavTag",
    entityId: created.id,
    metadata: {
      name: created.name,
      slug: created.slug,
      route: created.route,
      order: created.order,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/tasks");
  revalidatePath("/questions");
}

const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  slug: z.string().min(1).max(60).optional(),
  route: z.string().max(200).optional().nullable(),
  order: z.number().int().optional(),
});

export async function updateNavTag(id: string, formData: FormData) {
  const user = await requireCoupleEditor();
  const before = await db.navTag.findUnique({ where: { id } });
  if (!before) throw new Error("NavTag not found");
  const parsed = updateSchema.parse({
    name: formData.get("name") ? String(formData.get("name")) : undefined,
    slug: formData.get("slug") ? String(formData.get("slug")) : undefined,
    route: formData.get("route") !== null && formData.get("route") !== undefined
      ? String(formData.get("route"))
      : undefined,
    order: formData.get("order") ? Number(formData.get("order")) : undefined,
  });
  const data: Record<string, unknown> = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.slug !== undefined) data.slug = slugify(parsed.slug);
  if (parsed.route !== undefined) data.route = parsed.route || null;
  if (parsed.order !== undefined) data.order = parsed.order;
  const updated = await db.navTag.update({ where: { id }, data });

  const changedFields: string[] = [];
  if (data.name !== undefined && data.name !== before.name) changedFields.push("name");
  if (data.slug !== undefined && data.slug !== before.slug) changedFields.push("slug");
  if (data.route !== undefined && data.route !== before.route) changedFields.push("route");
  if (data.order !== undefined && data.order !== before.order) changedFields.push("order");

  await audit(user, {
    action: "update",
    entity: "NavTag",
    entityId: id,
    metadata: {
      name: updated.name,
      slug: updated.slug,
      route: updated.route,
      order: updated.order,
      changedFields,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/tasks");
  revalidatePath("/questions");
}

export async function deleteNavTag(id: string) {
  const user = await requireCoupleEditor();
  const before = await db.navTag.findUnique({
    where: { id },
    include: { _count: { select: { tasks: true } } },
  });
  if (!before) throw new Error("NavTag not found");
  await db.navTag.delete({ where: { id } });
  // m2m junction rows cascade-delete automatically; tasks survive
  // and just lose the link.
  await audit(user, {
    action: "delete",
    entity: "NavTag",
    entityId: id,
    metadata: {
      name: before.name,
      slug: before.slug,
      route: before.route,
      linkedTaskCount: before._count.tasks,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/tasks");
  revalidatePath("/questions");
}

// v1.54.0 (C3): nudge a nav tag up or down in the order. Mirrors
// reorderGuestGroup / reorderPermissionGroup. Couple-only, audited.
const navReorderSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

export async function reorderNavTag(input: {
  id: string;
  direction: "up" | "down";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireCoupleEditor();
  try {
    const parsed = navReorderSchema.parse(input);
    const target = await db.navTag.findUnique({
      where: { id: parsed.id },
      select: { id: true, order: true, name: true },
    });
    if (!target) return { ok: false, error: "Nav tag not found" };

    const neighbour = await db.navTag.findFirst({
      where:
        parsed.direction === "up"
          ? { order: { lt: target.order } }
          : { order: { gt: target.order } },
      orderBy: { order: parsed.direction === "up" ? "desc" : "asc" },
      select: { id: true, order: true, name: true },
    });
    if (!neighbour) return { ok: true }; // edge — no-op

    await db.$transaction([
      db.navTag.update({
        where: { id: target.id },
        data: { order: neighbour.order },
      }),
      db.navTag.update({
        where: { id: neighbour.id },
        data: { order: target.order },
      }),
    ]);

    await audit(actor, {
      action: "reorder",
      entity: "NavTag",
      entityId: target.id,
      metadata: {
        name: target.name,
        direction: parsed.direction,
        neighbourId: neighbour.id,
        neighbourName: neighbour.name,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/tasks");
    revalidatePath("/questions");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't reorder nav tag",
    };
  }
}
