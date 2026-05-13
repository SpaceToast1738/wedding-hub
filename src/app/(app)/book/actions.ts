"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BookSubsectionKind, BookSubsectionVisibility, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
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
import { sanitizeBookHtml } from "@/lib/sanitize-book-html";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { FileVisibility } from "@prisma/client";
import {
  UPLOADS_DIR,
  ensureUploadsDir,
  generateStoredName,
  validateUpload,
} from "@/lib/uploads";

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
  await audit(user, {
    action: "create",
    entity: "BookSection",
    entityId: created.id,
    metadata: { slug: created.slug, title: created.title, order: created.order },
  });
  revalidatePath("/book");
}

export async function deleteBookSection(id: string) {
  const user = await requireEdit("book");
  // v1.54.0 (B3): snapshot the row before deletion so the audit log
  // reads useful instead of just an opaque cuid. Pre-fix the audit
  // row gave nothing the couple could recognise after the row was
  // gone — useful for "wait, who deleted Food & Drink?" forensics.
  const before = await db.bookSection.findUnique({
    where: { id },
    include: { _count: { select: { subsections: true } } },
  });
  await db.bookSection.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "BookSection",
    entityId: id,
    metadata: {
      slug: before?.slug ?? null,
      title: before?.title ?? null,
      subsectionCount: before?._count.subsections ?? 0,
    },
  });
  revalidatePath("/book");
}

// v1.26.0: kind-aware. Every new card seeds the per-kind structured
// data so the renderer never has to handle a missing relation.
export async function createBookSubsection(formData: FormData) {
  const user = await requireEdit("book");
  // v1.60.0 (P7): drop the bogus `as BookSubsectionKind | null` cast —
  // the schema's `z.nativeEnum(BookSubsectionKind).default(TEXT)` does
  // both the validation and the default. Pre-fix the cast was a TS
  // lie (not a runtime hole; Zod still caught bad values), but the
  // shape it implied was wrong.
  const parsed = subsectionSchema.parse({
    sectionId: formData.get("sectionId"),
    slug: formData.get("slug"),
    title: formData.get("title"),
    body: formData.get("body") || null,
    kind: formData.get("kind") ?? undefined,
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
  } else if (parsed.kind === BookSubsectionKind.MENU) {
    // v1.32.0: MENU card seeds with three placeholder courses
    // (Starter / Main / Dessert) so the editor renders something
    // actionable on first open. Courses are reorderable + deletable
    // via the editor; opinionated defaults aren't a lock-in.
    const menu = await db.bookMenuCard.create({ data: { subsectionId: created.id } });
    await db.bookMenuCourse.createMany({
      data: [
        { cardId: menu.id, courseLabel: "Starter", order: 0 },
        { cardId: menu.id, courseLabel: "Main", order: 1 },
        { cardId: menu.id, courseLabel: "Dessert", order: 2 },
      ],
    });
  } else if (parsed.kind === BookSubsectionKind.BAR) {
    // v1.32.0: BAR card child seeds with all-null fields. Empty
    // items list. Categories are free-text on each item, so we
    // don't pre-seed any.
    await db.bookBarCard.create({ data: { subsectionId: created.id } });
  } else if (parsed.kind === BookSubsectionKind.SETUP) {
    // v1.33.0: SETUP card child seeds with all-null fields. Empty
    // items list. Couple fills in space + setup time + items via
    // the editor.
    await db.bookSetupCard.create({ data: { subsectionId: created.id } });
  } else if (parsed.kind === BookSubsectionKind.LEGAL) {
    // v1.34.0: LEGAL card child seeds with all-null fields. Empty
    // items list. Couple sets regulator + due date + items in the
    // editor.
    await db.bookLegalCard.create({ data: { subsectionId: created.id } });
  } else if (parsed.kind === BookSubsectionKind.STAY) {
    // v1.36.0: STAY card child seeds with all-null fields. Couple
    // fills property + dates + cost + occupants via the editor.
    await db.bookStayCard.create({ data: { subsectionId: created.id } });
  } else if (parsed.kind === BookSubsectionKind.LODGING_GUIDE) {
    // v1.36.0: LODGING_GUIDE card seeds empty. Items added via the
    // editor's bulk-save flow.
    await db.bookLodgingCard.create({ data: { subsectionId: created.id } });
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
  // v1.37.0: TEXT cards now author HTML via Tiptap. The form posts
  // `bodyHtml` (sanitised on its way in here); the legacy `body`
  // textarea is gone. Non-TEXT kinds don't post body at all — they
  // store their content in per-kind tables. We accept either field
  // for back-compat with any callers that still post `body` (none
  // in tree, but keeps the surface non-breaking for one release).
  const rawBodyHtml = formData.get("bodyHtml");
  const rawBody = formData.get("body");
  if (!title) throw new Error("Title is required");
  const data: { title: string; bodyHtml?: string | null; body?: string | null } = { title };
  if (rawBodyHtml !== null) {
    const cleaned = sanitizeBookHtml(String(rawBodyHtml));
    data.bodyHtml = cleaned || null;
  } else if (rawBody !== null) {
    // Legacy callers posting `body` get their content escaped + wrapped
    // through legacyBodyToHtml. The plain body column also gets
    // updated so old read paths keep working through the buffer
    // release.
    const { legacyBodyToHtml } = await import("@/lib/sanitize-book-html");
    const text = String(rawBody);
    data.body = text || null;
    data.bodyHtml = text ? legacyBodyToHtml(text) : null;
  }
  // v1.54.0 (B3): snapshot before update so changedFields can diff
  // the title (and body shape on TEXT cards) for a useful audit row.
  const before = await db.bookSubsection.findUnique({
    where: { id },
    select: { title: true, bodyHtml: true, body: true },
  });
  const updated = await db.bookSubsection.update({
    where: { id },
    data,
    include: { section: true },
  });
  const changedFields: string[] = [];
  if (before) {
    if (before.title !== updated.title) changedFields.push("title");
    if (data.bodyHtml !== undefined && before.bodyHtml !== data.bodyHtml) changedFields.push("bodyHtml");
    if (data.body !== undefined && before.body !== data.body) changedFields.push("body");
  }
  await audit(user, {
    action: "update",
    entity: "BookSubsection",
    entityId: id,
    metadata: {
      title: updated.title,
      kind: updated.kind,
      sectionSlug: updated.section.slug,
      changedFields,
    },
  });
  revalidatePath("/book");
  revalidatePath(`/book/${updated.section.slug}`);
}

export async function deleteBookSubsection(id: string) {
  const user = await requireEdit("book");
  // v1.54.0 (B3): snapshot title + kind + section slug before delete
  // so the audit log reads "Deleted MENU card 'Wedding breakfast' on
  // food-drink" rather than an opaque cuid.
  const sub = await db.bookSubsection.findUnique({ where: { id }, include: { section: true } });
  await db.bookSubsection.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "BookSubsection",
    entityId: id,
    metadata: {
      title: sub?.title ?? null,
      kind: sub?.kind ?? null,
      sectionSlug: sub?.section.slug ?? null,
    },
  });
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
  // v1.54.0 (A9): require EDIT on the book section before checking
  // couple-tier. Pre-fix a couple-tier user with `book` set to NONE
  // could still flip visibility — couple-tier shouldn't bypass per-
  // section gates. Use requireEdit first; the isCouple check below
  // is then strictly an additional restriction (visibility is
  // couple-only on top of the book-edit gate).
  const user = await requireEdit("book");
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
  // v1.54.0 (A9): same gate-tightening as setBookSubsectionVisibility.
  const user = await requireEdit("book");
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

// v1.38.0 (P7b/B): optional richer metadata — group label, helpText,
// required flag, number / date range bounds. All passed in the same
// call as label/type/options. Old callers omitting the extras still
// work (everything defaults to null/false).
export type BookFieldDefMeta = {
  group?: string | null;
  helpText?: string | null;
  required?: boolean;
  min?: number | null;
  max?: number | null;
  dateMin?: string | null;  // yyyy-mm-dd or ISO
  dateMax?: string | null;
};

export async function addBookFieldDef(
  subsectionId: string,
  label: string,
  type: string,
  options: string[],
  meta?: BookFieldDefMeta,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = fieldDefSchema.parse({ label, type, options });
    const last = await db.bookFieldDef.findFirst({
      where: { subsectionId },
      orderBy: { order: "desc" },
    });
    const dateMin = meta?.dateMin ? new Date(meta.dateMin) : null;
    const dateMax = meta?.dateMax ? new Date(meta.dateMax) : null;
    await db.bookFieldDef.create({
      data: {
        subsectionId,
        label: parsed.label,
        type: parsed.type,
        options: parsed.type === "select" ? parsed.options : [],
        order: (last?.order ?? -1) + 1,
        group: meta?.group?.trim() || null,
        helpText: meta?.helpText?.trim() || null,
        required: meta?.required ?? false,
        min: meta?.min ?? null,
        max: meta?.max ?? null,
        dateMin: dateMin && !Number.isNaN(dateMin.getTime()) ? dateMin : null,
        dateMax: dateMax && !Number.isNaN(dateMax.getTime()) ? dateMax : null,
      },
    });
    await audit(user, {
      action: "field-add",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        label: parsed.label,
        type: parsed.type,
        group: meta?.group ?? null,
        required: meta?.required ?? false,
      },
    });
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
    await audit(user, {
      action: "field-delete",
      entity: "BookSubsection",
      entityId: def.subsectionId,
      metadata: { fieldId: def.id, fieldLabel: def.label, fieldType: def.type },
    });
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
      // v1.38.0: thread richer metadata into the parser so required /
      // min / max / dateMin / dateMax all enforce on save.
      group: def.group,
      helpText: def.helpText,
      required: def.required,
      min: def.min,
      max: def.max,
      dateMin: def.dateMin ? def.dateMin.toISOString().slice(0, 10) : null,
      dateMax: def.dateMax ? def.dateMax.toISOString().slice(0, 10) : null,
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
    await audit(user, {
      action: "field-set",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        fieldId: defId,
        fieldLabel: def.label,
        fieldType: def.type,
        cleared: value === null,
      },
    });
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
    await audit(user, {
      action: "recipe-update",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        ingredientCount: validated.ingredients.length,
        stepCount: validated.steps.length,
        hasNotes: validated.notes !== null && validated.notes !== "",
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save recipe" };
  }
}

