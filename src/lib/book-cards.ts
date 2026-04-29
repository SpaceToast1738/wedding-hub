// v1.26.0: pure helpers for the modular Wedding Book card system.
//
// Each card kind on `BookSubsection` (TEXT / FIELD / RECIPE / SHOT_LIST
// / OUTFIT) needs parsing + formatting + validation logic. Keeping
// these pure (no DB, no React, no Prisma types) lets the unit tests
// lock the contract without setup; mirrors the v1.11.0 csv-merge and
// v1.15.0 custom-fields patterns.

export const BOOK_CARD_KINDS = ["TEXT", "FIELD", "RECIPE", "SHOT_LIST", "OUTFIT"] as const;
export type BookCardKind = (typeof BOOK_CARD_KINDS)[number];

// Display metadata for each card kind — used by the picker UI and
// any "card type: …" labels. Centralising so the labels stay
// consistent across the picker, the kind chip on each card, and
// future stats.
export const BOOK_CARD_KIND_META: Record<
  BookCardKind,
  { label: string; description: string }
> = {
  TEXT: {
    label: "Text",
    description: "Free-form notes — markdown or plain text.",
  },
  FIELD: {
    label: "Field",
    description: "List of typed fields with values (text / number / date / select).",
  },
  RECIPE: {
    label: "Recipe",
    description: "Ingredients + steps + notes. Cocktails, centrepieces, bouquets.",
  },
  SHOT_LIST: {
    label: "Shot list",
    description: "Photos to capture. Title + with whom + location + ticked when shot.",
  },
  OUTFIT: {
    label: "Outfit",
    description: "Per-person outfits — items, supplier, status, notes.",
  },
};

// ─── FIELD card ───────────────────────────────────────────────────

export type BookFieldDefShape = {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options: string[];
  order: number;
};

// On-disk shape for FIELD card values: a record keyed by
// BookFieldDef.id, stored on BookSubsection.fields. Mirrors v1.15.0's
// CustomFieldValues exactly so callers can pass either through the
// same UI helpers if needed later.
export type BookFieldValues = Record<string, string | number | null>;

// Parse a raw form input into the typed value the FIELD card stores.
// Same contract as parseCustomFieldValue in lib/custom-fields.ts —
// returns the typed value when valid, null when empty, throws on
// invalid input.
export function parseBookFieldValue(
  def: BookFieldDefShape,
  raw: string | null | undefined,
): string | number | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;

  switch (def.type) {
    case "text": {
      if (trimmed.length > 2000) {
        throw new Error(`${def.label}: too long (max 2000 chars)`);
      }
      return trimmed;
    }
    case "number": {
      const n = Number(trimmed.replace(/[, ]/g, ""));
      if (Number.isNaN(n) || !Number.isFinite(n)) {
        throw new Error(`${def.label}: must be a number`);
      }
      return n;
    }
    case "date": {
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) {
        throw new Error(`${def.label}: not a valid date`);
      }
      return d.toISOString().slice(0, 10);
    }
    case "select": {
      if (!def.options.includes(trimmed)) {
        throw new Error(`${def.label}: must be one of ${def.options.join(", ")}`);
      }
      return trimmed;
    }
  }
}

// Format a stored value for display. Returns "—" when null/undefined.
export function formatBookFieldValue(
  def: BookFieldDefShape,
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return "—";
  switch (def.type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n) || !Number.isFinite(n)) return "—";
      return n.toLocaleString();
    }
    case "date": {
      if (typeof value !== "string") return "—";
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    default:
      return String(value);
  }
}

// ─── RECIPE card ──────────────────────────────────────────────────

export type BookRecipeShape = {
  ingredients: string[];
  steps: string[];
  notes: string | null;
};

// Trim whitespace + drop empty entries before write. Caller passes
// the user-edited list as-is; this guarantees the stored Json is
// canonical (no leading whitespace, no zero-length entries that the
// renderer would otherwise show as gaps).
export function normaliseRecipeList(items: readonly string[]): string[] {
  return items.map((s) => s.trim()).filter((s) => s.length > 0);
}

// Hard cap to keep the Json column tidy. 100 entries is roomy for
// any real wedding recipe; rejects bot/abuse input that might pile
// up megabytes of strings.
const RECIPE_MAX_ENTRIES = 100;
const RECIPE_MAX_ENTRY_LENGTH = 500;
const RECIPE_NOTES_MAX = 5000;

