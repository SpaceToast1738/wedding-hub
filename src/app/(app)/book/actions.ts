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