// ─── v1.38.0 — RECIPE card single-bulk-save ───────────────────────
//
// Structured-steps payload. Replaces the legacy `updateBookRecipe`
// for new callers. The legacy call path stays in place for one
// release as a back-compat buffer; this action takes precedence
// when the editor saves.

const recipeStepPayloadSchema = z.object({
  id: z.string().min(1).max(50),
  instruction: z.string().min(1).max(2000),
  durationMinutes: z.number().int().min(0).max(2880).nullable(),
  dayBefore: z.boolean(),
});

const recipeSavePayloadSchema = z.object({
  ingredients: z.array(z.string().min(1).max(500)).max(80),
  notes: z.string().max(4000).nullable(),
  servingsBase: z.number().int().min(1).max(1000).nullable(),
  steps: z.array(recipeStepPayloadSchema).max(80),
});

export type RecipeSavePayload = z.infer<typeof recipeSavePayloadSchema>;

export async function saveRecipeCard(
  subsectionId: string,
  payload: RecipeSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = recipeSavePayloadSchema.parse(payload);
    const before = await db.bookRecipe.findUnique({
      where: { subsectionId },
      include: { subsection: true, recipeSteps: true },
    });
    if (!before) return { ok: false, error: "Recipe card not found" };

    const headerChanged: string[] = [];
    if (JSON.stringify(parsed.ingredients) !== JSON.stringify(before.ingredients)) {
      headerChanged.push("ingredients");
    }
    if (parsed.notes !== before.notes) headerChanged.push("notes");
    if (parsed.servingsBase !== before.servingsBase) headerChanged.push("servingsBase");

    const beforeIds = new Set(before.recipeSteps.map((s) => s.id));
    const incomingIds = new Set(
      parsed.steps.map((s) => s.id).filter((id) => !id.startsWith("new-")),
    );
    const toDelete = [...beforeIds].filter((id) => !incomingIds.has(id));
    const toCreate = parsed.steps.filter((s) => s.id.startsWith("new-"));
    const toUpdate = parsed.steps.filter((s) => !s.id.startsWith("new-"));

    await db.$transaction(async (tx) => {
      await tx.bookRecipe.update({
        where: { subsectionId },
        data: {
          ingredients: parsed.ingredients as Prisma.InputJsonValue,
          notes: parsed.notes,
          servingsBase: parsed.servingsBase,
          // Mirror structured steps back into the legacy `steps` Json
          // column so the recoverability buffer stays current. Stop
          // writing it after v1.38 → v1.39.
          steps: parsed.steps.map((s) => s.instruction) as Prisma.InputJsonValue,
        },
      });
      if (toDelete.length > 0) {
        await tx.bookRecipeStep.deleteMany({ where: { id: { in: toDelete } } });
      }
      for (const s of toUpdate) {
        await tx.bookRecipeStep.update({
          where: { id: s.id },
          data: {
            instruction: s.instruction,
            durationMinutes: s.durationMinutes,
            dayBefore: s.dayBefore,
          },
        });
      }
      let orderCounter = before.recipeSteps.reduce((max, s) => Math.max(max, s.order), -1);
      for (const s of toCreate) {
        orderCounter += 1;
        await tx.bookRecipeStep.create({
          data: {
            recipeId: before.id,
            instruction: s.instruction,
            durationMinutes: s.durationMinutes,
            dayBefore: s.dayBefore,
            order: orderCounter,
          },
        });
      }
      for (let idx = 0; idx < parsed.steps.length; idx++) {
        const s = parsed.steps[idx]!;
        if (!s.id.startsWith("new-")) {
          await tx.bookRecipeStep.update({ where: { id: s.id }, data: { order: idx } });
        }
      }
    });

    await audit(user, {
      action: "recipe-save",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: before.subsection.title,
        servingsBase: parsed.servingsBase,
        stepsAdded: toCreate.length,
        stepsUpdated: toUpdate.length,
        stepsRemoved: toDelete.length,
        stepsTotal: parsed.steps.length,
        ingredientCount: parsed.ingredients.length,
        headerChanged,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save recipe card" };
  }
}

// ─── v1.26.0 — SHOT_LIST card actions ─────────────────────────────

// v1.38.0 (P7b/B): shared parser for the shot form. Reads category /
// estimatedMinutes / guestIds[] alongside the legacy fields and
// hands the result to validateShot.
function parseShotFormData(fd: FormData): BookShotShape {
  const estRaw = String(fd.get("estimatedMinutes") ?? "").trim();
  const estimatedMinutes = estRaw === "" ? null : Number(estRaw);
  const guestIds = fd.getAll("guestIds").map((v) => String(v));
  return {
    title: String(fd.get("title") ?? ""),
    category: (fd.get("category") as string | null) || null,
    estimatedMinutes,
    guestIds,
    withWhom: String(fd.get("withWhom") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    location: (fd.get("location") as string | null) || null,
    notes: (fd.get("notes") as string | null) || null,
  };
}

export async function addBookShot(
  shotListId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const validated = validateShot(parseShotFormData(formData));
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
        category: validated.category ?? null,
        estimatedMinutes: validated.estimatedMinutes ?? null,
        withWhom: validated.withWhom,
        guestIds: validated.guestIds ?? [],
        location: validated.location,
        notes: validated.notes,
        order: (last?.order ?? -1) + 1,
      },
    });
    await audit(user, {
      action: "shot-add",
      entity: "BookSubsection",
      entityId: list.subsectionId,
      metadata: {
        cardTitle: list.subsection.title,
        shotTitle: validated.title,
        category: validated.category ?? null,
        estimatedMinutes: validated.estimatedMinutes ?? null,
        guestCount: (validated.guestIds ?? []).length,
      },
    });
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
    const validated = validateShot(parseShotFormData(formData));
    const updated = await db.bookShot.update({
      where: { id },
      data: {
        title: validated.title,
        category: validated.category ?? null,
        estimatedMinutes: validated.estimatedMinutes ?? null,
        withWhom: validated.withWhom,
        guestIds: validated.guestIds ?? [],
        location: validated.location,
        notes: validated.notes,
      },
      include: { shotList: { include: { subsection: true } } },
    });
    await audit(user, {
      action: "shot-update",
      entity: "BookSubsection",
      entityId: updated.shotList.subsectionId,
      metadata: {
        cardTitle: updated.shotList.subsection.title,
        shotTitle: validated.title,
        category: validated.category ?? null,
        estimatedMinutes: validated.estimatedMinutes ?? null,
        guestCount: (validated.guestIds ?? []).length,
      },
    });
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
    await audit(user, {
      action: "shot-toggle",
      entity: "BookSubsection",
      entityId: updated.shotList.subsectionId,
      metadata: { shotId: updated.id, shotTitle: updated.title, captured },
    });
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
    await audit(user, {
      action: "shot-delete",
      entity: "BookSubsection",
      entityId: shot.shotList.subsectionId,
      metadata: { shotId: shot.id, shotTitle: shot.title, captured: shot.captured },
    });
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
    await audit(user, {
      action: "outfit-add",
      entity: "BookSubsection",
      entityId: card.subsectionId,
      metadata: {
        personName: validated.personName,
        role: validated.role,
        itemCount: validated.items.length,
        supplier: validated.supplier,
        status: validated.status,
      },
    });
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
    await audit(user, {
      action: "outfit-update",
      entity: "BookSubsection",
      entityId: updated.card.subsectionId,
      metadata: {
        outfitId: updated.id,
        personName: updated.personName,
        role: updated.role,
        itemCount: updated.items.length,
        supplier: updated.supplier,
        status: updated.status,
      },
    });
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
    await audit(user, {
      action: "outfit-delete",
      entity: "BookSubsection",
      entityId: outfit.card.subsectionId,
      metadata: {
        outfitId: outfit.id,
        personName: outfit.personName,
        role: outfit.role,
        itemCount: outfit.items.length,
      },
    });
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

// v1.87.0: reorder a BookSection (top-level /book card). Same swap
// shape as reorderBuildMaterials — find the neighbour at idx ± 1 and
// swap their `order` columns in a transaction. Couple-only via
// requireEdit("book"); audit-logged with the prior + new index.
export async function reorderBookSection(
  id: string,
  delta: number,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const item = await db.bookSection.findUnique({ where: { id } });
    if (!item) return { ok: false, error: "Section not found" };
    const siblings = await db.bookSection.findMany({
      orderBy: [{ order: "asc" }, { title: "asc" }],
    });
    const idx = siblings.findIndex((s) => s.id === id);
    const targetIdx = idx + (delta < 0 ? -1 : 1);
    if (targetIdx < 0 || targetIdx >= siblings.length) return { ok: true };
    const swap = siblings[targetIdx]!;
    await db.$transaction([
      db.bookSection.update({ where: { id: item.id }, data: { order: swap.order } }),
      db.bookSection.update({ where: { id: swap.id }, data: { order: item.order } }),
    ]);
    await audit(user, {
      action: "book-section-reorder",
      entity: "BookSection",
      entityId: id,
      metadata: {
        title: item.title,
        delta: delta < 0 ? -1 : 1,
        swappedWith: swap.title,
      },
    });
    revalidatePath("/book");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reorder" };
  }
}