export function validateRecipe(input: BookRecipeShape): BookRecipeShape {
  const ingredients = normaliseRecipeList(input.ingredients);
  const steps = normaliseRecipeList(input.steps);
  if (ingredients.length > RECIPE_MAX_ENTRIES) {
    throw new Error(`Too many ingredients (max ${RECIPE_MAX_ENTRIES})`);
  }
  if (steps.length > RECIPE_MAX_ENTRIES) {
    throw new Error(`Too many steps (max ${RECIPE_MAX_ENTRIES})`);
  }
  for (const item of [...ingredients, ...steps]) {
    if (item.length > RECIPE_MAX_ENTRY_LENGTH) {
      throw new Error(`Recipe entry too long (max ${RECIPE_MAX_ENTRY_LENGTH} chars)`);
    }
  }
  const notes = input.notes && input.notes.trim() !== "" ? input.notes.trim() : null;
  if (notes && notes.length > RECIPE_NOTES_MAX) {
    throw new Error(`Recipe notes too long (max ${RECIPE_NOTES_MAX} chars)`);
  }
  return { ingredients, steps, notes };
}

// ─── SHOT_LIST card ───────────────────────────────────────────────

export type BookShotShape = {
  title: string;
  withWhom: string[];
  location: string | null;
  notes: string | null;
};

// Comma-separated free-text → trimmed string array. Mirrors the
// existing photography importer + UI shape so SHOT_LIST inherits
// the same UX.
export function parseWithWhom(raw: string | null | undefined): string[] {
  if (raw === null || raw === undefined) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const SHOT_TITLE_MAX = 200;
const SHOT_LOCATION_MAX = 200;
const SHOT_NOTES_MAX = 2000;

export function validateShot(input: BookShotShape): BookShotShape {
  const title = input.title.trim();
  if (title.length === 0) throw new Error("Shot title is required");
  if (title.length > SHOT_TITLE_MAX) {
    throw new Error(`Shot title too long (max ${SHOT_TITLE_MAX} chars)`);
  }
  const withWhom = input.withWhom.map((s) => s.trim()).filter((s) => s.length > 0);
  const location = input.location && input.location.trim() !== "" ? input.location.trim() : null;
  if (location && location.length > SHOT_LOCATION_MAX) {
    throw new Error(`Shot location too long (max ${SHOT_LOCATION_MAX} chars)`);
  }
  const notes = input.notes && input.notes.trim() !== "" ? input.notes.trim() : null;
  if (notes && notes.length > SHOT_NOTES_MAX) {
    throw new Error(`Shot notes too long (max ${SHOT_NOTES_MAX} chars)`);
  }
  return { title, withWhom, location, notes };
}

// ─── OUTFIT card ──────────────────────────────────────────────────

export type BookOutfitShape = {
  personName: string;
  role: string | null;
  items: string[];
  supplier: string | null;
  status: string | null;
  notes: string | null;
};

const OUTFIT_NAME_MAX = 100;
const OUTFIT_FIELD_MAX = 200;
const OUTFIT_NOTES_MAX = 2000;
const OUTFIT_ITEMS_MAX_ENTRIES = 30;

export function validateOutfit(input: BookOutfitShape): BookOutfitShape {
  const personName = input.personName.trim();
  if (personName.length === 0) throw new Error("Person name is required");
  if (personName.length > OUTFIT_NAME_MAX) {
    throw new Error(`Person name too long (max ${OUTFIT_NAME_MAX} chars)`);
  }
  const role = input.role && input.role.trim() !== "" ? input.role.trim() : null;
  if (role && role.length > OUTFIT_FIELD_MAX) {
    throw new Error(`Role too long (max ${OUTFIT_FIELD_MAX} chars)`);
  }
  const items = input.items.map((s) => s.trim()).filter((s) => s.length > 0);
  if (items.length > OUTFIT_ITEMS_MAX_ENTRIES) {
    throw new Error(`Too many items (max ${OUTFIT_ITEMS_MAX_ENTRIES})`);
  }
  for (const item of items) {
    if (item.length > OUTFIT_FIELD_MAX) {
      throw new Error(`Outfit item too long (max ${OUTFIT_FIELD_MAX} chars)`);
    }
  }
  const supplier = input.supplier && input.supplier.trim() !== "" ? input.supplier.trim() : null;
  if (supplier && supplier.length > OUTFIT_FIELD_MAX) {
    throw new Error(`Supplier too long (max ${OUTFIT_FIELD_MAX} chars)`);
  }
  const status = input.status && input.status.trim() !== "" ? input.status.trim() : null;
  if (status && status.length > OUTFIT_FIELD_MAX) {
    throw new Error(`Status too long (max ${OUTFIT_FIELD_MAX} chars)`);
  }
  const notes = input.notes && input.notes.trim() !== "" ? input.notes.trim() : null;
  if (notes && notes.length > OUTFIT_NOTES_MAX) {
    throw new Error(`Outfit notes too long (max ${OUTFIT_NOTES_MAX} chars)`);
  }
  return { personName, role, items, supplier, status, notes };
}

// Items that ship as comma-separated free-text in the form (e.g.
// "Charcoal three-piece, White shirt, Burgundy tie") parse into
// array via the same helper as withWhom.
export const parseOutfitItems = parseWithWhom;
