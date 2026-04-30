"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BookSubsectionKind, BookSubsectionVisibility, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit, requireUser } from "@/lib/actions";
import {
  parseBookFieldValue,
  validateOutfit,
  validateRecipe,
  validateShot,
  type BookFieldDefShape,
  type BookFieldValues,
  type BookOutfitShape,
  type BookRecipeShape,
  type BookShotShape,
} from "@/lib/book-cards";

// v1.26.0: shared result shape — every new action returns this rather
// than throwing, so Next production redaction can't swallow the
// validation message (see v1.22.9 / v1.23.2).
export type BookActionResult = { ok: true } | { ok: false; error: string };

const sectionSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "slug: lowercase letters, numbers, dashes only"),
  title: z.string().min(1).max(120),
});

const subsectionSchema = z.object({
  sectionId: z.string().min(1),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(120),
  body: z.string().max(20000).optional().nullable(),
  kind: z.nativeEnum(BookSubsectionKind).default(BookSubsectionKind.TEXT),
});

export async function createBookSection(formData: FormData) {
  const user = await requireEdit("book");
  const parsed = sectionSchema.parse({
    slug: formData.get("slug"),
    title: formData.get("title"),
  });
  const last = await db.bookSection.findFirst({ orderBy: { order: "desc" } });
  const created = await db.bookSection.create({
    data: { slug: parsed.slug, title: parsed.title, order: (last?.order ?? -1) + 1 },
  });
  await audit(user, { action: "create", entity: "BookSection", entityId: created.id });
  revalidatePath("/book");
}

export async function deleteBookSection(id: string) {
  const user = await requireEdit("book");
  await db.bookSection.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "BookSection", entityId: id });
  revalidatePath("/book");
}

// v1.26.0: kind-aware. Every new card seeds the per-kind structured
// data so the renderer never has to handle a missing relation.
export async function createBookSubsection(formData: FormData) {
  const user = await requireEdit("book");
  const parsed = subsectionSchema.parse({
    sectionId: formData.get("sectionId"),
    slug: formData.get("slug"),
    title: formData.get("title"),
    body: formData.get("body") || null,
    kind: (formData.get("kind") as BookSubsectionKind | null) ?? BookSubsectionKind.TEXT,
  });
  const last = await db.bookSubsection.findFirst({
    where: { sectionId: parsed.sectionId },
    orderBy: { order: "desc" },
  });
  const created = await db.bookSubsection.create({
    data: {
      sectionId: parsed.sectionId,
      slug: parsed.slug,
      title: parsed.title,
      body: parsed.body ?? null,
      kind: parsed.kind,
      order: (last?.order ?? -1) + 1,
    },
  });
  // Seed the per-kind child for non-TEXT kinds so the renderer always
  // has somewhere to read from. The structured tables (Recipe / ShotList
  // / OutfitCard) all have a `subsectionId` UNIQUE constraint, so only
  // one row per subsection — these inserts never duplicate.
  if (parsed.kind === BookSubsectionKind.RECIPE) {
    await db.bookRecipe.create({
      data: {
        subsectionId: created.id,
        ingredients: [] as Prisma.InputJsonValue,
        steps: [] as Prisma.InputJsonValue,
      },
    });
  } else if (parsed.kind === BookSubsectionKind.SHOT_LIST) {
    await db.bookShotList.create({ data: { subsectionId: created.id } });
  } else if (parsed.kind === BookSubsectionKind.OUTFIT) {
    await db.bookOutfitCard.create({ data: { subsectionId: created.id } });
  } else if (parsed.kind === BookSubsectionKind.BUILD) {
    // v1.31.0: BUILD card child seeds with all-null fields. The
    // editor renders an empty Materials list and Sessions log; the
    // header shows "—" until the user fills anything in.
    await db.bookBuildCard.create({ data: { subsectionId: created.id } });
  }
  // FIELD card seeds the value bag lazily — fields stays null until
  // the user adds the first def + value.
  await audit(user, {
    action: "create",
    entity: "BookSubsection",
    entityId: created.id,
    metadata: { kind: parsed.kind },
  });
  revalidatePath("/book");
  const section = await db.bookSection.findUnique({ where: { id: parsed.sectionId } });
  if (section) revalidatePath(`/book/${section.slug}`);
}

export async function updateBookSubsection(id: string, formData: FormData) {
  const user = await requireEdit("book");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  if (!title) throw new Error("Title is required");
  const updated = await db.bookSubsection.update({
    where: { id },
    data: { title, body: body || null },
    include: { section: true },
  });
  await audit(user, { action: "update", entity: "BookSubsection", entityId: id });
  revalidatePath("/book");
  revalidatePath(`/book/${updated.section.slug}`);
}