// v1.87.0: reorder a BookSubsection (card within a section's page).
// Same swap shape; scopes the sibling lookup to the same sectionId so
// reorder is local to the current section. Title fallback in the
// orderBy mirrors the page query.
export async function reorderBookSubsection(
  id: string,
  delta: number,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const item = await db.bookSubsection.findUnique({
      where: { id },
      include: { section: { select: { id: true, slug: true } } },
    });
    if (!item) return { ok: false, error: "Page not found" };
    const siblings = await db.bookSubsection.findMany({
      where: { sectionId: item.sectionId },
      orderBy: [{ order: "asc" }, { title: "asc" }],
    });
    const idx = siblings.findIndex((s) => s.id === id);
    const targetIdx = idx + (delta < 0 ? -1 : 1);
    if (targetIdx < 0 || targetIdx >= siblings.length) return { ok: true };
    const swap = siblings[targetIdx]!;
    await db.$transaction([
      db.bookSubsection.update({ where: { id: item.id }, data: { order: swap.order } }),
      db.bookSubsection.update({ where: { id: swap.id }, data: { order: item.order } }),
    ]);
    await audit(user, {
      action: "book-subsection-reorder",
      entity: "BookSubsection",
      entityId: id,
      metadata: {
        title: item.title,
        sectionSlug: item.section.slug,
        delta: delta < 0 ? -1 : 1,
        swappedWith: swap.title,
      },
    });
    revalidatePath("/book");
    revalidatePath(`/book/${item.section.slug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reorder" };
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

// v1.78.0: shared helper to update a BudgetLine in-place from a card
// save. Mirrors the v1.31.1 BUILD pattern but in helper form so the
// MENU/BAR/OUTFIT/STAY save actions can call it on every save without
// duplicating the upsert logic.
//
// `perHeadConfig`: when present, the BudgetLine adopts per-head
// pricing (perHeadPence + headcountSource + manualHeadcount). When
// null, the line clears those fields and uses a flat `estimated`.
async function syncBudgetLine(
  budgetLineId: string,
  args: {
    description: string;
    flatEstimatedPounds: number | null;
    perHead: {
      perHeadPence: number;
      headcountSource: import("@prisma/client").PerHeadSource;
      manualHeadcount: number | null;
    } | null;
  },
): Promise<void> {
  const data: import("@prisma/client").Prisma.BudgetLineUpdateInput = {
    description: args.description,
  };
  if (args.perHead) {
    // Per-head mode: clear the manual `estimated` (the budget UI
    // computes the effective total live), set the per-head fields.
    data.estimated = null;
    data.perHeadPence = args.perHead.perHeadPence;
    data.headcountSource = args.perHead.headcountSource;
    data.manualHeadcount = args.perHead.manualHeadcount;
  } else {
    // Flat mode: clear per-head fields, set a manual estimated.
    data.estimated = args.flatEstimatedPounds == null ? null : args.flatEstimatedPounds.toFixed(2);
    data.perHeadPence = null;
    data.headcountSource = null;
    data.manualHeadcount = null;
  }
  await db.budgetLine.update({ where: { id: budgetLineId }, data });
}

// v1.78.0: card-budget link factory. Each card kind (MENU/BAR/OUTFIT/
// STAY) gets a `link<X>CardToBudget` and `unlink<X>CardFromBudget`
// pair below. This shared helper does the find-or-create-line +
// set-FK + audit-log dance so the four pairs stay consistent.
//
// Differences from v1.31.1's BUILD pattern: link is the user-driven
// step (pick a category once); after linking, *every save* re-syncs
// via `syncBudgetLine` (no manual button needed).

// ── MENU card ↔ BudgetLine ─────────────────────────────────────────
export async function linkMenuCardToBudget(args: {
  subsectionId: string;
  categoryId: string;
  description?: string;
}): Promise<BookActionResult & { budgetLineId?: string }> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookMenuCard.findUnique({
      where: { subsectionId: args.subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Menu card not found" };
    const description = args.description?.trim() || card.subsection.title;
    const last = await db.budgetLine.findFirst({
      where: { categoryId: args.categoryId },
      orderBy: { order: "desc" },
    });
    // Compute initial line state from the card's current per-head
    // config. headcountSource defaults to ALL_CONFIRMED if the card
    // has a price but no source yet (legacy data).
    const source =
      card.headcountSource ??
      (card.pricePerHeadPence != null ? ("ALL_CONFIRMED" as const) : null);
    const created = await db.budgetLine.create({
      data: {
        categoryId: args.categoryId,
        description,
        estimated: null,
        order: (last?.order ?? -1) + 1,
        notes: `Synced from MENU card · ${card.subsection.title}`,
        ...(card.pricePerHeadPence != null && source
          ? {
              perHeadPence: card.pricePerHeadPence,
              headcountSource: source,
              manualHeadcount: card.manualHeadcount ?? card.confirmedHeadcount ?? null,
            }
          : {}),
      },
    });
    await db.bookMenuCard.update({
      where: { subsectionId: args.subsectionId },
      data: { budgetLineId: created.id },
    });
    await audit(user, {
      action: "menu-budget-link",
      entity: "BookSubsection",
      entityId: args.subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        categoryId: args.categoryId,
        budgetLineId: created.id,
        pricePerHeadPence: card.pricePerHeadPence,
        headcountSource: source,
      },
    });
    revalidatePath("/budget");
    await revalidateBookSubsection(args.subsectionId);
    return { ok: true, budgetLineId: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't link" };
  }
}

export async function unlinkMenuCardFromBudget(
  subsectionId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookMenuCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Menu card not found" };
    if (!card.budgetLineId) return { ok: true };
    const previousLineId = card.budgetLineId;
    await db.bookMenuCard.update({
      where: { subsectionId },
      data: { budgetLineId: null },
    });
    await audit(user, {
      action: "menu-budget-unlink",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: { cardTitle: card.subsection.title, previousBudgetLineId: previousLineId },
    });
    revalidatePath("/budget");
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't unlink" };
  }
}

// ── BAR card ↔ BudgetLine ─────────────────────────────────────────
// BAR is multi-item with mixed pricing modes (fixed + per-head). The
// linked BudgetLine carries a flat rolled-up `estimated` since
// multiple per-head items at different rates can't squash into a
// single perHeadPence. The BAR card stays the source of truth for
// the per-item breakdown; budget shows the rolled total.
export async function linkBarCardToBudget(args: {
  subsectionId: string;
  categoryId: string;
  description?: string;
}): Promise<BookActionResult & { budgetLineId?: string }> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookBarCard.findUnique({
      where: { subsectionId: args.subsectionId },
      include: { subsection: true, items: true },
    });
    if (!card) return { ok: false, error: "Bar card not found" };
    // Compute initial estimated from the items list. We can't pull
    // confirmedAdults here without a Guest query; defer the
    // per-head-driven part to the next saveBarCard tick. For the
    // initial line, sum the flat costPence values only.
    const flatTotalPence = card.items.reduce(
      (sum, i) => sum + (i.pricePerHeadPence == null ? (i.costPence ?? 0) : 0),
      0,
    );
    const description = args.description?.trim() || card.subsection.title;
    const last = await db.budgetLine.findFirst({
      where: { categoryId: args.categoryId },
      orderBy: { order: "desc" },
    });
    const created = await db.budgetLine.create({
      data: {
        categoryId: args.categoryId,
        description,
        estimated: (flatTotalPence / 100).toFixed(2),
        order: (last?.order ?? -1) + 1,
        notes: `Synced from BAR card · ${card.subsection.title}`,
      },
    });
    await db.bookBarCard.update({
      where: { subsectionId: args.subsectionId },
      data: { budgetLineId: created.id },
    });
    await audit(user, {
      action: "bar-budget-link",
      entity: "BookSubsection",
      entityId: args.subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        categoryId: args.categoryId,
        budgetLineId: created.id,
        itemCount: card.items.length,
      },
    });
    revalidatePath("/budget");
    await revalidateBookSubsection(args.subsectionId);
    return { ok: true, budgetLineId: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't link" };
  }
}

export async function unlinkBarCardFromBudget(
  subsectionId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookBarCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Bar card not found" };
    if (!card.budgetLineId) return { ok: true };
    const previousLineId = card.budgetLineId;
    await db.bookBarCard.update({
      where: { subsectionId },
      data: { budgetLineId: null },
    });
    await audit(user, {
      action: "bar-budget-unlink",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: { cardTitle: card.subsection.title, previousBudgetLineId: previousLineId },
    });
    revalidatePath("/budget");
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't unlink" };
  }
}

// ── OUTFIT card ↔ BudgetLine ─────────────────────────────────────
// Flat-cost. Linked line gets `estimated = costPence/100`, no
// per-head config.
export async function linkOutfitCardToBudget(args: {
  subsectionId: string;
  categoryId: string;
  description?: string;
}): Promise<BookActionResult & { budgetLineId?: string }> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookOutfitCard.findUnique({
      where: { subsectionId: args.subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Outfit card not found" };
    const description = args.description?.trim() || card.subsection.title;
    const last = await db.budgetLine.findFirst({
      where: { categoryId: args.categoryId },
      orderBy: { order: "desc" },
    });
    const created = await db.budgetLine.create({
      data: {
        categoryId: args.categoryId,
        description,
        estimated: card.costPence == null ? null : (card.costPence / 100).toFixed(2),
        order: (last?.order ?? -1) + 1,
        notes: `Synced from OUTFIT card · ${card.subsection.title}`,
      },
    });
    await db.bookOutfitCard.update({
      where: { subsectionId: args.subsectionId },
      data: { budgetLineId: created.id },
    });
    await audit(user, {
      action: "outfit-budget-link",
      entity: "BookSubsection",
      entityId: args.subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        categoryId: args.categoryId,
        budgetLineId: created.id,
        costPence: card.costPence,
      },
    });
    revalidatePath("/budget");
    await revalidateBookSubsection(args.subsectionId);
    return { ok: true, budgetLineId: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't link" };
  }
}

export async function unlinkOutfitCardFromBudget(
  subsectionId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookOutfitCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Outfit card not found" };
    if (!card.budgetLineId) return { ok: true };
    const previousLineId = card.budgetLineId;
    await db.bookOutfitCard.update({
      where: { subsectionId },
      data: { budgetLineId: null },
    });
    await audit(user, {
      action: "outfit-budget-unlink",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: { cardTitle: card.subsection.title, previousBudgetLineId: previousLineId },
    });
    revalidatePath("/budget");
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't unlink" };
  }
}

// ── STAY card ↔ BudgetLine ───────────────────────────────────────
// Same shape as OUTFIT — flat-cost.
export async function linkStayCardToBudget(args: {
  subsectionId: string;
  categoryId: string;
  description?: string;
}): Promise<BookActionResult & { budgetLineId?: string }> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookStayCard.findUnique({
      where: { subsectionId: args.subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Stay card not found" };
    const description = args.description?.trim() || card.subsection.title;
    const last = await db.budgetLine.findFirst({
      where: { categoryId: args.categoryId },
      orderBy: { order: "desc" },
    });
    const created = await db.budgetLine.create({
      data: {
        categoryId: args.categoryId,
        description,
        estimated: card.costPence == null ? null : (card.costPence / 100).toFixed(2),
        order: (last?.order ?? -1) + 1,
        notes: `Synced from STAY card · ${card.subsection.title}`,
      },
    });
    await db.bookStayCard.update({
      where: { subsectionId: args.subsectionId },
      data: { budgetLineId: created.id },
    });
    await audit(user, {
      action: "stay-budget-link",
      entity: "BookSubsection",
      entityId: args.subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        categoryId: args.categoryId,
        budgetLineId: created.id,
        costPence: card.costPence,
      },
    });
    revalidatePath("/budget");
    await revalidateBookSubsection(args.subsectionId);
    return { ok: true, budgetLineId: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't link" };
  }
}

export async function unlinkStayCardFromBudget(
  subsectionId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookStayCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Stay card not found" };
    if (!card.budgetLineId) return { ok: true };
    const previousLineId = card.budgetLineId;
    await db.bookStayCard.update({
      where: { subsectionId },
      data: { budgetLineId: null },
    });
    await audit(user, {
      action: "stay-budget-unlink",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: { cardTitle: card.subsection.title, previousBudgetLineId: previousLineId },
    });
    revalidatePath("/budget");
    await revalidateBookSubsection(subsectionId);
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
  website: z.string().max(500).nullable(),
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
            website: m.website || null,
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
            website: m.website || null,
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

// ── v1.32.0: MENU card actions ─────────────────────────────────────
//
// Single bulk-save server action that takes the full card state
// (header + courses + options). Server reconciles in a transaction:
//   - Header fields applied directly.
//   - Courses: rows whose id starts "new-" → create; existing → update;
//     existing missing from payload → delete (cascades options).
//   - Options: same shape, scoped to their (possibly newly-created)
//     course. Order field rewritten from the payload's array index.
// Audit-aware metadata per the v1.30.5 standing rule.

const menuOptionPayloadSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(160),
  description: z.string().max(2000).nullable(),
  dietary: z.array(z.string().max(40)),
  isVegetarianMain: z.boolean(),
  isKidsMeal: z.boolean(),
});

const menuCoursePayloadSchema = z.object({
  id: z.string().min(1).max(50),
  courseLabel: z.string().min(1).max(60),
  options: z.array(menuOptionPayloadSchema),
});

const menuSavePayloadSchema = z.object({
  serviceType: z.string().max(60).nullable(),
  serviceTime: z.string().max(60).nullable(),
  pricePerHeadPence: z.number().int().min(0).nullable(),
  // v1.32.0 manual override (deprecated, drop in v1.79). v1.78.0
  // editor sends both this and the new headcountSource fields so the
  // legacy code path keeps working until v1.79.
  confirmedHeadcount: z.number().int().min(0).nullable(),
  // v1.78.0: unified PerHeadSource enum.
  headcountSource: z.nativeEnum(({
    ALL_INVITED: "ALL_INVITED",
    CONFIRMED_PLUS_PENDING: "CONFIRMED_PLUS_PENDING",
    ALL_CONFIRMED: "ALL_CONFIRMED",
    ADULTS_CONFIRMED: "ADULTS_CONFIRMED",
    CHILDREN_CONFIRMED: "CHILDREN_CONFIRMED",
    MANUAL: "MANUAL",
  } as const)).nullable(),
  manualHeadcount: z.number().int().min(0).nullable(),
  notes: z.string().max(4000).nullable(),
  courses: z.array(menuCoursePayloadSchema),
});

export type MenuSavePayload = z.infer<typeof menuSavePayloadSchema>;

export async function saveMenuCard(
  subsectionId: string,
  payload: MenuSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = menuSavePayloadSchema.parse(payload);
    const before = await db.bookMenuCard.findUnique({
      where: { subsectionId },
      include: {
        subsection: true,
        courses: { include: { options: true } },
      },
    });
    if (!before) return { ok: false, error: "Menu card not found" };

    const headerChanged: string[] = [];
    if (parsed.serviceType !== before.serviceType) headerChanged.push("serviceType");
    if (parsed.serviceTime !== before.serviceTime) headerChanged.push("serviceTime");
    if (parsed.pricePerHeadPence !== before.pricePerHeadPence) headerChanged.push("pricePerHeadPence");
    if (parsed.confirmedHeadcount !== before.confirmedHeadcount) headerChanged.push("confirmedHeadcount");
    if (parsed.notes !== before.notes) headerChanged.push("notes");

    const beforeCourseIds = new Set(before.courses.map((c) => c.id));
    const incomingCourseIds = new Set(
      parsed.courses.map((c) => c.id).filter((id) => !id.startsWith("new-")),
    );
    const coursesToDelete = [...beforeCourseIds].filter((id) => !incomingCourseIds.has(id));

    let coursesAdded = 0;
    let coursesUpdated = 0;
    let optionsAdded = 0;
    let optionsRemoved = 0;
    let optionsUpdated = 0;

    await db.$transaction(async (tx) => {
      // Header.
      await tx.bookMenuCard.update({
        where: { subsectionId },
        data: {
          serviceType: parsed.serviceType,
          serviceTime: parsed.serviceTime,
          pricePerHeadPence: parsed.pricePerHeadPence,
          confirmedHeadcount: parsed.confirmedHeadcount,
          // v1.78.0: write the new headcount fields too.
          headcountSource: parsed.headcountSource,
          manualHeadcount: parsed.manualHeadcount,
          notes: parsed.notes,
        },
      });
      // Drop courses missing from payload (cascades options).
      if (coursesToDelete.length > 0) {
        await tx.bookMenuCourse.deleteMany({ where: { id: { in: coursesToDelete } } });
      }
      // Reconcile courses + their options.
      for (let courseIdx = 0; courseIdx < parsed.courses.length; courseIdx++) {
        const c = parsed.courses[courseIdx]!;
        let courseId = c.id;
        if (c.id.startsWith("new-")) {
          const created = await tx.bookMenuCourse.create({
            data: {
              cardId: before.id,
              courseLabel: c.courseLabel,
              order: courseIdx,
            },
          });
          courseId = created.id;
          coursesAdded += 1;
        } else {
          await tx.bookMenuCourse.update({
            where: { id: c.id },
            data: { courseLabel: c.courseLabel, order: courseIdx },
          });
          coursesUpdated += 1;
        }
        // Reconcile options for this course.
        const beforeCourse = before.courses.find((bc) => bc.id === c.id);
        const beforeOptionIds = new Set(beforeCourse?.options.map((o) => o.id) ?? []);
        const incomingOptionIds = new Set(
          c.options.map((o) => o.id).filter((id) => !id.startsWith("new-")),
        );
        const optionsToDelete = [...beforeOptionIds].filter((id) => !incomingOptionIds.has(id));
        if (optionsToDelete.length > 0) {
          await tx.bookMenuOption.deleteMany({ where: { id: { in: optionsToDelete } } });
          optionsRemoved += optionsToDelete.length;
        }
        for (let optIdx = 0; optIdx < c.options.length; optIdx++) {
          const o = c.options[optIdx]!;
          if (o.id.startsWith("new-")) {
            await tx.bookMenuOption.create({
              data: {
                courseId,
                label: o.label,
                description: o.description,
                dietary: o.dietary,
                isVegetarianMain: o.isVegetarianMain,
                isKidsMeal: o.isKidsMeal,
                order: optIdx,
              },
            });
            optionsAdded += 1;
          } else {
            await tx.bookMenuOption.update({
              where: { id: o.id },
              data: {
                label: o.label,
                description: o.description,
                dietary: o.dietary,
                isVegetarianMain: o.isVegetarianMain,
                isKidsMeal: o.isKidsMeal,
                order: optIdx,
              },
            });
            optionsUpdated += 1;
          }
        }
      }
    });

    await audit(user, {
      action: "menu-save",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: before.subsection.title,
        serviceType: parsed.serviceType,
        confirmedHeadcount: parsed.confirmedHeadcount,
        coursesAdded,
        coursesUpdated,
        coursesRemoved: coursesToDelete.length,
        optionsAdded,
        optionsUpdated,
        optionsRemoved,
        headerChanged,
      },
    });

    // v1.78.0: auto-resync the linked BudgetLine if the card has one.
    // No-op when budgetLineId is null (the card isn't linked yet).
    if (before.budgetLineId) {
      const source =
        parsed.headcountSource ??
        (parsed.pricePerHeadPence != null ? "ALL_CONFIRMED" : null);
      await syncBudgetLine(before.budgetLineId, {
        description: before.subsection.title,
        flatEstimatedPounds: null,
        perHead:
          parsed.pricePerHeadPence != null && source
            ? {
                perHeadPence: parsed.pricePerHeadPence,
                headcountSource: source,
                manualHeadcount: parsed.manualHeadcount ?? parsed.confirmedHeadcount ?? null,
              }
            : null,
      });
      revalidatePath("/budget");
    }

    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save menu card" };
  }
}

// ── v1.32.0: BAR card actions ──────────────────────────────────────

const barItemPayloadSchema = z.object({
  id: z.string().min(1).max(50),
  category: z.string().min(1).max(60),
  name: z.string().min(1).max(160),
  quantityPlanned: z.number().min(0).nullable(),
  unit: z.string().max(40).nullable(),
  supplier: z.string().max(120).nullable(),
  website: z.string().max(500).nullable(),
  costPence: z.number().int().min(0).nullable(),
  notes: z.string().max(2000).nullable(),
  // v1.32.2: per-head pricing + serving moment.
  pricePerHeadPence: z.number().int().min(0).nullable(),
  timing: z.string().max(60).nullable(),
  // v1.78.0: per-item headcount source. NULL on flat-priced items.
  // Defaults to ADULTS_CONFIRMED for per-head rows that don't pick a
  // source explicitly (matches the legacy hardcoded behaviour).
  headcountSource: z.enum([
    "ALL_INVITED",
    "CONFIRMED_PLUS_PENDING",
    "ALL_CONFIRMED",
    "ADULTS_CONFIRMED",
    "CHILDREN_CONFIRMED",
    "MANUAL",
  ]).nullable(),
});

const barSavePayloadSchema = z.object({
  barType: z.string().max(60).nullable(),
  tabLimitPence: z.number().int().min(0).nullable(),
  toastDrink: z.string().max(60).nullable(),
  corkagePence: z.number().int().min(0).nullable(),
  notes: z.string().max(4000).nullable(),
  items: z.array(barItemPayloadSchema),
});

export type BarSavePayload = z.infer<typeof barSavePayloadSchema>;

export async function saveBarCard(
  subsectionId: string,
  payload: BarSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = barSavePayloadSchema.parse(payload);
    const before = await db.bookBarCard.findUnique({
      where: { subsectionId },
      include: { subsection: true, items: true },
    });
    if (!before) return { ok: false, error: "Bar card not found" };

    const headerChanged: string[] = [];
    if (parsed.barType !== before.barType) headerChanged.push("barType");
    if (parsed.tabLimitPence !== before.tabLimitPence) headerChanged.push("tabLimitPence");
    if (parsed.toastDrink !== before.toastDrink) headerChanged.push("toastDrink");
    if (parsed.corkagePence !== before.corkagePence) headerChanged.push("corkagePence");
    if (parsed.notes !== before.notes) headerChanged.push("notes");

    const beforeIds = new Set(before.items.map((i) => i.id));
    const incomingIds = new Set(parsed.items.map((i) => i.id).filter((id) => !id.startsWith("new-")));
    const toDelete = [...beforeIds].filter((id) => !incomingIds.has(id));
    const toCreate = parsed.items.filter((i) => i.id.startsWith("new-"));
    const toUpdate = parsed.items.filter((i) => !i.id.startsWith("new-"));

    await db.$transaction(async (tx) => {
      await tx.bookBarCard.update({
        where: { subsectionId },
        data: {
          barType: parsed.barType,
          tabLimitPence: parsed.tabLimitPence,
          toastDrink: parsed.toastDrink,
          corkagePence: parsed.corkagePence,
          notes: parsed.notes,
        },
      });
      if (toDelete.length > 0) {
        await tx.bookBarItem.deleteMany({ where: { id: { in: toDelete } } });
      }
      for (const i of toUpdate) {
        await tx.bookBarItem.update({
          where: { id: i.id },
          data: {
            category: i.category,
            name: i.name,
            quantityPlanned: i.quantityPlanned,
            unit: i.unit,
            supplier: i.supplier,
            website: i.website,
            costPence: i.costPence,
            notes: i.notes,
            pricePerHeadPence: i.pricePerHeadPence,
            timing: i.timing,
            // v1.78.0: per-item headcount source. Default to
            // ADULTS_CONFIRMED for per-head items that don't pick.
            headcountSource:
              i.headcountSource ??
              (i.pricePerHeadPence != null ? "ADULTS_CONFIRMED" : null),
          },
        });
      }
      let orderCounter = before.items.reduce((max, i) => Math.max(max, i.order), -1);
      for (const i of toCreate) {
        orderCounter += 1;
        await tx.bookBarItem.create({
          data: {
            cardId: before.id,
            category: i.category,
            name: i.name,
            quantityPlanned: i.quantityPlanned,
            unit: i.unit,
            supplier: i.supplier,
            website: i.website,
            costPence: i.costPence,
            notes: i.notes,
            pricePerHeadPence: i.pricePerHeadPence,
            timing: i.timing,
            headcountSource:
              i.headcountSource ??
              (i.pricePerHeadPence != null ? "ADULTS_CONFIRMED" : null),
            order: orderCounter,
          },
        });
      }
      // Rewrite order from payload position.
      for (let idx = 0; idx < parsed.items.length; idx++) {
        const i = parsed.items[idx]!;
        if (!i.id.startsWith("new-")) {
          await tx.bookBarItem.update({ where: { id: i.id }, data: { order: idx } });
        }
      }
    });

    await audit(user, {
      action: "bar-save",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: before.subsection.title,
        barType: parsed.barType,
        itemsAdded: toCreate.length,
        itemsUpdated: toUpdate.length,
        itemsRemoved: toDelete.length,
        itemsTotal: parsed.items.length,
        headerChanged,
      },
    });

    // v1.78.0: auto-resync the linked BudgetLine. BAR is multi-item
    // with mixed pricing modes — we sum a flat estimated total here
    // (per-head items × confirmedAdults + flat-priced items). This
    // requires a guest count, so we query confirmedAdults inline.
    if (before.budgetLineId) {
      const confirmedAdults = await db.guest.count({
        where: { archived: false, rsvp: "ATTENDING", isChild: false },
      });
      const totalPence = parsed.items.reduce((sum, i) => {
        if (i.pricePerHeadPence != null) {
          const qty = i.quantityPlanned ?? 1;
          return sum + i.pricePerHeadPence * confirmedAdults * qty;
        }
        return sum + (i.costPence ?? 0);
      }, 0);
      await syncBudgetLine(before.budgetLineId, {
        description: before.subsection.title,
        flatEstimatedPounds: totalPence / 100,
        perHead: null,
      });
      revalidatePath("/budget");
    }

    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save bar card" };
  }
}

// ── v1.33.0: SETUP card actions ────────────────────────────────────
//
// Same single-bulk-save shape as BUILD / MENU / BAR. Header fields
// + items reconciled in a transaction. Audit metadata enriched per
// the v1.30.5 standing rule.

const setupItemPayloadSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(160),
  quantity: z.number().int().min(0).nullable(),
  location: z.string().max(160).nullable(),
  source: z.string().max(120).nullable(),
  website: z.string().max(500).nullable(),
  packed: z.boolean(),
  placed: z.boolean(),
  packDownPlan: z.string().max(2000).nullable(),
  notes: z.string().max(2000).nullable(),
});

const setupSavePayloadSchema = z.object({
  space: z.string().max(120).nullable(),
  setupStartsAt: z.string().max(60).nullable(),
  setupOwner: z.string().max(120).nullable(),
  notes: z.string().max(4000).nullable(),
  items: z.array(setupItemPayloadSchema),
});

export type SetupSavePayload = z.infer<typeof setupSavePayloadSchema>;

export async function saveSetupCard(
  subsectionId: string,
  payload: SetupSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = setupSavePayloadSchema.parse(payload);
    const before = await db.bookSetupCard.findUnique({
      where: { subsectionId },
      include: { subsection: true, items: true },
    });
    if (!before) return { ok: false, error: "Setup card not found" };

    const headerChanged: string[] = [];
    if (parsed.space !== before.space) headerChanged.push("space");
    if (parsed.setupStartsAt !== before.setupStartsAt) headerChanged.push("setupStartsAt");
    if (parsed.setupOwner !== before.setupOwner) headerChanged.push("setupOwner");
    if (parsed.notes !== before.notes) headerChanged.push("notes");

    const beforeIds = new Set(before.items.map((i) => i.id));
    const incomingIds = new Set(parsed.items.map((i) => i.id).filter((id) => !id.startsWith("new-")));
    const toDelete = [...beforeIds].filter((id) => !incomingIds.has(id));
    const toCreate = parsed.items.filter((i) => i.id.startsWith("new-"));
    const toUpdate = parsed.items.filter((i) => !i.id.startsWith("new-"));

    await db.$transaction(async (tx) => {
      await tx.bookSetupCard.update({
        where: { subsectionId },
        data: {
          space: parsed.space,
          setupStartsAt: parsed.setupStartsAt,
          setupOwner: parsed.setupOwner,
          notes: parsed.notes,
        },
      });
      if (toDelete.length > 0) {
        await tx.bookSetupItem.deleteMany({ where: { id: { in: toDelete } } });
      }
      for (const i of toUpdate) {
        await tx.bookSetupItem.update({
          where: { id: i.id },
          data: {
            name: i.name,
            quantity: i.quantity,
            location: i.location,
            source: i.source,
            website: i.website,
            packed: i.packed,
            placed: i.placed,
            packDownPlan: i.packDownPlan,
            notes: i.notes,
          },
        });
      }
      let orderCounter = before.items.reduce((max, i) => Math.max(max, i.order), -1);
      for (const i of toCreate) {
        orderCounter += 1;
        await tx.bookSetupItem.create({
          data: {
            cardId: before.id,
            name: i.name,
            quantity: i.quantity,
            location: i.location,
            source: i.source,
            website: i.website,
            packed: i.packed,
            placed: i.placed,
            packDownPlan: i.packDownPlan,
            notes: i.notes,
            order: orderCounter,
          },
        });
      }
      for (let idx = 0; idx < parsed.items.length; idx++) {
        const i = parsed.items[idx]!;
        if (!i.id.startsWith("new-")) {
          await tx.bookSetupItem.update({ where: { id: i.id }, data: { order: idx } });
        }
      }
    });

    await audit(user, {
      action: "setup-save",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: before.subsection.title,
        space: parsed.space,
        itemsAdded: toCreate.length,
        itemsUpdated: toUpdate.length,
        itemsRemoved: toDelete.length,
        itemsTotal: parsed.items.length,
        headerChanged,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save setup card" };
  }
}

// ── v1.34.0: LEGAL card actions ────────────────────────────────────
//
// Same single-bulk-save shape as SETUP. File attach/detach are
// per-row actions kept separate from saveLegalCard because file
// ops carry side effects (and per-row UX is faster than re-saving
// the whole card just to attach a single PDF).

const legalItemPayloadSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(160),
  requiredFor: z.string().max(40).nullable(),
  obtained: z.boolean(),
  obtainedAt: z.string().nullable(), // ISO yyyy-mm-dd | empty
  expiresAt: z.string().nullable(),
  notes: z.string().max(2000).nullable(),
});

const legalSavePayloadSchema = z.object({
  regulator: z.string().max(120).nullable(),
  regulatorContact: z.string().max(400).nullable(),
  dueByDate: z.string().nullable(),
  notes: z.string().max(4000).nullable(),
  items: z.array(legalItemPayloadSchema),
});

export type LegalSavePayload = z.infer<typeof legalSavePayloadSchema>;

function parseISODate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function saveLegalCard(
  subsectionId: string,
  payload: LegalSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = legalSavePayloadSchema.parse(payload);
    const before = await db.bookLegalCard.findUnique({
      where: { subsectionId },
      include: { subsection: true, items: true },
    });
    if (!before) return { ok: false, error: "Legal card not found" };

    const headerChanged: string[] = [];
    if (parsed.regulator !== before.regulator) headerChanged.push("regulator");
    if (parsed.regulatorContact !== before.regulatorContact)
      headerChanged.push("regulatorContact");
    const newDue = parseISODate(parsed.dueByDate)?.getTime() ?? null;
    const oldDue = before.dueByDate?.getTime() ?? null;
    if (newDue !== oldDue) headerChanged.push("dueByDate");
    if (parsed.notes !== before.notes) headerChanged.push("notes");

    const beforeIds = new Set(before.items.map((i) => i.id));
    const incomingIds = new Set(
      parsed.items.map((i) => i.id).filter((id) => !id.startsWith("new-")),
    );
    const toDelete = [...beforeIds].filter((id) => !incomingIds.has(id));
    const toCreate = parsed.items.filter((i) => i.id.startsWith("new-"));
    const toUpdate = parsed.items.filter((i) => !i.id.startsWith("new-"));

    await db.$transaction(async (tx) => {
      await tx.bookLegalCard.update({
        where: { subsectionId },
        data: {
          regulator: parsed.regulator,
          regulatorContact: parsed.regulatorContact,
          dueByDate: parseISODate(parsed.dueByDate),
          notes: parsed.notes,
        },
      });
      if (toDelete.length > 0) {
        await tx.bookLegalItem.deleteMany({ where: { id: { in: toDelete } } });
      }
      for (const i of toUpdate) {
        await tx.bookLegalItem.update({
          where: { id: i.id },
          data: {
            label: i.label,
            requiredFor: i.requiredFor,
            obtained: i.obtained,
            obtainedAt: parseISODate(i.obtainedAt),
            expiresAt: parseISODate(i.expiresAt),
            notes: i.notes,
          },
        });
      }
      let orderCounter = before.items.reduce((max, i) => Math.max(max, i.order), -1);
      for (const i of toCreate) {
        orderCounter += 1;
        await tx.bookLegalItem.create({
          data: {
            cardId: before.id,
            label: i.label,
            requiredFor: i.requiredFor,
            obtained: i.obtained,
            obtainedAt: parseISODate(i.obtainedAt),
            expiresAt: parseISODate(i.expiresAt),
            notes: i.notes,
            order: orderCounter,
          },
        });
      }
      for (let idx = 0; idx < parsed.items.length; idx++) {
        const i = parsed.items[idx]!;
        if (!i.id.startsWith("new-")) {
          await tx.bookLegalItem.update({ where: { id: i.id }, data: { order: idx } });
        }
      }
    });

    await audit(user, {
      action: "legal-save",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: before.subsection.title,
        regulator: parsed.regulator,
        itemsAdded: toCreate.length,
        itemsUpdated: toUpdate.length,
        itemsRemoved: toDelete.length,
        itemsTotal: parsed.items.length,
        headerChanged,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save legal card" };
  }
}

// v1.34.0: file attachment / detachment per LEGAL item. Reuses the
// existing /api/files/[id] download flow; the FK + cascade settings
// on the schema mean orphaned file references can never block a
// File deletion.
export async function attachFileToLegalItem(
  itemId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const item = await db.bookLegalItem.findUnique({
      where: { id: itemId },
      include: { card: { include: { subsection: true } } },
    });
    if (!item) return { ok: false, error: "Legal item not found" };
    const file = await db.file.findUnique({ where: { id: fileId } });
    if (!file) return { ok: false, error: "File not found" };
    await db.bookLegalItem.update({ where: { id: itemId }, data: { fileId } });
    await audit(user, {
      action: "legal-file-attach",
      entity: "BookSubsection",
      entityId: item.card.subsectionId,
      metadata: {
        cardTitle: item.card.subsection.title,
        itemLabel: item.label,
        fileId,
        fileName: file.name,
      },
    });
    await revalidateBookSubsection(item.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't attach file" };
  }
}

export async function detachFileFromLegalItem(
  itemId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const item = await db.bookLegalItem.findUnique({
      where: { id: itemId },
      include: { card: { include: { subsection: true } }, file: true },
    });
    if (!item) return { ok: false, error: "Legal item not found" };
    if (!item.fileId) return { ok: true };
    const previousFileId = item.fileId;
    const previousFileName = item.file?.name ?? null;
    await db.bookLegalItem.update({ where: { id: itemId }, data: { fileId: null } });
    await audit(user, {
      action: "legal-file-detach",
      entity: "BookSubsection",
      entityId: item.card.subsectionId,
      metadata: {
        cardTitle: item.card.subsection.title,
        itemLabel: item.label,
        previousFileId,
        previousFileName,
      },
    });
    await revalidateBookSubsection(item.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't detach file" };
  }
}

// ── v1.35.0: OUTFIT card actions (rework) ──────────────────────────
//
// Same single-bulk-save shape as BUILD / MENU / BAR / SETUP / LEGAL.
// Card-level fields hold the per-person identity + fitting timeline +
// cost; items are per-item composition (dress / shoes / etc.).
//
// Legacy addBookOutfit / updateBookOutfit / deleteBookOutfit kept in
// place above — they still write to the row table, so older callers
// don't break. New editor uses saveOutfitCard exclusively.

const outfitItemPayloadSchema = z.object({
  id: z.string().min(1).max(50),
  itemLabel: z.string().min(1).max(160),
  description: z.string().max(2000).nullable(),
  supplier: z.string().max(120).nullable(),
  website: z.string().max(500).nullable(),
  status: z.string().max(40).nullable(),
  notes: z.string().max(2000).nullable(),
});

const outfitSavePayloadSchema = z.object({
  personName: z.string().max(120).nullable(),
  role: z.string().max(60).nullable(),
  fittingDate: z.string().nullable(),
  alterationsDueBy: z.string().nullable(),
  pickupDate: z.string().nullable(),
  costPence: z.number().int().min(0).nullable(),
  paidBy: z.string().max(40).nullable(),
  paid: z.boolean(),
  fileIds: z.array(z.string().min(1).max(50)),
  notes: z.string().max(4000).nullable(),
  items: z.array(outfitItemPayloadSchema),
});

export type OutfitSavePayload = z.infer<typeof outfitSavePayloadSchema>;

export async function saveOutfitCard(
  subsectionId: string,
  payload: OutfitSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = outfitSavePayloadSchema.parse(payload);
    const before = await db.bookOutfitCard.findUnique({
      where: { subsectionId },
      include: { subsection: true, outfits: true },
    });
    if (!before) return { ok: false, error: "Outfit card not found" };

    const headerChanged: string[] = [];
    if (parsed.personName !== before.personName) headerChanged.push("personName");
    if (parsed.role !== before.role) headerChanged.push("role");
    const newFitting = parseISODate(parsed.fittingDate)?.getTime() ?? null;
    const oldFitting = before.fittingDate?.getTime() ?? null;
    if (newFitting !== oldFitting) headerChanged.push("fittingDate");
    const newAlt = parseISODate(parsed.alterationsDueBy)?.getTime() ?? null;
    const oldAlt = before.alterationsDueBy?.getTime() ?? null;
    if (newAlt !== oldAlt) headerChanged.push("alterationsDueBy");
    const newPickup = parseISODate(parsed.pickupDate)?.getTime() ?? null;
    const oldPickup = before.pickupDate?.getTime() ?? null;
    if (newPickup !== oldPickup) headerChanged.push("pickupDate");
    if (parsed.costPence !== before.costPence) headerChanged.push("costPence");
    if (parsed.paidBy !== before.paidBy) headerChanged.push("paidBy");
    if (parsed.paid !== before.paid) headerChanged.push("paid");
    if (parsed.notes !== before.notes) headerChanged.push("notes");
    if (JSON.stringify([...parsed.fileIds].sort()) !== JSON.stringify([...before.fileIds].sort())) {
      headerChanged.push("fileIds");
    }

    const beforeIds = new Set(before.outfits.map((i) => i.id));
    const incomingIds = new Set(
      parsed.items.map((i) => i.id).filter((id) => !id.startsWith("new-")),
    );
    const toDelete = [...beforeIds].filter((id) => !incomingIds.has(id));
    const toCreate = parsed.items.filter((i) => i.id.startsWith("new-"));
    const toUpdate = parsed.items.filter((i) => !i.id.startsWith("new-"));

    await db.$transaction(async (tx) => {
      await tx.bookOutfitCard.update({
        where: { subsectionId },
        data: {
          personName: parsed.personName,
          role: parsed.role,
          fittingDate: parseISODate(parsed.fittingDate),
          alterationsDueBy: parseISODate(parsed.alterationsDueBy),
          pickupDate: parseISODate(parsed.pickupDate),
          costPence: parsed.costPence,
          paidBy: parsed.paidBy,
          paid: parsed.paid,
          notes: parsed.notes,
          fileIds: parsed.fileIds,
        },
      });
      if (toDelete.length > 0) {
        await tx.bookOutfit.deleteMany({ where: { id: { in: toDelete } } });
      }
      for (const i of toUpdate) {
        await tx.bookOutfit.update({
          where: { id: i.id },
          data: {
            itemLabel: i.itemLabel,
            description: i.description,
            supplier: i.supplier,
            website: i.website,
            status: i.status,
            notes: i.notes,
          },
        });
      }
      let orderCounter = before.outfits.reduce((max, i) => Math.max(max, i.order), -1);
      for (const i of toCreate) {
        orderCounter += 1;
        await tx.bookOutfit.create({
          data: {
            cardId: before.id,
            itemLabel: i.itemLabel,
            description: i.description,
            supplier: i.supplier,
            website: i.website,
            status: i.status,
            notes: i.notes,
            order: orderCounter,
            // Legacy required field — null is fine post-migration; keep
            // a placeholder so existing prod rows pre-migration don't
            // collide. The migration's ALTER drops the NOT NULL.
            personName: null,
          },
        });
      }
      for (let idx = 0; idx < parsed.items.length; idx++) {
        const i = parsed.items[idx]!;
        if (!i.id.startsWith("new-")) {
          await tx.bookOutfit.update({ where: { id: i.id }, data: { order: idx } });
        }
      }
    });

    await audit(user, {
      action: "outfit-save",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: before.subsection.title,
        personName: parsed.personName,
        role: parsed.role,
        itemsAdded: toCreate.length,
        itemsUpdated: toUpdate.length,
        itemsRemoved: toDelete.length,
        itemsTotal: parsed.items.length,
        headerChanged,
      },
    });

    // v1.78.0: auto-resync the linked BudgetLine. Flat estimate from
    // costPence; no per-head config (an outfit isn't priced per head).
    if (before.budgetLineId) {
      await syncBudgetLine(before.budgetLineId, {
        description: before.subsection.title,
        flatEstimatedPounds: parsed.costPence == null ? null : parsed.costPence / 100,
        perHead: null,
      });
      revalidatePath("/budget");
    }

    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save outfit card" };
  }
}

// v1.35.0: file attach/detach for OUTFIT cards. fileIds is a String[]
// on BookOutfitCard rather than a relation, so attach = append-id,
// detach = remove-id. Keeps the existing files-page UX unchanged.

export async function attachFileToOutfitCard(
  subsectionId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookOutfitCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Outfit card not found" };
    const file = await db.file.findUnique({ where: { id: fileId } });
    if (!file) return { ok: false, error: "File not found" };
    if (card.fileIds.includes(fileId)) return { ok: true };
    const next = [...card.fileIds, fileId];
    await db.bookOutfitCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "outfit-file-attach",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        personName: card.personName,
        fileId,
        fileName: file.name,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't attach file" };
  }
}

export async function detachFileFromOutfitCard(
  subsectionId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookOutfitCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Outfit card not found" };
    if (!card.fileIds.includes(fileId)) return { ok: true };
    const file = await db.file.findUnique({ where: { id: fileId } });
    const next = card.fileIds.filter((id) => id !== fileId);
    await db.bookOutfitCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "outfit-file-detach",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        personName: card.personName,
        fileId,
        fileName: file?.name ?? null,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't detach file" };
  }
}

// ── v1.36.0 (P6): STAY card actions ─────────────────────────────────
//
// One card per booking. Single-bulk-save shape: payload covers every
// card-level field (no child-row reconcile because STAY is a single
// row, not a list-of-rows). Occupants is free-text array; guestIds
// is an array of optional Guest.id FKs (forward link only — no
// relation defined; reverse query lives at render time).

const staySavePayloadSchema = z.object({
  propertyName: z.string().max(160).nullable(),
  propertyContact: z.string().max(400).nullable(),
  bookingReference: z.string().max(120).nullable(),
  checkInDate: z.string().nullable(),
  checkOutDate: z.string().nullable(),
  costPence: z.number().int().min(0).nullable(),
  paidBy: z.string().max(40).nullable(),
  paid: z.boolean(),
  occupants: z.array(z.string().min(1).max(120)),
  guestIds: z.array(z.string().min(1).max(50)),
  notes: z.string().max(4000).nullable(),
});

export type StaySavePayload = z.infer<typeof staySavePayloadSchema>;

export async function saveStayCard(
  subsectionId: string,
  payload: StaySavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = staySavePayloadSchema.parse(payload);
    const before = await db.bookStayCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!before) return { ok: false, error: "Stay card not found" };

    const changedFields: string[] = [];
    if (parsed.propertyName !== before.propertyName) changedFields.push("propertyName");
    if (parsed.propertyContact !== before.propertyContact) changedFields.push("propertyContact");
    if (parsed.bookingReference !== before.bookingReference) changedFields.push("bookingReference");
    const newCi = parseISODate(parsed.checkInDate)?.getTime() ?? null;
    const oldCi = before.checkInDate?.getTime() ?? null;
    if (newCi !== oldCi) changedFields.push("checkInDate");
    const newCo = parseISODate(parsed.checkOutDate)?.getTime() ?? null;
    const oldCo = before.checkOutDate?.getTime() ?? null;
    if (newCo !== oldCo) changedFields.push("checkOutDate");
    if (parsed.costPence !== before.costPence) changedFields.push("costPence");
    if (parsed.paidBy !== before.paidBy) changedFields.push("paidBy");
    if (parsed.paid !== before.paid) changedFields.push("paid");
    if (parsed.notes !== before.notes) changedFields.push("notes");
    if (JSON.stringify(parsed.occupants) !== JSON.stringify(before.occupants)) {
      changedFields.push("occupants");
    }
    if (
      JSON.stringify([...parsed.guestIds].sort()) !==
      JSON.stringify([...before.guestIds].sort())
    ) {
      changedFields.push("guestIds");
    }

    await db.bookStayCard.update({
      where: { subsectionId },
      data: {
        propertyName: parsed.propertyName,
        propertyContact: parsed.propertyContact,
        bookingReference: parsed.bookingReference,
        checkInDate: parseISODate(parsed.checkInDate),
        checkOutDate: parseISODate(parsed.checkOutDate),
        costPence: parsed.costPence,
        paidBy: parsed.paidBy,
        paid: parsed.paid,
        occupants: parsed.occupants,
        guestIds: parsed.guestIds,
        notes: parsed.notes,
      },
    });

    await audit(user, {
      action: "stay-save",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: before.subsection.title,
        propertyName: parsed.propertyName,
        guestCount: parsed.guestIds.length,
        occupantCount: parsed.occupants.length,
        changedFields,
      },
    });

    // v1.78.0: auto-resync the linked BudgetLine.
    if (before.budgetLineId) {
      await syncBudgetLine(before.budgetLineId, {
        description: before.subsection.title,
        flatEstimatedPounds: parsed.costPence == null ? null : parsed.costPence / 100,
        perHead: null,
      });
      revalidatePath("/budget");
    }

    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save stay card" };
  }
}

// ── v1.36.0 (P6): LODGING_GUIDE card actions ────────────────────────
//
// One card with rows for recommended hotels. Single-bulk-save with
// child reconcile (id starts "new-" → create; missing from payload
// → delete; existing → update). Items have no tracked-state, so
// nothing to flag here.

const lodgingItemPayloadSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(160),
  distanceFromVenue: z.string().max(120).nullable(),
  priceRangeLabel: z.string().max(20).nullable(),
  phone: z.string().max(40).nullable(),
  website: z.string().max(400).nullable(),
  groupRateCode: z.string().max(80).nullable(),
  notes: z.string().max(2000).nullable(),
});

const lodgingSavePayloadSchema = z.object({
  notes: z.string().max(4000).nullable(),
  items: z.array(lodgingItemPayloadSchema),
});

export type LodgingSavePayload = z.infer<typeof lodgingSavePayloadSchema>;

export async function saveLodgingCard(
  subsectionId: string,
  payload: LodgingSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = lodgingSavePayloadSchema.parse(payload);
    const before = await db.bookLodgingCard.findUnique({
      where: { subsectionId },
      include: { subsection: true, items: true },
    });
    if (!before) return { ok: false, error: "Lodging card not found" };

    const headerChanged: string[] = [];
    if (parsed.notes !== before.notes) headerChanged.push("notes");

    const beforeIds = new Set(before.items.map((i) => i.id));
    const incomingIds = new Set(
      parsed.items.map((i) => i.id).filter((id) => !id.startsWith("new-")),
    );
    const toDelete = [...beforeIds].filter((id) => !incomingIds.has(id));
    const toCreate = parsed.items.filter((i) => i.id.startsWith("new-"));
    const toUpdate = parsed.items.filter((i) => !i.id.startsWith("new-"));

    await db.$transaction(async (tx) => {
      await tx.bookLodgingCard.update({
        where: { subsectionId },
        data: { notes: parsed.notes },
      });
      if (toDelete.length > 0) {
        await tx.bookLodgingItem.deleteMany({ where: { id: { in: toDelete } } });
      }
      for (const i of toUpdate) {
        await tx.bookLodgingItem.update({
          where: { id: i.id },
          data: {
            name: i.name,
            distanceFromVenue: i.distanceFromVenue,
            priceRangeLabel: i.priceRangeLabel,
            phone: i.phone,
            website: i.website,
            groupRateCode: i.groupRateCode,
            notes: i.notes,
          },
        });
      }
      let orderCounter = before.items.reduce((max, i) => Math.max(max, i.order), -1);
      for (const i of toCreate) {
        orderCounter += 1;
        await tx.bookLodgingItem.create({
          data: {
            cardId: before.id,
            name: i.name,
            distanceFromVenue: i.distanceFromVenue,
            priceRangeLabel: i.priceRangeLabel,
            phone: i.phone,
            website: i.website,
            groupRateCode: i.groupRateCode,
            notes: i.notes,
            order: orderCounter,
          },
        });
      }
      for (let idx = 0; idx < parsed.items.length; idx++) {
        const i = parsed.items[idx]!;
        if (!i.id.startsWith("new-")) {
          await tx.bookLodgingItem.update({ where: { id: i.id }, data: { order: idx } });
        }
      }
    });

    await audit(user, {
      action: "lodging-save",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: before.subsection.title,
        itemsAdded: toCreate.length,
        itemsUpdated: toUpdate.length,
        itemsRemoved: toDelete.length,
        itemsTotal: parsed.items.length,
        headerChanged,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save lodging card" };
  }
}

// ── v1.63.0: image-gallery actions for BUILD / SETUP / STAY ────────────
//
// Three card kinds gain a `fileIds: String[]` photo gallery in v1.63.0
// (BUILD = centerpieces, SETUP = space layouts, STAY = bridal suite).
// Same shape as the v1.35.0 BookOutfitCard.fileIds — forward-only
// references to File ids; the rendering layer joins at read time.
//
// Each kind gets:
//   • `uploadAndAttach<Kind>File(subsectionId, formData)` — one-step
//     upload + attach for the "I just took a photo" use case. Wraps
//     the same file-write logic /files/actions.ts uses.
//   • `attach<Kind>File(subsectionId, fileId)` — attach a pre-uploaded
//     File row.
//   • `detach<Kind>File(subsectionId, fileId)` — opposite.
//
// All three respect the existing `book` permission gate and emit
// enriched audit metadata per the v1.30.5 standing rule.

/** Internal: write the uploaded File to disk, insert the DB row, and
 *  return the File. Mirrors uploadFile in files/actions.ts but
 *  returns the row instead of revalidating /files (we revalidate
 *  /book on the calling action). */
async function uploadFileForBookCard(
  user: { id: string },
  formFile: File,
): Promise<{ id: string; name: string; mimeType: string }> {
  const validation = validateUpload(formFile);
  if (!validation.ok) throw new Error(`${formFile.name}: ${validation.error}`);

  await ensureUploadsDir();
  const storedName = generateStoredName(validation.mime, formFile.name);
  const fullPath = path.join(UPLOADS_DIR, storedName);
  const bytes = Buffer.from(await formFile.arrayBuffer());
  await writeFile(fullPath, bytes, { mode: 0o640 });

  let created;
  try {
    created = await db.file.create({
      data: {
        name: formFile.name.slice(0, 200),
        storedPath: storedName,
        // Book-card photos default to EVERYONE — couple-only photos
        // would need to be uploaded via /files first.
        folder: "Book photos",
        visibility: FileVisibility.EVERYONE,
        mimeType: validation.mime,
        sizeBytes: formFile.size,
        uploadedById: user.id,
      },
    });
  } catch (err) {
    // Roll back the disk write if the DB insert fails — otherwise
    // we accumulate orphan files on disk.
    await unlink(fullPath).catch(() => undefined);
    throw err;
  }
  return created;
}

// ─── BUILD card ─────────────────────────────────────────────────────

export async function uploadAndAttachBuildFile(
  subsectionId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookBuildCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Build card not found" };
    const formFile = formData.get("file");
    if (!(formFile instanceof File) || formFile.size === 0) {
      return { ok: false, error: "No file received." };
    }
    const file = await uploadFileForBookCard(user, formFile);
    const next = [...card.fileIds, file.id];
    await db.bookBuildCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "build-file-upload",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't upload" };
  }
}

export async function attachFileToBuildCard(
  subsectionId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookBuildCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Build card not found" };
    const file = await db.file.findUnique({ where: { id: fileId } });
    if (!file) return { ok: false, error: "File not found" };
    if (card.fileIds.includes(fileId)) return { ok: true };
    const next = [...card.fileIds, fileId];
    await db.bookBuildCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "build-file-attach",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        fileId,
        fileName: file.name,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't attach" };
  }
}

export async function detachFileFromBuildCard(
  subsectionId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookBuildCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Build card not found" };
    if (!card.fileIds.includes(fileId)) return { ok: true };
    const file = await db.file.findUnique({ where: { id: fileId } });
    const next = card.fileIds.filter((id) => id !== fileId);
    await db.bookBuildCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "build-file-detach",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        fileId,
        fileName: file?.name ?? null,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't detach" };
  }
}

// ─── SETUP card ─────────────────────────────────────────────────────

export async function uploadAndAttachSetupFile(
  subsectionId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookSetupCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Setup card not found" };
    const formFile = formData.get("file");
    if (!(formFile instanceof File) || formFile.size === 0) {
      return { ok: false, error: "No file received." };
    }
    const file = await uploadFileForBookCard(user, formFile);
    const next = [...card.fileIds, file.id];
    await db.bookSetupCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "setup-file-upload",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        space: card.space ?? null,
        fileId: file.id,
        fileName: file.name,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't upload" };
  }
}

export async function attachFileToSetupCard(
  subsectionId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookSetupCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Setup card not found" };
    const file = await db.file.findUnique({ where: { id: fileId } });
    if (!file) return { ok: false, error: "File not found" };
    if (card.fileIds.includes(fileId)) return { ok: true };
    const next = [...card.fileIds, fileId];
    await db.bookSetupCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "setup-file-attach",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        fileId,
        fileName: file.name,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't attach" };
  }
}

export async function detachFileFromSetupCard(
  subsectionId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookSetupCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Setup card not found" };
    if (!card.fileIds.includes(fileId)) return { ok: true };
    const file = await db.file.findUnique({ where: { id: fileId } });
    const next = card.fileIds.filter((id) => id !== fileId);
    await db.bookSetupCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "setup-file-detach",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        fileId,
        fileName: file?.name ?? null,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't detach" };
  }
}

// ─── STAY card ─────────────────────────────────────────────────────

export async function uploadAndAttachStayFile(
  subsectionId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookStayCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Stay card not found" };
    const formFile = formData.get("file");
    if (!(formFile instanceof File) || formFile.size === 0) {
      return { ok: false, error: "No file received." };
    }
    const file = await uploadFileForBookCard(user, formFile);
    const next = [...card.fileIds, file.id];
    await db.bookStayCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "stay-file-upload",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        propertyName: card.propertyName ?? null,
        fileId: file.id,
        fileName: file.name,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't upload" };
  }
}

export async function attachFileToStayCard(
  subsectionId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookStayCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Stay card not found" };
    const file = await db.file.findUnique({ where: { id: fileId } });
    if (!file) return { ok: false, error: "File not found" };
    if (card.fileIds.includes(fileId)) return { ok: true };
    const next = [...card.fileIds, fileId];
    await db.bookStayCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "stay-file-attach",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        fileId,
        fileName: file.name,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't attach" };
  }
}

export async function detachFileFromStayCard(
  subsectionId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookStayCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Stay card not found" };
    if (!card.fileIds.includes(fileId)) return { ok: true };
    const file = await db.file.findUnique({ where: { id: fileId } });
    const next = card.fileIds.filter((id) => id !== fileId);
    await db.bookStayCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "stay-file-detach",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        fileId,
        fileName: file?.name ?? null,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't detach" };
  }
}

// ─── OUTFIT upload-and-attach ───────────────────────────────────────
//
// v1.35.0 added attachFileToOutfitCard / detachFileFromOutfitCard but
// no upload-and-attach. v1.63.0 adds the missing one so the
// <ImageGallery> component's direct-upload affordance works on
// OUTFIT cards too.

export async function uploadAndAttachOutfitFile(
  subsectionId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookOutfitCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Outfit card not found" };
    const formFile = formData.get("file");
    if (!(formFile instanceof File) || formFile.size === 0) {
      return { ok: false, error: "No file received." };
    }
    const file = await uploadFileForBookCard(user, formFile);
    const next = [...card.fileIds, file.id];
    await db.bookOutfitCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "outfit-file-upload",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
        personName: card.personName,
        fileId: file.id,
        fileName: file.name,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't upload" };
  }
}
