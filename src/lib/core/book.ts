// v2.8.0: session-free cores for the Wedding Book write surface
// (T1 self-apply).
//
// The MCP agent applies book.* proposals over token auth — no Auth.js
// session exists on that path, so the entity-writing halves of the
// book server actions can't live behind `requireEdit()` in the
// "use server" file: that gate calls auth()→redirect("/signin"), which
// throws NEXT_REDIRECT when the caller has no session, and the write
// silently fails. They live here instead, taking an explicit
// `user: SessionUser`.
//
// Contract (same as src/lib/core/{guests,suppliers,tasks}.ts):
// - No auth here. Callers own the gate: the server-action wrappers in
//   src/app/(app)/book/actions.ts run requireEdit("book") before
//   delegating; the AI apply dispatch re-asserts the book-edit gate
//   via requireSectionEdit(user,"book") in execute.ts BEFORE calling
//   applyBookProposal, which then runs assertBookCardWritable for the
//   COUPLE_ONLY visibility wall (the two are orthogonal — one is
//   section-EDIT, the other per-card couple-only).
//   NEVER export these from a "use server" file — every export
//   there becomes a client-invokable action, and a core that takes
//   `user` as a parameter instead of reading the session would be a
//   forged-user endpoint.
// - Cores keep EVERYTHING after the parse: db writes, transactions,
//   child-row reconciles, audit rows, budget-line resyncs, and
//   revalidatePath calls (legal in both server actions and route
//   handlers) — so human flows through the wrappers stay byte-identical.
// - Cores value-import ONLY plain libs. `logAudit({ userId: user.id, … })`
//   is byte-identical to the audit(user, …) helper (which is just
//   logAudit({ …entry, userId: user.id })) — used directly so the core
//   doesn't value-import @/lib/actions and drag the @/auth graph into
//   the isolated MCP tool-registry bundle.