export async function deleteBookSubsection(id: string) {
  const user = await requireEdit("book");
  const sub = await db.bookSubsection.findUnique({ where: { id }, include: { section: true } });
  await db.bookSubsection.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "BookSubsection", entityId: id });
  revalidatePath("/book");
  if (sub) revalidatePath(`/book/${sub.section.slug}`);
}

// C1 (v1.14.0): only the couple can flip a subsection's visibility.
// Same shape as the A6 file-visibility gate (post-audit lockdown):
// non-couple users with edit-on-book can edit content, but only the
// couple decides what's couple-only.
export async function setBookSubsectionVisibility(
  id: string,
  visibility: BookSubsectionVisibility,
) {
  const user = await requireUser();
  if (!user.isCouple) {
    throw new Error("Forbidden: only the couple can change page visibility");
  }
  const sub = await db.bookSubsection.update({
    where: { id },
    data: { visibility },
    include: { section: true },
  });
  await audit(user, {
    action: "visibility",
    entity: "BookSubsection",
    entityId: id,
    metadata: { visibility },
  });
  revalidatePath("/book");
  revalidatePath(`/book/${sub.section.slug}`);
}

// v1.24.0: same gate, applied at the BookSection level so the couple
// can hide a whole section (not just individual pages). Mirrors the
// subsection action above 1:1.
export async function setBookSectionVisibility(
  id: string,
  visibility: BookSubsectionVisibility,
) {
  const user = await requireUser();
  if (!user.isCouple) {
    throw new Error("Forbidden: only the couple can change section visibility");
  }
  const section = await db.bookSection.update({
    where: { id },
    data: { visibility },
  });
  await audit(user, {
    action: "visibility",
    entity: "BookSection",
    entityId: id,
    metadata: { visibility },
  });
  revalidatePath("/book");
  revalidatePath(`/book/${section.slug}`);
}

// ─── v1.26.0 — FIELD card actions ─────────────────────────────────

const fieldDefSchema = z.object({
  label: z.string().min(1).max(120),
  type: z.enum(["text", "number", "date", "select"]),
  options: z.array(z.string().min(1).max(80)).max(40).default([]),
});

async function revalidateBookSubsection(id: string) {
  const sub = await db.bookSubsection.findUnique({
    where: { id },
    include: { section: true },
  });
  revalidatePath("/book");
  if (sub) revalidatePath(`/book/${sub.section.slug}`);
}

export async function addBookFieldDef(
  subsectionId: string,
  label: string,
  type: string,
  options: string[],
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = fieldDefSchema.parse({ label, type, options });
    const last = await db.bookFieldDef.findFirst({
      where: { subsectionId },
      orderBy: { order: "desc" },
    });
    await db.bookFieldDef.create({
      data: {
        subsectionId,
        label: parsed.label,
        type: parsed.type,
        options: parsed.type === "select" ? parsed.options : [],
        order: (last?.order ?? -1) + 1,
      },
    });
    await audit(user, { action: "field-add", entity: "BookSubsection", entityId: subsectionId });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't add field" };
  }
}

export async function deleteBookFieldDef(id: string): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const def = await db.bookFieldDef.findUnique({ where: { id } });
    if (!def) return { ok: false, error: "Field not found" };
    await db.bookFieldDef.delete({ where: { id } });
    // Note: the value entry on BookSubsection.fields (Json bag) is
    // left in place as a dead key. Renderers skip unknown keys so
    // it's harmless. A future sweep could prune.
    await audit(user, { action: "field-delete", entity: "BookSubsection", entityId: def.subsectionId });
    await revalidateBookSubsection(def.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't delete field" };
  }
}

// Writes a single value into the BookSubsection.fields Json bag.
export async function setBookFieldValue(
  subsectionId: string,
  defId: string,
  rawValue: string | null,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const def = await db.bookFieldDef.findUnique({ where: { id: defId } });
    if (!def || def.subsectionId !== subsectionId) {
      return { ok: false, error: "Field not found on this card" };
    }
    const defShape: BookFieldDefShape = {
      id: def.id,
      label: def.label,
      type: def.type as BookFieldDefShape["type"],
      options: def.options,
      order: def.order,
    };
    const value = parseBookFieldValue(defShape, rawValue);
    const sub = await db.bookSubsection.findUnique({ where: { id: subsectionId } });
    const current = (sub?.fields as BookFieldValues | null) ?? {};
    const next: BookFieldValues = { ...current };
    if (value === null) {
      delete next[defId];
    } else {
      next[defId] = value;
    }
    await db.bookSubsection.update({
      where: { id: subsectionId },
      data: {
        fields:
          Object.keys(next).length === 0
            ? Prisma.JsonNull
            : (next as Prisma.InputJsonValue),
      },
    });
    await audit(user, { action: "field-set", entity: "BookSubsection", entityId: subsectionId });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save field" };
  }
}

