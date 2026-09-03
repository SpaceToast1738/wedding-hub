"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BookSubsectionVisibility, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
// v2.8.0: the write halves of every book card save/create/shot/field/
// wedding-party action moved to src/lib/core/book.ts so the MCP
// self-apply path can run them session-free. These "use server"
// functions keep the FormData/args parse + the requireEdit auth gate,
// then delegate to the matching *Core. Human behaviour is unchanged.
import {
  updateBookSubsectionCore,
  createBookSectionCore,
  updateBookSectionCore,
  createBookSubsectionCore,
  setBookFieldValueCore,
  saveRecipeCardCore,
  addBookShotCore,
  updateBookShotCore,
  toggleBookShotCapturedCore,
  saveBuildCardCore,
  saveMenuCardCore,
  saveBarCardCore,
  saveSetupCardCore,
  saveRunsheetCardCore,
  saveOutfitCardCore,
  saveStayCardCore,
  saveLodgingCardCore,
  saveDressCodeCardCore,
  saveWeddingPartyCardHeaderCore,
  createWeddingPartyMemberCore,
  createWeddingPartyItemCore,
  setWeddingPartyCellCore,
  revalidateBookSubsection,
  memberSchema,
  itemSchema,
  VALID_CELL_STATUSES,
  // Payload types imported into local scope so the "use server" wrapper
  // signatures below (saveRecipeCard(payload: RecipeSavePayload) …) can
  // annotate their params.
  type RecipeSavePayload,
  type BuildSavePayload,
  type MenuSavePayload,
  type BarSavePayload,
  type SetupSavePayload,
  type RunsheetSavePayload,
  type OutfitSavePayload,
  type StaySavePayload,
  type LodgingSavePayload,
  type DressCodeSavePayload,
} from "@/lib/core/book";
// v2.8.0: payload types re-exported so the card editor components
// (BookOutfitCard.tsx etc.) keep importing them from this module
// unchanged, even though the schemas now live in the session-free core.
export type {
  RecipeSavePayload,
  BuildSavePayload,
  MenuSavePayload,
  BarSavePayload,
  SetupSavePayload,
  RunsheetSavePayload,
  OutfitSavePayload,
  StaySavePayload,
  LodgingSavePayload,
  DressCodeSavePayload,
};
import {
  validateOutfit,
  validateRecipe,
  type BookOutfitShape,
  type BookRecipeShape,
} from "@/lib/book-cards";
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

// v1.94.0: section rename + subtitle edit. Title kept editable
// because the existing /book overview only supported creation —
// couples had no way to rename a section after typo / re-scope.
const sectionUpdateSchema = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(240).optional().nullable(),
});

// v2.8.0: parse + auth + delegate. The write half (slug derivation,
// db write, audit, revalidate) lives in createBookSectionCore.
export async function createBookSection(formData: FormData): Promise<{ id: string }> {
  const user = await requireEdit("book");
  return createBookSectionCore(user, formData);
}