import { revalidatePath } from "next/cache";
import { BookSubsectionKind, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
// Type-only import from actions: a VALUE import would drag the
// @/auth (next-auth) module graph into every registry consumer.
import type { SessionUser } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { sanitizeBookHtml, legacyBodyToHtml } from "@/lib/sanitize-book-html";
import { slugify, disambiguateSlug } from "@/lib/slugify";
import {
  parseBookFieldValue,
  validateShot,
  type BookFieldDefShape,
  type BookFieldValues,
  type BookShotShape,
} from "@/lib/book-cards";

// v1.26.0: shared result shape — every save/field/shot core returns
// this rather than throwing, so Next production redaction can't swallow
// the validation message (see v1.22.9 / v1.23.2). Structurally
// identical to BookActionResult in book/actions.ts, so the wrappers can
// return a core's result directly.
type BookActionResult = { ok: true } | { ok: false; error: string };

// Tri-state body fields: `undefined` = field not posted (leave the
// column untouched) — matching the wrapper's `formData.get(x) !== null`
// check. A posted empty string normalises to null inside the core,
// same as the pre-extraction action.
export type BookSubsectionUpdateInput = {
  /** Raw title — trimmed here; empty after trim throws. */
  title: string;
  /** Raw HTML (Tiptap or AI-composed) — sanitised here. */
  bodyHtml?: string;
  /** Legacy plain-text body — escaped + wrapped via legacyBodyToHtml. */
  body?: string;
};

export async function updateBookSubsectionCore(
  user: SessionUser,
  id: string,
  input: BookSubsectionUpdateInput,
): Promise<void> {
  const title = input.title.trim();
  // v1.37.0: TEXT cards now author HTML via Tiptap. The form posts
  // `bodyHtml` (sanitised on its way in here); the legacy `body`
  // textarea is gone. Non-TEXT kinds don't post body at all — they
  // store their content in per-kind tables. We accept either field
  // for back-compat with any callers that still post `body` (none
  // in tree, but keeps the surface non-breaking for one release).
  if (!title) throw new Error("Title is required");
  const data: {
    title: string;
    bodyHtml?: string | null;
    body?: string | null;
  } = { title };
  if (input.bodyHtml !== undefined) {
    const cleaned = sanitizeBookHtml(input.bodyHtml);
    data.bodyHtml = cleaned || null;
  } else if (input.body !== undefined) {
    // Legacy callers posting `body` get their content escaped + wrapped
    // through legacyBodyToHtml. The plain body column also gets
    // updated so old read paths keep working through the buffer
    // release.
    const text = input.body;
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
  await logAudit({
    userId: user.id,
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

// ─── Shared helpers (moved verbatim from book/actions.ts) ──────────
//
// revalidateBookSubsection is exported because the many non-extracted
// actions still in book/actions.ts import it back from here — one
// implementation, shared from the plain-lib file that may legally
// export non-actions.

export async function revalidateBookSubsection(id: string) {
  const sub = await db.bookSubsection.findUnique({
    where: { id },
    include: { section: true },
  });
  revalidatePath("/book");
  if (sub) revalidatePath(`/book/${sub.section.slug}`);
}

// v2.0.0: parseISODate survives the LEGAL removal here — saveStayCard
// (below) is its only remaining caller.
function parseISODate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// v1.78.0: shared helper to update a BudgetLine in-place from a card
// save. Mirrors the v1.31.1 BUILD pattern but in helper form so the
// MENU/BAR/OUTFIT/STAY save cores can call it on every save without
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

// ─── Section + subsection create ──────────────────────────────────

// v1.94.2: slug dropped from the create schema — derived from
// title server-side via slugify() + disambiguated against existing
// section slugs.
const sectionSchema = z.object({
  title: z.string().min(1).max(120),
  // v1.94.0: optional descriptive line under the section title.
  subtitle: z.string().max(240).optional().nullable(),
});

const subsectionSchema = z.object({
  sectionId: z.string().min(1),
  title: z.string().min(1).max(120),
  body: z.string().max(20000).optional().nullable(),
  kind: z.nativeEnum(BookSubsectionKind).default(BookSubsectionKind.TEXT),
});

export async function createBookSectionCore(
  user: SessionUser,
  formData: FormData,
): Promise<{ id: string }> {
  const parsed = sectionSchema.parse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle"),
  });
  // v1.94.0: empty string → null for the optional subtitle so the
  // /book overview falls through to SECTION_META.description.
  const subtitle =
    parsed.subtitle && parsed.subtitle.trim() ? parsed.subtitle.trim() : null;
  // v1.94.2: auto-derive a URL-safe slug from the title. Fallback to
  // "section" when the title is pure punctuation / non-alphanumeric so
  // we never hit the unique-constraint violation on an empty slug.
  const baseSlug = slugify(parsed.title) || "section";
  const slug = await disambiguateSlug(baseSlug, async (candidate) => {
    const existing = await db.bookSection.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    return existing !== null;
  });
  const last = await db.bookSection.findFirst({ orderBy: { order: "desc" } });
  const created = await db.bookSection.create({
    data: {
      slug,
      title: parsed.title,
      subtitle,
      order: (last?.order ?? -1) + 1,
    },
  });
  await logAudit({
    userId: user.id,
    action: "create",
    entity: "BookSection",
    entityId: created.id,
    metadata: {
      slug: created.slug,
      title: created.title,
      subtitle: created.subtitle,
      order: created.order,
    },
  });
  revalidatePath("/book");
  // v2.4.0: return the id so the AI proposal apply-bridge can link the
  // AiProposal to the row it just produced. Form callers discard it.
  return { id: created.id };
}

// v2.9.0: rename a section's title and/or subtitle. Moved verbatim
// from updateBookSection in book/actions.ts (which now delegates) so
// the AI apply path (book.section.update) can run it session-free.
// THE SLUG IS NEVER TOUCHED — it stays stable across renames so
// /book/<slug> links, bookmarks and sectionSlug references survive
// (v1.94.0 rule, preserved). Returns null when the section doesn't
// exist so the human wrapper can keep its exact
// { ok: false, error: "Section not found" } shape without a throw.
export async function updateBookSectionCore(
  user: SessionUser,
  id: string,
  input: { title: string; subtitle?: string | null },
): Promise<{ id: string; slug: string } | null> {
  const before = await db.bookSection.findUnique({ where: { id } });
  if (!before) return null;
  const subtitle =
    input.subtitle && input.subtitle.trim() ? input.subtitle.trim() : null;
  // v1.30.5 audit convention — record only the fields that actually
  // changed so the activity feed reads cleanly.
  const changedFields: string[] = [];
  if (before.title !== input.title) changedFields.push("title");
  if ((before.subtitle ?? null) !== subtitle) changedFields.push("subtitle");
  const updated = await db.bookSection.update({
    where: { id },
    data: { title: input.title, subtitle },
  });
  await logAudit({
    userId: user.id,
    action: "update",
    entity: "BookSection",
    entityId: id,
    metadata: {
      slug: updated.slug,
      changedFields,
      titleBefore: before.title,
      titleAfter: updated.title,
      subtitleBefore: before.subtitle,
      subtitleAfter: updated.subtitle,
    },
  });
  revalidatePath("/book");
  revalidatePath(`/book/${updated.slug}`);
  return { id: updated.id, slug: updated.slug };
}

// v1.26.0: kind-aware. Every new card seeds the per-kind structured
// data so the renderer never has to handle a missing relation.
export async function createBookSubsectionCore(
  user: SessionUser,
  formData: FormData,
): Promise<{ id: string }> {
  const parsed = subsectionSchema.parse({
    sectionId: formData.get("sectionId"),
    title: formData.get("title"),
    body: formData.get("body") || null,
    kind: formData.get("kind") ?? undefined,
  });
  // v1.94.2: auto-derive a slug from the title, disambiguating only
  // within the parent section (BookSubsection.slug is per-section, not
  // global).
  const baseSubSlug = slugify(parsed.title) || "page";
  const subSlug = await disambiguateSlug(baseSubSlug, async (candidate) => {
    const existing = await db.bookSubsection.findFirst({
      where: { sectionId: parsed.sectionId, slug: candidate },
      select: { id: true },
    });
    return existing !== null;
  });
  const last = await db.bookSubsection.findFirst({
    where: { sectionId: parsed.sectionId },
    orderBy: { order: "desc" },
  });
  const created = await db.bookSubsection.create({
    data: {
      sectionId: parsed.sectionId,
      slug: subSlug,
      title: parsed.title,
      body: parsed.body ?? null,
      kind: parsed.kind,
      order: (last?.order ?? -1) + 1,
    },
  });
  // Seed the per-kind child for non-TEXT kinds so the renderer always
  // has somewhere to read from.
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
    await db.bookBuildCard.create({ data: { subsectionId: created.id } });
  } else if (parsed.kind === BookSubsectionKind.MENU) {
    const menu = await db.bookMenuCard.create({ data: { subsectionId: created.id } });
    await db.bookMenuCourse.createMany({
      data: [
        { cardId: menu.id, courseLabel: "Starter", order: 0 },
        { cardId: menu.id, courseLabel: "Main", order: 1 },
        { cardId: menu.id, courseLabel: "Dessert", order: 2 },
      ],
    });
  } else if (parsed.kind === BookSubsectionKind.BAR) {
    await db.bookBarCard.create({ data: { subsectionId: created.id } });
  } else if (parsed.kind === BookSubsectionKind.SETUP) {
    await db.bookSetupCard.create({ data: { subsectionId: created.id } });
  } else if (parsed.kind === BookSubsectionKind.STAY) {
    await db.bookStayCard.create({ data: { subsectionId: created.id } });
  } else if (parsed.kind === BookSubsectionKind.LODGING_GUIDE) {
    await db.bookLodgingCard.create({ data: { subsectionId: created.id } });
  } else if (parsed.kind === BookSubsectionKind.DRESS_CODE) {
    await db.bookDressCodeCard.create({ data: { subsectionId: created.id } });
  } else if (parsed.kind === BookSubsectionKind.WEDDING_PARTY) {
    const card = await db.bookWeddingPartyCard.create({
      data: { subsectionId: created.id },
    });
    await db.bookWeddingPartyMember.create({
      data: { cardId: card.id, name: "Member 1", order: 0 },
    });
    await db.bookWeddingPartyItem.createMany({
      data: [
        { cardId: card.id, label: "Dress", order: 0 },
        { cardId: card.id, label: "Shoes", order: 1 },
        { cardId: card.id, label: "Accessories", order: 2 },
      ],
    });
  }
  // FIELD card seeds the value bag lazily.
  await logAudit({
    userId: user.id,
    action: "create",
    entity: "BookSubsection",
    entityId: created.id,
    metadata: { kind: parsed.kind },
  });
  revalidatePath("/book");
  const section = await db.bookSection.findUnique({ where: { id: parsed.sectionId } });
  if (section) revalidatePath(`/book/${section.slug}`);
  // v2.4.0: return the id so the AI proposal apply-bridge can link the
  // AiProposal to the row it just produced. Form callers discard it.
  return { id: created.id };
}

// ─── FIELD card ───────────────────────────────────────────────────

// Writes a single value into the BookSubsection.fields Json bag.
export async function setBookFieldValueCore(
  user: SessionUser,
  subsectionId: string,
  defId: string,
  rawValue: string | null,
): Promise<BookActionResult> {
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
    await logAudit({
      userId: user.id,
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

// ─── RECIPE card single-bulk-save ─────────────────────────────────

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

export async function saveRecipeCardCore(
  user: SessionUser,
  subsectionId: string,
  payload: RecipeSavePayload,
): Promise<BookActionResult> {
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

    await logAudit({
      userId: user.id,
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

// ─── SHOT_LIST card ───────────────────────────────────────────────

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

export async function addBookShotCore(
  user: SessionUser,
  shotListId: string,
  formData: FormData,
): Promise<BookActionResult> {
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
    await logAudit({
      userId: user.id,
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

export async function updateBookShotCore(
  user: SessionUser,
  id: string,
  formData: FormData,
): Promise<BookActionResult> {
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
    await logAudit({
      userId: user.id,
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

export async function toggleBookShotCapturedCore(
  user: SessionUser,
  id: string,
  captured: boolean,
): Promise<BookActionResult> {
  try {
    const updated = await db.bookShot.update({
      where: { id },
      data: { captured, capturedAt: captured ? new Date() : null },
      include: { shotList: true },
    });
    await logAudit({
      userId: user.id,
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

// ─── BUILD card single-bulk-save ──────────────────────────────────

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

export async function saveBuildCardCore(
  user: SessionUser,
  subsectionId: string,
  payload: BuildSavePayload,
): Promise<BookActionResult> {
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
      // payload to match the position in the array.
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

    await logAudit({
      userId: user.id,
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

// ─── MENU card single-bulk-save ───────────────────────────────────

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
  confirmedHeadcount: z.number().int().min(0).nullable(),
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

export async function saveMenuCardCore(
  user: SessionUser,
  subsectionId: string,
  payload: MenuSavePayload,
): Promise<BookActionResult> {
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

    await logAudit({
      userId: user.id,
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

// ─── BAR card single-bulk-save ────────────────────────────────────

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

export async function saveBarCardCore(
  user: SessionUser,
  subsectionId: string,
  payload: BarSavePayload,
): Promise<BookActionResult> {
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

    await logAudit({
      userId: user.id,
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

// ─── SETUP card single-bulk-save ──────────────────────────────────

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

export async function saveSetupCardCore(
  user: SessionUser,
  subsectionId: string,
  payload: SetupSavePayload,
): Promise<BookActionResult> {
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

    await logAudit({
      userId: user.id,
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

// ─── OUTFIT card single-bulk-save ─────────────────────────────────

const outfitItemPayloadSchema = z.object({
  id: z.string().min(1).max(50),
  itemLabel: z.string().min(1).max(160),
  description: z.string().max(2000).nullable(),
  supplier: z.string().max(120).nullable(),
  website: z.string().max(500).nullable(),
  status: z.string().max(40).nullable(),
  notes: z.string().max(2000).nullable(),
  costPence: z.number().int().min(0).nullable(),
});

const outfitSavePayloadSchema = z.object({
  personName: z.string().max(120).nullable(),
  role: z.string().max(60).nullable(),
  costPence: z.number().int().min(0).nullable(),
  fileIds: z.array(z.string().min(1).max(50)),
  notes: z.string().max(4000).nullable(),
  items: z.array(outfitItemPayloadSchema),
});

export type OutfitSavePayload = z.infer<typeof outfitSavePayloadSchema>;

export async function saveOutfitCardCore(
  user: SessionUser,
  subsectionId: string,
  payload: OutfitSavePayload,
): Promise<BookActionResult> {
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
    if (parsed.costPence !== before.costPence) headerChanged.push("costPence");
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
          costPence: parsed.costPence,
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
            // v1.93.1
            costPence: i.costPence,
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
            // v1.93.1
            costPence: i.costPence,
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

    await logAudit({
      userId: user.id,
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

// ─── STAY card single-bulk-save ───────────────────────────────────

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

export async function saveStayCardCore(
  user: SessionUser,
  subsectionId: string,
  payload: StaySavePayload,
): Promise<BookActionResult> {
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

    await logAudit({
      userId: user.id,
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

// ─── LODGING_GUIDE card single-bulk-save ──────────────────────────

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

export async function saveLodgingCardCore(
  user: SessionUser,
  subsectionId: string,
  payload: LodgingSavePayload,
): Promise<BookActionResult> {
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

    await logAudit({
      userId: user.id,
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

// ─── DRESS_CODE card single-bulk-save ─────────────────────────────

const dressCodeSavePayloadSchema = z.object({
  dressCode: z.string().max(120).nullable(),
  summary: z.string().max(600).nullable(),
  bodyHtml: z.string().max(20000).nullable(),
  colourGuidance: z.string().max(600).nullable(),
  footwear: z.string().max(600).nullable(),
  weather: z.string().max(600).nullable(),
  accessories: z.string().max(600).nullable(),
});

export type DressCodeSavePayload = z.infer<typeof dressCodeSavePayloadSchema>;

export async function saveDressCodeCardCore(
  user: SessionUser,
  subsectionId: string,
  payload: DressCodeSavePayload,
): Promise<BookActionResult> {
  try {
    const parsed = dressCodeSavePayloadSchema.parse(payload);
    const before = await db.bookDressCodeCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!before) return { ok: false, error: "Dress code card not found" };
    // Sanitise the rich-text body the same way TEXT-card body gets
    // sanitised so injected HTML can't leak through.
    const cleanedBody = parsed.bodyHtml ? sanitizeBookHtml(parsed.bodyHtml) : null;

    const changedFields: string[] = [];
    if (parsed.dressCode !== before.dressCode) changedFields.push("dressCode");
    if (parsed.summary !== before.summary) changedFields.push("summary");
    if ((cleanedBody || null) !== (before.bodyHtml || null)) changedFields.push("bodyHtml");
    if (parsed.colourGuidance !== before.colourGuidance) changedFields.push("colourGuidance");
    if (parsed.footwear !== before.footwear) changedFields.push("footwear");
    if (parsed.weather !== before.weather) changedFields.push("weather");
    if (parsed.accessories !== before.accessories) changedFields.push("accessories");

    await db.bookDressCodeCard.update({
      where: { subsectionId },
      data: {
        dressCode: parsed.dressCode,
        summary: parsed.summary,
        bodyHtml: cleanedBody,
        colourGuidance: parsed.colourGuidance,
        footwear: parsed.footwear,
        weather: parsed.weather,
        accessories: parsed.accessories,
      },
    });
    await logAudit({
      userId: user.id,
      action: "dress-code-save",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: before.subsection.title,
        dressCode: parsed.dressCode,
        changedFields,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save dress code card" };
  }
}

// ─── WEDDING_PARTY card ───────────────────────────────────────────
//
// memberSchema / itemSchema / VALID_CELL_STATUSES are exported because
// the non-extracted update* actions in book/actions.ts import them
// back — one source of truth.

const weddingPartyHeaderSchema = z.object({
  groupLabel: z.string().max(80).nullable(),
  notes: z.string().max(4000).nullable(),
});

export const memberSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(60).nullable().optional(),
});

export const itemSchema = z.object({
  label: z.string().min(1).max(160),
  notes: z.string().max(2000).nullable().optional(),
});

// v1.95.3: ORDERED inserted between NEED and HAVE — "we've placed
// the order but it isn't in our hands yet".
export const VALID_CELL_STATUSES = ["NEED", "ORDERED", "HAVE", "ALREADY_OWN", "N_A"] as const;
const cellSchema = z.object({
  status: z.enum(VALID_CELL_STATUSES),
  notes: z.string().max(2000).nullable().optional(),
});

export async function saveWeddingPartyCardHeaderCore(
  user: SessionUser,
  subsectionId: string,
  payload: { groupLabel: string | null; notes: string | null },
): Promise<BookActionResult> {
  try {
    const parsed = weddingPartyHeaderSchema.parse(payload);
    const before = await db.bookWeddingPartyCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!before) return { ok: false, error: "Wedding party card not found" };
    await db.bookWeddingPartyCard.update({
      where: { subsectionId },
      data: { groupLabel: parsed.groupLabel, notes: parsed.notes },
    });
    const changedFields: string[] = [];
    if (before.groupLabel !== parsed.groupLabel) changedFields.push("groupLabel");
    if (before.notes !== parsed.notes) changedFields.push("notes");
    await logAudit({
      userId: user.id,
      action: "wedding-party-header-save",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: before.subsection.title,
        groupLabel: parsed.groupLabel,
        changedFields,
      },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save" };
  }
}

export async function createWeddingPartyMemberCore(
  user: SessionUser,
  cardId: string,
  payload: { name: string; role?: string | null },
): Promise<BookActionResult & { memberId?: string }> {
  try {
    const parsed = memberSchema.parse(payload);
    const card = await db.bookWeddingPartyCard.findUnique({
      where: { id: cardId },
      include: { subsection: true, _count: { select: { members: true } } },
    });
    if (!card) return { ok: false, error: "Card not found" };
    const created = await db.bookWeddingPartyMember.create({
      data: {
        cardId,
        name: parsed.name,
        role: parsed.role ?? null,
        order: card._count.members,
      },
    });
    await logAudit({
      userId: user.id,
      action: "wedding-party-member-create",
      entity: "BookSubsection",
      entityId: card.subsectionId,
      metadata: { cardTitle: card.subsection.title, memberName: parsed.name },
    });
    await revalidateBookSubsection(card.subsectionId);
    return { ok: true, memberId: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't add member" };
  }
}

export async function createWeddingPartyItemCore(
  user: SessionUser,
  cardId: string,
  payload: { label: string; notes?: string | null },
): Promise<BookActionResult & { itemId?: string }> {
  try {
    const parsed = itemSchema.parse(payload);
    const card = await db.bookWeddingPartyCard.findUnique({
      where: { id: cardId },
      include: { subsection: true, _count: { select: { items: true } } },
    });
    if (!card) return { ok: false, error: "Card not found" };
    const created = await db.bookWeddingPartyItem.create({
      data: {
        cardId,
        label: parsed.label,
        notes: parsed.notes ?? null,
        order: card._count.items,
      },
    });
    await logAudit({
      userId: user.id,
      action: "wedding-party-item-create",
      entity: "BookSubsection",
      entityId: card.subsectionId,
      metadata: { cardTitle: card.subsection.title, itemLabel: parsed.label },
    });
    await revalidateBookSubsection(card.subsectionId);
    return { ok: true, itemId: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't add item" };
  }
}

export async function setWeddingPartyCellCore(
  user: SessionUser,
  memberId: string,
  itemId: string,
  payload: { status: typeof VALID_CELL_STATUSES[number]; notes?: string | null },
): Promise<BookActionResult> {
  try {
    const parsed = cellSchema.parse(payload);
    // Resolve subsection for revalidate path. memberId + itemId must
    // belong to the same card; we don't enforce that here (the UI
    // never crosses cards) but the unique constraint catches dupes.
    const member = await db.bookWeddingPartyMember.findUnique({
      where: { id: memberId },
      include: { card: { include: { subsection: true } } },
    });
    if (!member) return { ok: false, error: "Member not found" };
    const trimmedNotes = parsed.notes?.trim() || null;
    // Sparse storage convention: NEED + no notes ⇒ delete the row.
    if (parsed.status === "NEED" && !trimmedNotes) {
      await db.bookWeddingPartyCell.deleteMany({
        where: { memberId, itemId },
      });
    } else {
      await db.bookWeddingPartyCell.upsert({
        where: { memberId_itemId: { memberId, itemId } },
        update: { status: parsed.status, notes: trimmedNotes },
        create: { memberId, itemId, status: parsed.status, notes: trimmedNotes },
      });
    }
    await logAudit({
      userId: user.id,
      action: "wedding-party-cell-set",
      entity: "BookSubsection",
      entityId: member.card.subsectionId,
      metadata: {
        cardTitle: member.card.subsection.title,
        memberName: member.name,
        status: parsed.status,
      },
    });
    await revalidateBookSubsection(member.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't set cell" };
  }
}