// ─── v1.26.0 — RECIPE card action ─────────────────────────────────

export async function updateBookRecipe(
  subsectionId: string,
  ingredients: string[],
  steps: string[],
  notes: string | null,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const validated = validateRecipe({ ingredients, steps, notes } as BookRecipeShape);
    await db.bookRecipe.upsert({
      where: { subsectionId },
      update: {
        ingredients: validated.ingredients as Prisma.InputJsonValue,
        steps: validated.steps as Prisma.InputJsonValue,
        notes: validated.notes,
      },
      create: {
        subsectionId,
        ingredients: validated.ingredients as Prisma.InputJsonValue,
        steps: validated.steps as Prisma.InputJsonValue,
        notes: validated.notes,
      },
    });
    await audit(user, { action: "recipe-update", entity: "BookSubsection", entityId: subsectionId });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save recipe" };
  }
}

// ─── v1.26.0 — SHOT_LIST card actions ─────────────────────────────

export async function addBookShot(
  shotListId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const validated = validateShot({
      title: String(formData.get("title") ?? ""),
      withWhom: String(formData.get("withWhom") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      location: (formData.get("location") as string) || null,
      notes: (formData.get("notes") as string) || null,
    } as BookShotShape);
    const last = await db.bookShot.findFirst({
      where: { shotListId },
      orderBy: { order: "desc" },
    });
    const list = await db.bookShotList.findUnique({
      where: { id: shotListId },
      include: { subsection: true },
    });
    if (!list) return { ok: false, error: "Shot list not found" };
    await db.bookShot.create({
      data: {
        shotListId,
        title: validated.title,
        withWhom: validated.withWhom,
        location: validated.location,
        notes: validated.notes,
        order: (last?.order ?? -1) + 1,
      },
    });
    await audit(user, { action: "shot-add", entity: "BookSubsection", entityId: list.subsectionId });
    await revalidateBookSubsection(list.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't add shot" };
  }
}

export async function updateBookShot(
  id: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const validated = validateShot({
      title: String(formData.get("title") ?? ""),
      withWhom: String(formData.get("withWhom") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      location: (formData.get("location") as string) || null,
      notes: (formData.get("notes") as string) || null,
    } as BookShotShape);
    const updated = await db.bookShot.update({
      where: { id },
      data: validated,
      include: { shotList: true },
    });
    await audit(user, { action: "shot-update", entity: "BookSubsection", entityId: updated.shotList.subsectionId });
    await revalidateBookSubsection(updated.shotList.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save shot" };
  }
}

export async function toggleBookShotCaptured(
  id: string,
  captured: boolean,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const updated = await db.bookShot.update({
      where: { id },
      data: { captured, capturedAt: captured ? new Date() : null },
      include: { shotList: true },
    });
    await audit(user, { action: "shot-toggle", entity: "BookSubsection", entityId: updated.shotList.subsectionId });
    await revalidateBookSubsection(updated.shotList.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't toggle shot" };
  }
}

export async function deleteBookShot(id: string): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const shot = await db.bookShot.findUnique({ where: { id }, include: { shotList: true } });
    if (!shot) return { ok: false, error: "Shot not found" };
    await db.bookShot.delete({ where: { id } });
    await audit(user, { action: "shot-delete", entity: "BookSubsection", entityId: shot.shotList.subsectionId });
    await revalidateBookSubsection(shot.shotList.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't delete shot" };
  }
}

// ─── v1.26.0 — OUTFIT card actions ────────────────────────────────

export async function addBookOutfit(
  cardId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const validated = validateOutfit({
      personName: String(formData.get("personName") ?? ""),
      role: (formData.get("role") as string) || null,
      items: String(formData.get("items") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      supplier: (formData.get("supplier") as string) || null,
      status: (formData.get("status") as string) || null,
      notes: (formData.get("notes") as string) || null,
    } as BookOutfitShape);
    const last = await db.bookOutfit.findFirst({
      where: { cardId },
      orderBy: { order: "desc" },
    });
    const card = await db.bookOutfitCard.findUnique({ where: { id: cardId } });
    if (!card) return { ok: false, error: "Outfit card not found" };
    await db.bookOutfit.create({
      data: {
        cardId,
        personName: validated.personName,
        role: validated.role,
        items: validated.items,
        supplier: validated.supplier,
        status: validated.status,
        notes: validated.notes,
        order: (last?.order ?? -1) + 1,
      },
    });
    await audit(user, { action: "outfit-add", entity: "BookSubsection", entityId: card.subsectionId });
    await revalidateBookSubsection(card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't add outfit" };
  }
}

export async function updateBookOutfit(
  id: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const validated = validateOutfit({
      personName: String(formData.get("personName") ?? ""),
      role: (formData.get("role") as string) || null,
      items: String(formData.get("items") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      supplier: (formData.get("supplier") as string) || null,
      status: (formData.get("status") as string) || null,
      notes: (formData.get("notes") as string) || null,
    } as BookOutfitShape);
    const updated = await db.bookOutfit.update({
      where: { id },
      data: validated,
      include: { card: true },
    });
    await audit(user, { action: "outfit-update", entity: "BookSubsection", entityId: updated.card.subsectionId });
    await revalidateBookSubsection(updated.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save outfit" };
  }
}

export async function deleteBookOutfit(id: string): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const outfit = await db.bookOutfit.findUnique({ where: { id }, include: { card: true } });
    if (!outfit) return { ok: false, error: "Outfit not found" };
    await db.bookOutfit.delete({ where: { id } });
    await audit(user, { action: "outfit-delete", entity: "BookSubsection", entityId: outfit.card.subsectionId });
    await revalidateBookSubsection(outfit.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't delete outfit" };
  }
}

// ── v1.31.0: BUILD card actions ──────────────────────────────────────
//
// One card per DIY project. Card-level fields hold the production
// metadata (status, target date, prototype done, est minutes per unit);
// materials are line items (with `ordered` / `arrived` flags); sessions
// log production time + units completed. All audit calls per the
// v1.30.5 audit-aware-feature-design rule — snapshot fields + a
// changedFields diff on updates.

const buildCardUpdateSchema = z.object({
  quantityNeeded: z.coerce.number().int().min(0).optional().nullable(),
  targetDate: z.string().optional().nullable(),
  status: z.string().max(40).optional().nullable(),
  prototypeDone: z.coerce.boolean().optional(),
  prototypeNotes: z.string().max(2000).optional().nullable(),
  estimatedMinutesPerUnit: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

function parseDate(v: FormDataEntryValue | null | undefined): Date | null | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function updateBuildCard(
  subsectionId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const before = await db.bookBuildCard.findUnique({ where: { subsectionId } });
    if (!before) return { ok: false, error: "Build card not found" };
    const raw = {
      quantityNeeded: formData.get("quantityNeeded") ?? undefined,
      targetDate: formData.get("targetDate") ?? undefined,
      status: formData.get("status") ?? undefined,
      prototypeDone: formData.get("prototypeDone") === "on" || formData.get("prototypeDone") === "true",
      prototypeNotes: formData.get("prototypeNotes") ?? undefined,
      estimatedMinutesPerUnit: formData.get("estimatedMinutesPerUnit") ?? undefined,
      notes: formData.get("notes") ?? undefined,
    };
    const parsed = buildCardUpdateSchema.parse(raw);
    const data: Record<string, unknown> = {};
    if (parsed.quantityNeeded !== undefined) data.quantityNeeded = parsed.quantityNeeded;
    if (parsed.targetDate !== undefined) data.targetDate = parseDate(parsed.targetDate);
    if (parsed.status !== undefined) data.status = parsed.status || null;
    if (parsed.prototypeDone !== undefined) data.prototypeDone = parsed.prototypeDone;
    if (parsed.prototypeNotes !== undefined) data.prototypeNotes = parsed.prototypeNotes || null;
    if (parsed.estimatedMinutesPerUnit !== undefined) data.estimatedMinutesPerUnit = parsed.estimatedMinutesPerUnit;
    if (parsed.notes !== undefined) data.notes = parsed.notes || null;
    await db.bookBuildCard.update({ where: { subsectionId }, data });
    const sub = await db.bookSubsection.findUnique({ where: { id: subsectionId } });
    const changedFields: string[] = [];
    if (data.quantityNeeded !== undefined && data.quantityNeeded !== before.quantityNeeded) changedFields.push("quantityNeeded");
    if (data.targetDate !== undefined) {
      const newT = data.targetDate instanceof Date ? data.targetDate.getTime() : null;
      const oldT = before.targetDate?.getTime() ?? null;
      if (newT !== oldT) changedFields.push("targetDate");
    }
    if (data.status !== undefined && data.status !== before.status) changedFields.push("status");
    if (data.prototypeDone !== undefined && data.prototypeDone !== before.prototypeDone) changedFields.push("prototypeDone");
    if (data.prototypeNotes !== undefined && data.prototypeNotes !== before.prototypeNotes) changedFields.push("prototypeNotes");
    if (data.estimatedMinutesPerUnit !== undefined && data.estimatedMinutesPerUnit !== before.estimatedMinutesPerUnit) changedFields.push("estimatedMinutesPerUnit");
    if (data.notes !== undefined && data.notes !== before.notes) changedFields.push("notes");
    await audit(user, {
      action: "build-update",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        title: sub?.title,
        status: data.status ?? before.status,
        quantityNeeded: data.quantityNeeded ?? before.quantityNeeded,
        targetDate: (data.targetDate instanceof Date ? data.targetDate.toISOString() : null) ?? before.targetDate?.toISOString() ?? null,
        changedFields,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save build card" };
  }
}

const materialSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.coerce.number().min(0).optional().nullable(),
  unit: z.string().max(40).optional().nullable(),
  supplier: z.string().max(120).optional().nullable(),
  costPence: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function createBuildMaterial(
  cardId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = materialSchema.parse({
      name: String(formData.get("name") ?? "").trim(),
      quantity: formData.get("quantity") || null,
      unit: formData.get("unit") || null,
      supplier: formData.get("supplier") || null,
      costPence: formData.get("costPence") || null,
      notes: formData.get("notes") || null,
    });
    const card = await db.bookBuildCard.findUnique({
      where: { id: cardId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Build card not found" };
    const last = await db.bookBuildMaterial.findFirst({
      where: { cardId },
      orderBy: { order: "desc" },
    });
    const created = await db.bookBuildMaterial.create({
      data: {
        cardId,
        name: parsed.name,
        quantity: parsed.quantity ?? null,
        unit: parsed.unit ?? null,
        supplier: parsed.supplier ?? null,
        costPence: parsed.costPence ?? null,
        notes: parsed.notes ?? null,
        order: (last?.order ?? -1) + 1,
      },
    });
    await audit(user, {
      action: "build-material-create",
      entity: "BookSubsection",
      entityId: card.subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        materialName: created.name,
        costPence: created.costPence,
      },
    });
    await revalidateBookSubsection(card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't add material" };
  }
}

export async function updateBuildMaterial(
  id: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const before = await db.bookBuildMaterial.findUnique({
      where: { id },
      include: { card: { include: { subsection: true } } },
    });
    if (!before) return { ok: false, error: "Material not found" };
    const parsed = materialSchema.partial().parse({
      name: formData.get("name") ?? undefined,
      quantity: formData.get("quantity") ?? undefined,
      unit: formData.get("unit") ?? undefined,
      supplier: formData.get("supplier") ?? undefined,
      costPence: formData.get("costPence") ?? undefined,
      notes: formData.get("notes") ?? undefined,
    });
    const data: Record<string, unknown> = {};
    if (parsed.name !== undefined) data.name = parsed.name;
    if (parsed.quantity !== undefined) data.quantity = parsed.quantity;
    if (parsed.unit !== undefined) data.unit = parsed.unit || null;
    if (parsed.supplier !== undefined) data.supplier = parsed.supplier || null;
    if (parsed.costPence !== undefined) data.costPence = parsed.costPence;
    if (parsed.notes !== undefined) data.notes = parsed.notes || null;
    await db.bookBuildMaterial.update({ where: { id }, data });
    const changedFields = Object.keys(data).filter((k) => {
      const newV = (data as Record<string, unknown>)[k];
      const oldV = (before as unknown as Record<string, unknown>)[k];
      return newV !== oldV;
    });
    await audit(user, {
      action: "build-material-update",
      entity: "BookSubsection",
      entityId: before.card.subsectionId,
      metadata: {
        cardTitle: before.card.subsection.title,
        materialName: parsed.name ?? before.name,
        changedFields,
      },
    });
    await revalidateBookSubsection(before.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save material" };
  }
}

export async function deleteBuildMaterial(id: string): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const before = await db.bookBuildMaterial.findUnique({
      where: { id },
      include: { card: { include: { subsection: true } } },
    });
    if (!before) return { ok: false, error: "Material not found" };
    await db.bookBuildMaterial.delete({ where: { id } });
    await audit(user, {
      action: "build-material-delete",
      entity: "BookSubsection",
      entityId: before.card.subsectionId,
      metadata: {
        cardTitle: before.card.subsection.title,
        materialName: before.name,
      },
    });
    await revalidateBookSubsection(before.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't delete material" };
  }
}

export async function toggleBuildMaterialFlag(
  id: string,
  flag: "ordered" | "arrived",
  value: boolean,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const before = await db.bookBuildMaterial.findUnique({
      where: { id },
      include: { card: { include: { subsection: true } } },
    });
    if (!before) return { ok: false, error: "Material not found" };
    await db.bookBuildMaterial.update({
      where: { id },
      data: flag === "ordered" ? { ordered: value } : { arrived: value },
    });
    await audit(user, {
      action: "build-material-flag",
      entity: "BookSubsection",
      entityId: before.card.subsectionId,
      metadata: {
        cardTitle: before.card.subsection.title,
        materialName: before.name,
        flag,
        value,
      },
    });
    await revalidateBookSubsection(before.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't toggle" };
  }
}

export async function reorderBuildMaterials(
  id: string,
  delta: number,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const item = await db.bookBuildMaterial.findUnique({
      where: { id },
      include: { card: { include: { subsection: true } } },
    });
    if (!item) return { ok: false, error: "Material not found" };
    const siblings = await db.bookBuildMaterial.findMany({
      where: { cardId: item.cardId },
      orderBy: { order: "asc" },
    });
    const idx = siblings.findIndex((s) => s.id === id);
    const targetIdx = idx + (delta < 0 ? -1 : 1);
    if (targetIdx < 0 || targetIdx >= siblings.length) return { ok: true };
    const swap = siblings[targetIdx]!;
    await db.$transaction([
      db.bookBuildMaterial.update({ where: { id: item.id }, data: { order: swap.order } }),
      db.bookBuildMaterial.update({ where: { id: swap.id }, data: { order: item.order } }),
    ]);
    await audit(user, {
      action: "build-material-reorder",
      entity: "BookSubsection",
      entityId: item.card.subsectionId,
      metadata: { cardTitle: item.card.subsection.title, materialName: item.name, delta },
    });
    await revalidateBookSubsection(item.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reorder" };
  }
}

const sessionSchema = z.object({
  date: z.string().min(1),
  minutes: z.coerce.number().int().min(0).max(60 * 24 * 30),
  unitsCompleted: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function createBuildSession(
  cardId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = sessionSchema.parse({
      date: String(formData.get("date") ?? ""),
      minutes: formData.get("minutes") ?? "0",
      unitsCompleted: formData.get("unitsCompleted") || null,
      notes: formData.get("notes") || null,
    });
    const card = await db.bookBuildCard.findUnique({
      where: { id: cardId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Build card not found" };
    const date = new Date(parsed.date);
    if (isNaN(date.getTime())) return { ok: false, error: "Invalid date" };
    const created = await db.bookBuildSession.create({
      data: {
        cardId,
        date,
        minutes: parsed.minutes,
        unitsCompleted: parsed.unitsCompleted ?? null,
        notes: parsed.notes ?? null,
        loggedById: user.id,
      },
    });
    await audit(user, {
      action: "build-session-create",
      entity: "BookSubsection",
      entityId: card.subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        minutes: created.minutes,
        unitsCompleted: created.unitsCompleted,
        sessionDate: created.date.toISOString(),
      },
    });
    await revalidateBookSubsection(card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't log session" };
  }
}

export async function updateBuildSession(
  id: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const before = await db.bookBuildSession.findUnique({
      where: { id },
      include: { card: { include: { subsection: true } } },
    });
    if (!before) return { ok: false, error: "Session not found" };
    const parsed = sessionSchema.partial().parse({
      date: formData.get("date") ?? undefined,
      minutes: formData.get("minutes") ?? undefined,
      unitsCompleted: formData.get("unitsCompleted") ?? undefined,
      notes: formData.get("notes") ?? undefined,
    });
    const data: Record<string, unknown> = {};
    if (parsed.date !== undefined) {
      const d = new Date(parsed.date);
      if (isNaN(d.getTime())) return { ok: false, error: "Invalid date" };
      data.date = d;
    }
    if (parsed.minutes !== undefined) data.minutes = parsed.minutes;
    if (parsed.unitsCompleted !== undefined) data.unitsCompleted = parsed.unitsCompleted;
    if (parsed.notes !== undefined) data.notes = parsed.notes || null;
    await db.bookBuildSession.update({ where: { id }, data });
    await audit(user, {
      action: "build-session-update",
      entity: "BookSubsection",
      entityId: before.card.subsectionId,
      metadata: {
        cardTitle: before.card.subsection.title,
        sessionId: id,
        changedFields: Object.keys(data),
      },
    });
    await revalidateBookSubsection(before.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't update session" };
  }
}

export async function deleteBuildSession(id: string): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const before = await db.bookBuildSession.findUnique({
      where: { id },
      include: { card: { include: { subsection: true } } },
    });
    if (!before) return { ok: false, error: "Session not found" };
    await db.bookBuildSession.delete({ where: { id } });
    await audit(user, {
      action: "build-session-delete",
      entity: "BookSubsection",
      entityId: before.card.subsectionId,
      metadata: {
        cardTitle: before.card.subsection.title,
        minutes: before.minutes,
        unitsCompleted: before.unitsCompleted,
        sessionDate: before.date.toISOString(),
      },
    });
    await revalidateBookSubsection(before.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't delete session" };
  }
}

// v1.31.0 / v1.31.1: one-click "Copy materials total to Budget". On
// first call, creates a BudgetLine in a "DIY production" category
// (find-or-create) and stores its id on BookBuildCard.budgetLineId. On
// subsequent calls, updates the existing line in place — no duplicates.
// No auto-sync; only fires when the user clicks the button.
export async function copyBuildMaterialsToBudget(
  cardId: string,
): Promise<BookActionResult & { budgetLineId?: string }> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookBuildCard.findUnique({
      where: { id: cardId },
      include: { subsection: true, materials: true },
    });
    if (!card) return { ok: false, error: "Build card not found" };
    const totalPence = card.materials.reduce(
      (sum, m) => sum + (m.costPence ?? 0),
      0,
    );
    const estimated = (totalPence / 100).toFixed(2);
    const notesLine = `from BUILD card · ${card.materials.length} material(s)`;

    // Inner helper hoisted — TS doesn't narrow closures over parameter
    // `card` after the early null-return, so the helper takes the
    // values it needs explicitly.
    async function createNewBudgetLine(
      description: string,
      estimatedDecimal: string,
      notes: string,
    ): Promise<string> {
      let category = await db.budgetCategory.findFirst({
        where: { name: "DIY production" },
      });
      if (!category) {
        const last = await db.budgetCategory.findFirst({ orderBy: { order: "desc" } });
        category = await db.budgetCategory.create({
          data: { name: "DIY production", order: (last?.order ?? -1) + 1 },
        });
      }
      const lastLine = await db.budgetLine.findFirst({
        where: { categoryId: category.id },
        orderBy: { order: "desc" },
      });
      const created = await db.budgetLine.create({
        data: {
          categoryId: category.id,
          description,
          estimated: estimatedDecimal,
          notes,
          order: (lastLine?.order ?? -1) + 1,
        },
      });
      return created.id;
    }

    let budgetLineId: string;
    let isUpdate = false;
    if (card.budgetLineId) {
      // Existing link — update the line in place.
      const existing = await db.budgetLine.findUnique({
        where: { id: card.budgetLineId },
      });
      if (existing) {
        await db.budgetLine.update({
          where: { id: card.budgetLineId },
          data: {
            description: card.subsection.title,
            estimated,
            notes: notesLine,
          },
        });
        budgetLineId = existing.id;
        isUpdate = true;
      } else {
        // Link points at a deleted line; fall through to create a new one.
        budgetLineId = await createNewBudgetLine(card.subsection.title, estimated, notesLine);
      }
    } else {
      budgetLineId = await createNewBudgetLine(card.subsection.title, estimated, notesLine);
    }
    if (!isUpdate) {
      await db.bookBuildCard.update({
        where: { id: cardId },
        data: { budgetLineId },
      });
    }
    await audit(user, {
      action: isUpdate ? "build-update-budget-line" : "build-copy-to-budget",
      entity: "BookSubsection",
      entityId: card.subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        materialCount: card.materials.length,
        totalPence,
        budgetLineId,
      },
    });
    revalidatePath("/budget");
    revalidatePath("/diy");
    await revalidateBookSubsection(card.subsectionId);
    return { ok: true, budgetLineId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't copy to budget" };
  }
}

// v1.31.1: clear the BudgetLine link on a BUILD card. Doesn't touch
// the BudgetLine itself — the line stays on /budget, just isn't
// auto-synced from this card any more. Couple/admin can delete the
// orphan line via /budget if they want.
export async function unlinkBuildBudgetLine(
  cardId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookBuildCard.findUnique({
      where: { id: cardId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Build card not found" };
    if (!card.budgetLineId) return { ok: true };
    const previousLineId = card.budgetLineId;
    await db.bookBuildCard.update({
      where: { id: cardId },
      data: { budgetLineId: null },
    });
    await audit(user, {
      action: "build-unlink-budget",
      entity: "BookSubsection",
      entityId: card.subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        previousBudgetLineId: previousLineId,
      },
    });
    await revalidateBookSubsection(card.subsectionId);
    revalidatePath("/diy");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't unlink" };
  }
}

// v1.31.1: single bulk save for the BUILD card editor. Replaces the
// per-row create/update/delete actions with one round-trip on Save —
// the editor builds a payload of the entire card state (header +
// materials), the server reconciles in a transaction:
//   - Header fields applied directly.
//   - Materials: rows whose id starts "new-" → create; existing ids
//     → update; existing rows whose id is NOT in the payload → delete.
// Sessions stay on the per-row actions (they're append-only quick log
// affordances, not part of the bulk edit form).

const buildMaterialPayloadSchema = z.object({
  // "new-XXX" or a real cuid; server uses the prefix to discriminate.
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(120),
  quantity: z.number().min(0).nullable(),
  unit: z.string().max(40).nullable(),
  supplier: z.string().max(120).nullable(),
  costPence: z.number().int().min(0).nullable(),
  ordered: z.boolean(),
  arrived: z.boolean(),
  notes: z.string().max(2000).nullable(),
});

const buildSavePayloadSchema = z.object({
  quantityNeeded: z.number().int().min(0).nullable(),
  targetDate: z.string().nullable(), // ISO yyyy-mm-dd or empty
  status: z.string().max(40).nullable(),
  prototypeDone: z.boolean(),
  prototypeNotes: z.string().max(2000).nullable(),
  estimatedMinutesPerUnit: z.number().int().min(0).nullable(),
  notes: z.string().max(4000).nullable(),
  materials: z.array(buildMaterialPayloadSchema),
});

export type BuildSavePayload = z.infer<typeof buildSavePayloadSchema>;

export async function saveBuildCard(
  subsectionId: string,
  payload: BuildSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = buildSavePayloadSchema.parse(payload);
    const before = await db.bookBuildCard.findUnique({
      where: { subsectionId },
      include: { subsection: true, materials: true },
    });
    if (!before) return { ok: false, error: "Build card not found" };

    // Build header data + diff.
    const targetDate = parsed.targetDate ? new Date(parsed.targetDate) : null;
    if (parsed.targetDate && targetDate && isNaN(targetDate.getTime())) {
      return { ok: false, error: "Invalid target date" };
    }
    const headerChanged: string[] = [];
    if (parsed.quantityNeeded !== before.quantityNeeded) headerChanged.push("quantityNeeded");
    if ((targetDate?.getTime() ?? null) !== (before.targetDate?.getTime() ?? null)) headerChanged.push("targetDate");
    if (parsed.status !== before.status) headerChanged.push("status");
    if (parsed.prototypeDone !== before.prototypeDone) headerChanged.push("prototypeDone");
    if (parsed.prototypeNotes !== before.prototypeNotes) headerChanged.push("prototypeNotes");
    if (parsed.estimatedMinutesPerUnit !== before.estimatedMinutesPerUnit) headerChanged.push("estimatedMinutesPerUnit");
    if (parsed.notes !== before.notes) headerChanged.push("notes");

    // Reconcile materials.
    const beforeIds = new Set(before.materials.map((m) => m.id));
    const incomingIds = new Set(parsed.materials.map((m) => m.id).filter((id) => !id.startsWith("new-")));
    const toDelete = [...beforeIds].filter((id) => !incomingIds.has(id));
    const toCreate = parsed.materials.filter((m) => m.id.startsWith("new-"));
    const toUpdate = parsed.materials.filter((m) => !m.id.startsWith("new-"));

    await db.$transaction(async (tx) => {
      // Header
      await tx.bookBuildCard.update({
        where: { subsectionId },
        data: {
          quantityNeeded: parsed.quantityNeeded,
          targetDate,
          status: parsed.status || null,
          prototypeDone: parsed.prototypeDone,
          prototypeNotes: parsed.prototypeNotes || null,
          estimatedMinutesPerUnit: parsed.estimatedMinutesPerUnit,
          notes: parsed.notes || null,
        },
      });
      // Deletes
      if (toDelete.length > 0) {
        await tx.bookBuildMaterial.deleteMany({
          where: { id: { in: toDelete } },
        });
      }
      // Updates
      for (const m of toUpdate) {
        await tx.bookBuildMaterial.update({
          where: { id: m.id },
          data: {
            name: m.name,
            quantity: m.quantity,
            unit: m.unit || null,
            supplier: m.supplier || null,
            costPence: m.costPence,
            ordered: m.ordered,
            arrived: m.arrived,
            notes: m.notes || null,
          },
        });
      }
      // Creates — preserve incoming order from the payload by tracking
      // the next order sequentially after the highest existing.
      let orderCounter = before.materials.reduce((max, m) => Math.max(max, m.order), -1);
      for (const m of toCreate) {
        orderCounter += 1;
        await tx.bookBuildMaterial.create({
          data: {
            cardId: before.id,
            name: m.name,
            quantity: m.quantity,
            unit: m.unit || null,
            supplier: m.supplier || null,
            costPence: m.costPence,
            ordered: m.ordered,
            arrived: m.arrived,
            notes: m.notes || null,
            order: orderCounter,
          },
        });
      }
      // Reorder updates: rewrite the order field for everything in the
      // payload to match the position in the array. This handles the
      // user dragging materials around in the editor.
      for (let i = 0; i < parsed.materials.length; i++) {
        const m = parsed.materials[i]!;
        if (!m.id.startsWith("new-")) {
          await tx.bookBuildMaterial.update({
            where: { id: m.id },
            data: { order: i },
          });
        }
      }
    });

    await audit(user, {
      action: "build-save",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: before.subsection.title,
        status: parsed.status,
        materialsAdded: toCreate.length,
        materialsRemoved: toDelete.length,
        materialsUpdated: toUpdate.length,
        materialsTotal: parsed.materials.length,
        headerChanged,
      },
    });
    await revalidateBookSubsection(subsectionId);
    revalidatePath("/diy");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save build card" };
  }
}