// v1.94.0: edit title + subtitle on an existing section. Slug stays
// stable (URLs are public-shareable + couple's bookmark / muscle
// memory survives a rename). Couple can only edit via /book/[slug]
// header → EditSectionToggle modal.
// v2.9.0: parse + auth + delegate — the write half (changed-fields
// audit, revalidates, slug-stability rule) lives in
// updateBookSectionCore so the AI apply path (book.section.update)
// shares it session-free. Behaviour is byte-identical.
export async function updateBookSection(
  id: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  let parsed: z.infer<typeof sectionUpdateSchema>;
  try {
    parsed = sectionUpdateSchema.parse({
      title: formData.get("title"),
      subtitle: formData.get("subtitle"),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof z.ZodError ? err.errors[0]?.message ?? "Invalid input" : "Invalid input",
    };
  }
  const updated = await updateBookSectionCore(user, id, {
    title: parsed.title,
    subtitle: parsed.subtitle ?? null,
  });
  if (!updated) return { ok: false, error: "Section not found" };
  return { ok: true };
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
// v2.8.0: parse + auth + delegate — the kind-aware seed + audit +
// revalidate live in createBookSubsectionCore.
export async function createBookSubsection(formData: FormData): Promise<{ id: string }> {
  const user = await requireEdit("book");
  return createBookSubsectionCore(user, formData);
}

// v2.8.0: parse + auth + delegate. The write half (sanitisation,
// changedFields audit, revalidates) moved to updateBookSubsectionCore
// in src/lib/core/book.ts so the MCP self-apply path can run it
// session-free with an explicit user. Body fields keep their
// tri-state: a field absent from the FormData is left off the input
// entirely (core leaves the column untouched), matching the
// pre-extraction `formData.get(x) !== null` branches byte-for-byte.
export async function updateBookSubsection(id: string, formData: FormData) {
  const user = await requireEdit("book");
  const rawBodyHtml = formData.get("bodyHtml");
  const rawBody = formData.get("body");
  await updateBookSubsectionCore(user, id, {
    title: String(formData.get("title") ?? ""),
    ...(rawBodyHtml !== null ? { bodyHtml: String(rawBodyHtml) } : {}),
    ...(rawBody !== null ? { body: String(rawBody) } : {}),
  });
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

// v1.95.0: per-card width on the section page's two-column grid.
// `false` = single column; `true` = spans both columns. No couple-tier
// gate — layout is purely cosmetic and any book-editor should be able
// to flip it (same access tier as reorder).
export async function setBookSubsectionWide(
  id: string,
  wide: boolean,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  const before = await db.bookSubsection.findUnique({
    where: { id },
    select: { wide: true, title: true, section: { select: { slug: true } } },
  });
  if (!before) return { ok: false, error: "Card not found" };
  if (before.wide === wide) return { ok: true }; // no-op
  await db.bookSubsection.update({ where: { id }, data: { wide } });
  await audit(user, {
    action: "update",
    entity: "BookSubsection",
    entityId: id,
    metadata: {
      changedFields: ["wide"],
      title: before.title,
      wideBefore: before.wide,
      wideAfter: wide,
    },
  });
  revalidatePath(`/book/${before.section.slug}`);
  return { ok: true };
}

// v1.96.4: per-card photo gallery size. Sibling to setBookSubsectionWide
// — same access tier (book-edit, no couple gate), same audit shape,
// same idempotent no-op guard. Surfaces as a S/M/L toggle in
// <ImageGallery> when the parent card wires it up.
// v1.98.1: extended from 3 buckets to 5 — xs + xl added at the
// extremes for the "wall of reference shots" and "one prominent hero
// in gallery mode" cases respectively.
const PHOTO_SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
type PhotoSize = (typeof PHOTO_SIZES)[number];

export async function setBookSubsectionPhotoSize(
  id: string,
  size: PhotoSize,
): Promise<BookActionResult> {
  if (!PHOTO_SIZES.includes(size)) {
    return { ok: false, error: "Invalid size" };
  }
  const user = await requireEdit("book");
  const before = await db.bookSubsection.findUnique({
    where: { id },
    select: { photoSize: true, title: true, section: { select: { slug: true } } },
  });
  if (!before) return { ok: false, error: "Card not found" };
  if (before.photoSize === size) return { ok: true }; // no-op
  await db.bookSubsection.update({ where: { id }, data: { photoSize: size } });
  await audit(user, {
    action: "update",
    entity: "BookSubsection",
    entityId: id,
    metadata: {
      changedFields: ["photoSize"],
      title: before.title,
      photoSizeBefore: before.photoSize,
      photoSizeAfter: size,
    },
  });
  revalidatePath(`/book/${before.section.slug}`);
  return { ok: true };
}

// v1.97.0: photo display mode.
// v1.99.4: dropped "header" — header is now additive, controlled by
// headerFileId being non-null, not a body display mode. Added "mosaic"
// (Pinterest-style masonry). Sibling of setBookSubsectionPhotoSize;
// same book-edit gate, audit shape, idempotent no-op guard.
const PHOTO_DISPLAYS = ["gallery", "slideshow", "mosaic"] as const;
type PhotoDisplay = (typeof PHOTO_DISPLAYS)[number];

export async function setBookSubsectionPhotoDisplay(
  id: string,
  display: PhotoDisplay,
): Promise<BookActionResult> {
  if (!PHOTO_DISPLAYS.includes(display)) {
    return { ok: false, error: "Invalid display mode" };
  }
  const user = await requireEdit("book");
  const before = await db.bookSubsection.findUnique({
    where: { id },
    select: { photoDisplay: true, title: true, section: { select: { slug: true } } },
  });
  if (!before) return { ok: false, error: "Card not found" };
  if (before.photoDisplay === display) return { ok: true };
  await db.bookSubsection.update({ where: { id }, data: { photoDisplay: display } });
  await audit(user, {
    action: "update",
    entity: "BookSubsection",
    entityId: id,
    metadata: {
      changedFields: ["photoDisplay"],
      title: before.title,
      photoDisplayBefore: before.photoDisplay,
      photoDisplayAfter: display,
    },
  });
  revalidatePath(`/book/${before.section.slug}`);
  return { ok: true };
}

// v1.97.0: pin one of the card's attached photos as the hero shown in
// `header` display mode. Pass null to unpin (returns the card to the
// "Pick a header image" placeholder). Validates that the fileId is
// actually attached to this card — covers both the BookSubsection
// fileIds column (TEXT cards, v1.96.1) AND any per-kind fileIds the
// caller-side card data carries (OUTFIT / DRESS_CODE / SETUP / BUILD
// / STAY / LODGING_GUIDE all have their own fileIds arrays). We
// gather the union here so a pinned header can't dangle.
export async function setBookSubsectionHeaderFileId(
  id: string,
  fileId: string | null,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  const before = await db.bookSubsection.findUnique({
    where: { id },
    select: {
      headerFileId: true,
      title: true,
      fileIds: true,
      section: { select: { slug: true } },
      // LodgingCard intentionally omitted — no fileIds column. The
      // map / image data on lodging lives elsewhere and doesn't
      // participate in the gallery.
      outfitCard: { select: { fileIds: true } },
      dressCodeCard: { select: { fileIds: true } },
      setupCard: { select: { fileIds: true } },
      buildCard: { select: { fileIds: true } },
      stayCard: { select: { fileIds: true } },
    },
  });
  if (!before) return { ok: false, error: "Card not found" };
  if (fileId != null) {
    const attached = new Set<string>([
      ...before.fileIds,
      ...(before.outfitCard?.fileIds ?? []),
      ...(before.dressCodeCard?.fileIds ?? []),
      ...(before.setupCard?.fileIds ?? []),
      ...(before.buildCard?.fileIds ?? []),
      ...(before.stayCard?.fileIds ?? []),
    ]);
    if (!attached.has(fileId)) {
      return { ok: false, error: "That photo isn't attached to this card" };
    }
  }
  if (before.headerFileId === fileId) return { ok: true };
  await db.bookSubsection.update({ where: { id }, data: { headerFileId: fileId } });
  await audit(user, {
    action: "update",
    entity: "BookSubsection",
    entityId: id,
    metadata: {
      changedFields: ["headerFileId"],
      title: before.title,
      headerFileIdBefore: before.headerFileId,
      headerFileIdAfter: fileId,
    },
  });
  revalidatePath(`/book/${before.section.slug}`);
  return { ok: true };
}

// v1.97.0: per-card slideshow auto-advance toggle. Only consulted when
// photoDisplay = 'slideshow'. Layout-cosmetic so no couple-tier gate
// — same access tier as setBookSubsectionPhotoSize / -Display.
export async function setBookSubsectionSlideshowAuto(
  id: string,
  auto: boolean,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  const before = await db.bookSubsection.findUnique({
    where: { id },
    select: { slideshowAuto: true, title: true, section: { select: { slug: true } } },
  });
  if (!before) return { ok: false, error: "Card not found" };
  if (before.slideshowAuto === auto) return { ok: true };
  await db.bookSubsection.update({ where: { id }, data: { slideshowAuto: auto } });
  await audit(user, {
    action: "update",
    entity: "BookSubsection",
    entityId: id,
    metadata: {
      changedFields: ["slideshowAuto"],
      title: before.title,
      slideshowAutoBefore: before.slideshowAuto,
      slideshowAutoAfter: auto,
    },
  });
  revalidatePath(`/book/${before.section.slug}`);
  return { ok: true };
}

// v1.99.4: 9-point header positioning. Maps to CSS object-position
// at render time. Sibling of setBookSubsectionPhotoSize / -Display /
// -SlideshowAuto — same book-edit gate, audit shape, idempotent
// no-op guard.
const HEADER_POSITIONS = [
  "tl", "t", "tr",
  "l",  "c", "r",
  "bl", "b", "br",
] as const;
type HeaderPosition = (typeof HEADER_POSITIONS)[number];

export async function setBookSubsectionHeaderPosition(
  id: string,
  position: HeaderPosition,
): Promise<BookActionResult> {
  if (!HEADER_POSITIONS.includes(position)) {
    return { ok: false, error: "Invalid header position" };
  }
  const user = await requireEdit("book");
  const before = await db.bookSubsection.findUnique({
    where: { id },
    select: { headerPosition: true, title: true, section: { select: { slug: true } } },
  });
  if (!before) return { ok: false, error: "Card not found" };
  if (before.headerPosition === position) return { ok: true }; // no-op
  await db.bookSubsection.update({ where: { id }, data: { headerPosition: position } });
  await audit(user, {
    action: "update",
    entity: "BookSubsection",
    entityId: id,
    metadata: {
      changedFields: ["headerPosition"],
      title: before.title,
      headerPositionBefore: before.headerPosition,
      headerPositionAfter: position,
    },
  });
  revalidatePath(`/book/${before.section.slug}`);
  return { ok: true };
}

// v1.99.0: per-card body component reorder. Stored as an ordered
// array of component IDs on BookSubsection.componentOrder. Empty =
// "use the kind's default order". The renderer is permissive about
// stale / unknown IDs (it ignores them), so adding new components to
// a kind in a future release doesn't require migrating saved orders.
//
// Light validation only — the per-kind component registry is a client
// concern, so the server doesn't whitelist IDs. Just enforces array
// length + string shape to keep the column tidy.
export async function setBookSubsectionComponentOrder(
  id: string,
  order: string[],
): Promise<BookActionResult> {
  if (!Array.isArray(order) || order.length > 50) {
    return { ok: false, error: "Invalid order" };
  }
  for (const v of order) {
    if (typeof v !== "string" || v.length === 0 || v.length > 60) {
      return { ok: false, error: "Invalid component id" };
    }
  }
  const user = await requireEdit("book");
  const before = await db.bookSubsection.findUnique({
    where: { id },
    select: { componentOrder: true, title: true, section: { select: { slug: true } } },
  });
  if (!before) return { ok: false, error: "Card not found" };
  if (
    before.componentOrder.length === order.length &&
    before.componentOrder.every((v, i) => v === order[i])
  ) {
    return { ok: true }; // no-op
  }
  await db.bookSubsection.update({ where: { id }, data: { componentOrder: order } });
  await audit(user, {
    action: "update",
    entity: "BookSubsection",
    entityId: id,
    metadata: {
      changedFields: ["componentOrder"],
      title: before.title,
      componentOrderBefore: before.componentOrder,
      componentOrderAfter: order,
    },
  });
  revalidatePath(`/book/${before.section.slug}`);
  return { ok: true };
}

// v1.99.0: toggle a single component's visibility on a card. The set
// of hidden IDs lives in BookSubsection.hiddenComponents — adding /
// removing one entry at a time keeps the action surface small. The
// renderer has a per-kind `alwaysVisible` guard for components that
// shouldn't be hidden (e.g. WEDDING_PARTY's matrix); this action
// doesn't enforce that because the guard lives in the per-kind
// registry, which the server doesn't see.
export async function setBookSubsectionComponentHidden(
  id: string,
  componentId: string,
  hidden: boolean,
): Promise<BookActionResult> {
  if (typeof componentId !== "string" || !componentId || componentId.length > 60) {
    return { ok: false, error: "Invalid component id" };
  }
  const user = await requireEdit("book");
  const before = await db.bookSubsection.findUnique({
    where: { id },
    select: { hiddenComponents: true, title: true, section: { select: { slug: true } } },
  });
  if (!before) return { ok: false, error: "Card not found" };
  const has = before.hiddenComponents.includes(componentId);
  if (hidden === has) return { ok: true }; // no-op
  const next = hidden
    ? [...before.hiddenComponents, componentId]
    : before.hiddenComponents.filter((c) => c !== componentId);
  await db.bookSubsection.update({ where: { id }, data: { hiddenComponents: next } });
  await audit(user, {
    action: "update",
    entity: "BookSubsection",
    entityId: id,
    metadata: {
      changedFields: ["hiddenComponents"],
      title: before.title,
      componentId,
      hiddenBefore: has,
      hiddenAfter: hidden,
    },
  });
  revalidatePath(`/book/${before.section.slug}`);
  return { ok: true };
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

// v2.8.0: revalidateBookSubsection moved to src/lib/core/book.ts
// (imported back above) so the extracted cores and the actions still
// here share one implementation.

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
// v2.8.0: auth + delegate — validation/write/audit in setBookFieldValueCore.
export async function setBookFieldValue(
  subsectionId: string,
  defId: string,
  rawValue: string | null,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return setBookFieldValueCore(user, subsectionId, defId, rawValue);
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

// v2.8.0: schemas + write half moved to saveRecipeCardCore in
// src/lib/core/book.ts (RecipeSavePayload re-exported from there at
// the top of this file, so the editor component's import is unchanged).
// This wrapper keeps the requireEdit auth gate then delegates.
export async function saveRecipeCard(
  subsectionId: string,
  payload: RecipeSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return saveRecipeCardCore(user, subsectionId, payload);
}

// ─── v1.26.0 — SHOT_LIST card actions ─────────────────────────────

// v2.8.0: parseShotFormData + the write halves moved to
// addBookShotCore / updateBookShotCore / toggleBookShotCapturedCore in
// src/lib/core/book.ts. These wrappers keep the requireEdit auth gate
// and forward the raw FormData / args to the core (the core owns the
// shot-form parse + validateShot).
export async function addBookShot(
  shotListId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return addBookShotCore(user, shotListId, formData);
}

export async function updateBookShot(
  id: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return updateBookShotCore(user, id, formData);
}

export async function toggleBookShotCaptured(
  id: string,
  captured: boolean,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return toggleBookShotCapturedCore(user, id, captured);
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

// v2.8.0: parseISODate removed here — its only caller (saveStayCard)
// now delegates to saveStayCardCore in src/lib/core/book.ts, which
// owns the ISO-date parse.

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

// v2.8.0: syncBudgetLine removed here — the card save actions that
// used it now delegate to their *Core in src/lib/core/book.ts, which
// owns the post-save BudgetLine resync. The link/unlink actions below
// do their own one-off line writes inline.

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

// v2.8.0: schemas + write half moved to saveBuildCardCore in
// src/lib/core/book.ts (BuildSavePayload re-exported at the top of
// this file). This wrapper keeps the requireEdit auth gate.
export async function saveBuildCard(
  subsectionId: string,
  payload: BuildSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return saveBuildCardCore(user, subsectionId, payload);
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

// v2.8.0: schemas + write half moved to saveMenuCardCore in
// src/lib/core/book.ts (MenuSavePayload re-exported at the top of this
// file). This wrapper keeps the requireEdit auth gate.
export async function saveMenuCard(
  subsectionId: string,
  payload: MenuSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return saveMenuCardCore(user, subsectionId, payload);
}

// ── v1.32.0: BAR card actions ──────────────────────────────────────

// v2.8.0: schemas + write half moved to saveBarCardCore in
// src/lib/core/book.ts (BarSavePayload re-exported at the top of this
// file). This wrapper keeps the requireEdit auth gate.
export async function saveBarCard(
  subsectionId: string,
  payload: BarSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return saveBarCardCore(user, subsectionId, payload);
}

// ── v1.33.0: SETUP card actions ────────────────────────────────────
//
// Same single-bulk-save shape as BUILD / MENU / BAR. Header fields
// + items reconciled in a transaction. Audit metadata enriched per
// the v1.30.5 standing rule.

// v2.8.0: schemas + write half moved to saveSetupCardCore in
// src/lib/core/book.ts (SetupSavePayload re-exported at the top of this
// file). This wrapper keeps the requireEdit auth gate.
export async function saveSetupCard(
  subsectionId: string,
  payload: SetupSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return saveSetupCardCore(user, subsectionId, payload);
}

// v2.16.0: RUNSHEET card — thin gate over saveRunsheetCardCore.
export async function saveRunsheetCard(
  subsectionId: string,
  payload: RunsheetSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return saveRunsheetCardCore(user, subsectionId, payload);
}


// ── v1.35.0: OUTFIT card actions (rework) ──────────────────────────
//
// Same single-bulk-save shape as BUILD / MENU / BAR / SETUP.
// Card-level fields hold the per-person identity + fitting timeline +
// cost; items are per-item composition (dress / shoes / etc.).
//
// Legacy addBookOutfit / updateBookOutfit / deleteBookOutfit kept in
// place above — they still write to the row table, so older callers
// don't break. New editor uses saveOutfitCard exclusively.

// v2.8.0: schemas + write half moved to saveOutfitCardCore in
// src/lib/core/book.ts (OutfitSavePayload re-exported at the top of
// this file). This wrapper keeps the requireEdit auth gate.
export async function saveOutfitCard(
  subsectionId: string,
  payload: OutfitSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return saveOutfitCardCore(user, subsectionId, payload);
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

// v2.8.0: schema + write half moved to saveStayCardCore in
// src/lib/core/book.ts (StaySavePayload re-exported at the top of this
// file). This wrapper keeps the requireEdit auth gate.
export async function saveStayCard(
  subsectionId: string,
  payload: StaySavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return saveStayCardCore(user, subsectionId, payload);
}

// ── v1.36.0 (P6): LODGING_GUIDE card actions ────────────────────────
//
// One card with rows for recommended hotels. Single-bulk-save with
// child reconcile (id starts "new-" → create; missing from payload
// → delete; existing → update). Items have no tracked-state, so
// nothing to flag here.

// v2.8.0: schemas + write half moved to saveLodgingCardCore in
// src/lib/core/book.ts (LodgingSavePayload re-exported at the top of
// this file). This wrapper keeps the requireEdit auth gate.
export async function saveLodgingCard(
  subsectionId: string,
  payload: LodgingSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return saveLodgingCardCore(user, subsectionId, payload);
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

// ─── v1.96.1: TEXT card photo gallery ──────────────────────────────
//
// TEXT cards' body content lives directly on BookSubsection (body /
// bodyHtml). Photos use the new BookSubsection.fileIds[] column —
// mirrors the OUTFIT / DRESS_CODE / SETUP triple-action pattern
// (attach existing / detach / upload-and-attach) so the shared
// <ImageGallery> component drops in unchanged on the editor.
//
// No kind-check inside these actions — `requireEdit("book")` already
// gates write access, and the schema column lives on every
// BookSubsection regardless of kind. Surfacing it in the UI is
// TEXT-only.

export async function attachFileToTextCard(
  subsectionId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const sub = await db.bookSubsection.findUnique({
      where: { id: subsectionId },
      select: { title: true, fileIds: true },
    });
    if (!sub) return { ok: false, error: "Page not found" };
    const file = await db.file.findUnique({ where: { id: fileId } });
    if (!file) return { ok: false, error: "File not found" };
    if (sub.fileIds.includes(fileId)) return { ok: true };
    await db.bookSubsection.update({
      where: { id: subsectionId },
      data: { fileIds: [...sub.fileIds, fileId] },
    });
    await audit(user, {
      action: "text-file-attach",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: { cardTitle: sub.title, fileId, fileName: file.name },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't attach file" };
  }
}

export async function detachFileFromTextCard(
  subsectionId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const sub = await db.bookSubsection.findUnique({
      where: { id: subsectionId },
      select: { title: true, fileIds: true },
    });
    if (!sub) return { ok: false, error: "Page not found" };
    if (!sub.fileIds.includes(fileId)) return { ok: true };
    const file = await db.file.findUnique({ where: { id: fileId } });
    await db.bookSubsection.update({
      where: { id: subsectionId },
      data: { fileIds: sub.fileIds.filter((id) => id !== fileId) },
    });
    await audit(user, {
      action: "text-file-detach",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: { cardTitle: sub.title, fileId, fileName: file?.name ?? null },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't detach file" };
  }
}

export async function uploadAndAttachTextFile(
  subsectionId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const sub = await db.bookSubsection.findUnique({
      where: { id: subsectionId },
      select: { title: true, fileIds: true },
    });
    if (!sub) return { ok: false, error: "Page not found" };
    const formFile = formData.get("file");
    if (!(formFile instanceof File) || formFile.size === 0) {
      return { ok: false, error: "No file received." };
    }
    const file = await uploadFileForBookCard(user, formFile);
    await db.bookSubsection.update({
      where: { id: subsectionId },
      data: { fileIds: [...sub.fileIds, file.id] },
    });
    await audit(user, {
      action: "text-file-upload",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: { cardTitle: sub.title, fileId: file.id, fileName: file.name },
    });
    await revalidateBookSubsection(subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't upload" };
  }
}

// ─── v1.91.0: DRESS_CODE card ─────────────────────────────────────
//
// Single-row card (mirrors BookSetupCard shape — no item children).
// Save payload covers the structured fields + the rich-text bodyHtml
// + the image gallery's `fileIds`. Three file actions follow the
// SETUP / BUILD / STAY pattern (upload-from-device, attach-existing,
// detach). Couple-internal; no public surface yet.

// v2.8.0: schema + write half (incl. sanitizeBookHtml on bodyHtml)
// moved to saveDressCodeCardCore in src/lib/core/book.ts
// (DressCodeSavePayload re-exported at the top of this file). This
// wrapper keeps the requireEdit auth gate.
export async function saveDressCodeCard(
  subsectionId: string,
  payload: DressCodeSavePayload,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return saveDressCodeCardCore(user, subsectionId, payload);
}

export async function uploadAndAttachDressCodeFile(
  subsectionId: string,
  formData: FormData,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookDressCodeCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Dress code card not found" };
    const formFile = formData.get("file");
    if (!(formFile instanceof File) || formFile.size === 0) {
      return { ok: false, error: "No file received." };
    }
    const file = await uploadFileForBookCard(user, formFile);
    const next = [...card.fileIds, file.id];
    await db.bookDressCodeCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "dress-code-file-upload",
      entity: "BookSubsection",
      entityId: subsectionId,
      metadata: {
        cardTitle: card.subsection.title,
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

export async function attachFileToDressCodeCard(
  subsectionId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookDressCodeCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Dress code card not found" };
    const file = await db.file.findUnique({ where: { id: fileId } });
    if (!file) return { ok: false, error: "File not found" };
    if (card.fileIds.includes(fileId)) return { ok: true };
    const next = [...card.fileIds, fileId];
    await db.bookDressCodeCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "dress-code-file-attach",
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

export async function detachFileFromDressCodeCard(
  subsectionId: string,
  fileId: string,
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookDressCodeCard.findUnique({
      where: { subsectionId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Dress code card not found" };
    if (!card.fileIds.includes(fileId)) return { ok: true };
    const file = await db.file.findUnique({ where: { id: fileId } });
    const next = card.fileIds.filter((id) => id !== fileId);
    await db.bookDressCodeCard.update({
      where: { subsectionId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "dress-code-file-detach",
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

// ─── v1.92.0: WEDDING_PARTY card ──────────────────────────────────
//
// Matrix tracker (items × people). Cells are sparse — a cell row
// only exists when the user has set status away from the default
// NEED. setWeddingPartyCell upserts on the unique (memberId,
// itemId) index; when status reverts to NEED with no notes, the
// cell row is deleted to keep the table small.

// v2.8.0: schema + write half moved to saveWeddingPartyCardHeaderCore
// in src/lib/core/book.ts. This wrapper keeps the requireEdit gate.
export async function saveWeddingPartyCardHeader(
  subsectionId: string,
  payload: { groupLabel: string | null; notes: string | null },
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return saveWeddingPartyCardHeaderCore(user, subsectionId, payload);
}

// v2.8.0: memberSchema moved to src/lib/core/book.ts (imported back at
// the top of this file — updateWeddingPartyMember below still uses it).
// createWeddingPartyMember's write half is now createWeddingPartyMemberCore.
export async function createWeddingPartyMember(
  cardId: string,
  payload: { name: string; role?: string | null },
): Promise<BookActionResult & { memberId?: string }> {
  const user = await requireEdit("book");
  return createWeddingPartyMemberCore(user, cardId, payload);
}

export async function updateWeddingPartyMember(
  id: string,
  payload: { name: string; role?: string | null },
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = memberSchema.parse(payload);
    const before = await db.bookWeddingPartyMember.findUnique({
      where: { id },
      include: { card: { include: { subsection: true } } },
    });
    if (!before) return { ok: false, error: "Member not found" };
    await db.bookWeddingPartyMember.update({
      where: { id },
      data: { name: parsed.name, role: parsed.role ?? null },
    });
    await audit(user, {
      action: "wedding-party-member-update",
      entity: "BookSubsection",
      entityId: before.card.subsectionId,
      metadata: {
        cardTitle: before.card.subsection.title,
        priorName: before.name,
        name: parsed.name,
      },
    });
    await revalidateBookSubsection(before.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't update" };
  }
}

export async function deleteWeddingPartyMember(id: string): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const before = await db.bookWeddingPartyMember.findUnique({
      where: { id },
      include: { card: { include: { subsection: true } } },
    });
    if (!before) return { ok: false, error: "Member not found" };
    await db.bookWeddingPartyMember.delete({ where: { id } });
    await audit(user, {
      action: "wedding-party-member-delete",
      entity: "BookSubsection",
      entityId: before.card.subsectionId,
      metadata: { cardTitle: before.card.subsection.title, name: before.name },
    });
    await revalidateBookSubsection(before.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't delete" };
  }
}

export async function reorderWeddingPartyMembers(
  cardId: string,
  orderedIds: string[],
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookWeddingPartyCard.findUnique({
      where: { id: cardId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Card not found" };
    await db.$transaction(
      orderedIds.map((id, idx) =>
        db.bookWeddingPartyMember.update({ where: { id }, data: { order: idx } }),
      ),
    );
    await audit(user, {
      action: "wedding-party-member-reorder",
      entity: "BookSubsection",
      entityId: card.subsectionId,
      metadata: { cardTitle: card.subsection.title, count: orderedIds.length },
    });
    await revalidateBookSubsection(card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reorder" };
  }
}

// v2.8.0: itemSchema moved to src/lib/core/book.ts (imported back at
// the top of this file — updateWeddingPartyItem below still uses it).
// createWeddingPartyItem's write half is now createWeddingPartyItemCore.
export async function createWeddingPartyItem(
  cardId: string,
  payload: { label: string; notes?: string | null },
): Promise<BookActionResult & { itemId?: string }> {
  const user = await requireEdit("book");
  return createWeddingPartyItemCore(user, cardId, payload);
}

export async function updateWeddingPartyItem(
  id: string,
  payload: { label: string; notes?: string | null },
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const parsed = itemSchema.parse(payload);
    const before = await db.bookWeddingPartyItem.findUnique({
      where: { id },
      include: { card: { include: { subsection: true } } },
    });
    if (!before) return { ok: false, error: "Item not found" };
    await db.bookWeddingPartyItem.update({
      where: { id },
      data: { label: parsed.label, notes: parsed.notes ?? null },
    });
    await audit(user, {
      action: "wedding-party-item-update",
      entity: "BookSubsection",
      entityId: before.card.subsectionId,
      metadata: {
        cardTitle: before.card.subsection.title,
        priorLabel: before.label,
        label: parsed.label,
      },
    });
    await revalidateBookSubsection(before.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't update" };
  }
}

export async function deleteWeddingPartyItem(id: string): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const before = await db.bookWeddingPartyItem.findUnique({
      where: { id },
      include: { card: { include: { subsection: true } } },
    });
    if (!before) return { ok: false, error: "Item not found" };
    await db.bookWeddingPartyItem.delete({ where: { id } });
    await audit(user, {
      action: "wedding-party-item-delete",
      entity: "BookSubsection",
      entityId: before.card.subsectionId,
      metadata: { cardTitle: before.card.subsection.title, label: before.label },
    });
    await revalidateBookSubsection(before.card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't delete" };
  }
}

export async function reorderWeddingPartyItems(
  cardId: string,
  orderedIds: string[],
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  try {
    const card = await db.bookWeddingPartyCard.findUnique({
      where: { id: cardId },
      include: { subsection: true },
    });
    if (!card) return { ok: false, error: "Card not found" };
    await db.$transaction(
      orderedIds.map((id, idx) =>
        db.bookWeddingPartyItem.update({ where: { id }, data: { order: idx } }),
      ),
    );
    await audit(user, {
      action: "wedding-party-item-reorder",
      entity: "BookSubsection",
      entityId: card.subsectionId,
      metadata: { cardTitle: card.subsection.title, count: orderedIds.length },
    });
    await revalidateBookSubsection(card.subsectionId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reorder" };
  }
}

// v2.8.0: VALID_CELL_STATUSES + cellSchema + the write half moved to
// src/lib/core/book.ts. VALID_CELL_STATUSES is imported back at the top
// of this file (its type still shapes this action's payload param).
export async function setWeddingPartyCell(
  memberId: string,
  itemId: string,
  payload: { status: typeof VALID_CELL_STATUSES[number]; notes?: string | null },
): Promise<BookActionResult> {
  const user = await requireEdit("book");
  return setWeddingPartyCellCore(user, memberId, itemId, payload);
}

