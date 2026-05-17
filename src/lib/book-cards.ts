// v1.26.0: pure helpers for the modular Wedding Book card system.
//
// Each card kind on `BookSubsection` (TEXT / FIELD / RECIPE / SHOT_LIST
// / OUTFIT) needs parsing + formatting + validation logic. Keeping
// these pure (no DB, no React, no Prisma types) lets the unit tests
// lock the contract without setup; mirrors the v1.11.0 csv-merge and
// v1.15.0 custom-fields patterns.

// v1.31.0: + BUILD. v1.32.0: + MENU, BAR. v1.33.0: + SETUP. v1.34.0: + LEGAL.
// v1.36.0: + STAY, LODGING_GUIDE. v1.91.0: + DRESS_CODE. v1.92.0: + WEDDING_PARTY.
export const BOOK_CARD_KINDS = ["TEXT", "FIELD", "RECIPE", "SHOT_LIST", "OUTFIT", "BUILD", "MENU", "BAR", "SETUP", "LEGAL", "STAY", "LODGING_GUIDE", "DRESS_CODE", "WEDDING_PARTY"] as const;
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
    description: "One person's outfit — fitting timeline, cost, items, photos.",
  },
  BUILD: {
    label: "DIY",
    description: "Track a DIY project end-to-end — materials, sessions, status.",
  },
  MENU: {
    label: "Menu",
    description: "Food service composition — courses, options, dietary tags.",
  },
  BAR: {
    label: "Bar",
    description: "Drinks plan — items by category, per-head sanity check.",
  },
  SETUP: {
    label: "Setup",
    description: "Per-space spatial walkthrough — items, location, packed/placed flags.",
  },
  LEGAL: {
    label: "Legal",
    description: "Document checklist with deadlines + optional file attachments.",
  },
  STAY: {
    label: "Stay",
    description: "One accommodation booking — property, dates, cost, occupants.",
  },
  LODGING_GUIDE: {
    label: "Lodging guide",
    description: "Recommended hotels for guests — single sheet to share.",
  },
  // v1.91.0
  DRESS_CODE: {
    label: "Dress code",
    description: "Couple-internal reference for the dress code + colour / footwear / weather guidance.",
  },
  // v1.92.0
  WEDDING_PARTY: {
    label: "Wedding party",
    description: "Matrix tracker for bridesmaid / groomsman / flower-girl readiness (items × people).",
  },
};

// ─── FIELD card ───────────────────────────────────────────────────

export type BookFieldDefShape = {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options: string[];
  order: number;
  // v1.38.0 (P7b/B): richer authoring metadata. All optional so
  // existing rows still pass through validators unchanged.
  group?: string | null;
  helpText?: string | null;
  required?: boolean;
  min?: number | null;
  max?: number | null;
  dateMin?: string | null;  // yyyy-mm-dd
  dateMax?: string | null;
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
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    // v1.38.0: required-flag enforcement. Empty value is rejected
    // when the def says required.
    if (def.required) {
      throw new Error(`${def.label}: required`);
    }
    return null;
  }
  const trimmed = String(raw).trim();

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
      // v1.38.0: range enforcement (when set).
      if (def.min != null && n < def.min) {
        throw new Error(`${def.label}: must be ≥ ${def.min}`);
      }
      if (def.max != null && n > def.max) {
        throw new Error(`${def.label}: must be ≤ ${def.max}`);
      }
      return n;
    }
    case "date": {
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) {
        throw new Error(`${def.label}: not a valid date`);
      }
      const iso = d.toISOString().slice(0, 10);
      // v1.38.0: date-range enforcement (when set).
      if (def.dateMin && iso < def.dateMin) {
        throw new Error(`${def.label}: must be on or after ${def.dateMin}`);
      }
      if (def.dateMax && iso > def.dateMax) {
        throw new Error(`${def.label}: must be on or before ${def.dateMax}`);
      }
      return iso;
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

// ─── RECIPE rollups (v1.38.0) ────────────────────────────────────
//
// Time budget for structured recipe steps. Splits day-before prep
// from active (day-of) time so the couple knows what to do when.

export type RecipeStepShape = {
  durationMinutes?: number | null;
  dayBefore?: boolean;
};

export type RecipeRollups = {
  /** Sum of durationMinutes across NON-day-before steps. Null when
   *  no step has a duration set. */
  activeMinutes: number | null;
  /** Sum of durationMinutes across day-before steps only. Null when
   *  no day-before step has a duration set. */
  dayBeforeMinutes: number | null;
  /** Count of steps tagged dayBefore. */
  dayBeforeCount: number;
  stepCount: number;
};

export function recipeRollups(steps: RecipeStepShape[]): RecipeRollups {
  let activeSum = 0;
  let dayBeforeSum = 0;
  let activeAny = false;
  let dayBeforeAny = false;
  let dayBeforeCount = 0;
  for (const s of steps) {
    if (s.dayBefore) dayBeforeCount += 1;
    if (s.durationMinutes != null && Number.isFinite(s.durationMinutes)) {
      if (s.dayBefore) {
        dayBeforeSum += s.durationMinutes;
        dayBeforeAny = true;
      } else {
        activeSum += s.durationMinutes;
        activeAny = true;
      }
    }
  }
  return {
    activeMinutes: activeAny ? activeSum : null,
    dayBeforeMinutes: dayBeforeAny ? dayBeforeSum : null,
    dayBeforeCount,
    stepCount: steps.length,
  };
}

// ─── SHOT_LIST card ───────────────────────────────────────────────

export type BookShotShape = {
  title: string;
  withWhom: string[];
  location: string | null;
  notes: string | null;
  // v1.38.0 (P7b/B): structured grouping + time budget + guest-list
  // forward link.
  category?: string | null;
  estimatedMinutes?: number | null;
  guestIds?: string[];
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

const SHOT_CATEGORY_MAX = 60;
const SHOT_ESTIMATED_MAX = 600; // 10h sanity cap

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
  // v1.38.0: optional fields validated only when present so existing
  // callers that don't pass them still pass through.
  let category: string | null | undefined = input.category;
  if (category != null) {
    const trimmed = category.trim();
    if (trimmed.length === 0) {
      category = null;
    } else {
      if (trimmed.length > SHOT_CATEGORY_MAX) {
        throw new Error(`Shot category too long (max ${SHOT_CATEGORY_MAX} chars)`);
      }
      category = trimmed;
    }
  }
  let estimatedMinutes: number | null | undefined = input.estimatedMinutes;
  if (estimatedMinutes != null) {
    if (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 0) {
      throw new Error("estimatedMinutes must be ≥ 0");
    }
    if (estimatedMinutes > SHOT_ESTIMATED_MAX) {
      throw new Error(`estimatedMinutes too large (max ${SHOT_ESTIMATED_MAX})`);
    }
    estimatedMinutes = Math.round(estimatedMinutes);
  }
  const guestIds = (input.guestIds ?? []).map((id) => String(id).trim()).filter((id) => id.length > 0);
  return {
    title,
    withWhom,
    location,
    notes,
    category: category ?? null,
    estimatedMinutes: estimatedMinutes ?? null,
    guestIds,
  };
}

// ─── SHOT_LIST rollups (v1.38.0) ──────────────────────────────────
//
// Time-budget + capture-progress + per-category grouping for the
// SHOT_LIST card header. Pure — caller passes shaped shots, gets
// back numbers + a Map.

export type ShotForRollup = {
  category?: string | null;
  estimatedMinutes?: number | null;
  captured: boolean;
};

export type ShotListRollups = {
  shotCount: number;
  capturedCount: number;
  percentCaptured: number;
  /** Total estimated minutes across all shots (sum of non-null
   *  `estimatedMinutes`). Null when no shot has an estimate set. */
  estimatedMinutesTotal: number | null;
  /** Map of category → { count, captured, estimatedMinutes }.
   *  Shots with null/empty category bucket under the empty string. */
  perCategory: Map<string, { count: number; captured: number; estimatedMinutes: number }>;
};

export function shotListRollups(shots: ShotForRollup[]): ShotListRollups {
  const shotCount = shots.length;
  const capturedCount = shots.filter((s) => s.captured).length;
  const percentCaptured = shotCount === 0 ? 0 : Math.round((capturedCount / shotCount) * 100);
  let estimatedSum = 0;
  let estimatedAny = false;
  const perCategory = new Map<string, { count: number; captured: number; estimatedMinutes: number }>();
  for (const s of shots) {
    const k = (s.category ?? "").trim();
    const bucket = perCategory.get(k) ?? { count: 0, captured: 0, estimatedMinutes: 0 };
    bucket.count += 1;
    if (s.captured) bucket.captured += 1;
    if (s.estimatedMinutes != null && Number.isFinite(s.estimatedMinutes)) {
      bucket.estimatedMinutes += s.estimatedMinutes;
      estimatedSum += s.estimatedMinutes;
      estimatedAny = true;
    }
    perCategory.set(k, bucket);
  }
  return {
    shotCount,
    capturedCount,
    percentCaptured,
    estimatedMinutesTotal: estimatedAny ? estimatedSum : null,
    perCategory,
  };
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

// ─── BUILD card (v1.31.0) ─────────────────────────────────────────
//
// DIY production tracker. Pure helper computes rollups for the
// header strip (units done, hours logged vs estimated, materials
// progress) plus a prototype-blocker flag — true when the card has
// a target date inside the next 30 days but the prototype still
// hasn't been ticked off. Keeps the logic in one place so the
// editor and any "Today widget" or audit summary can reuse it.

export type BuildMaterialShape = {
  quantity?: number | null;
  costPence?: number | null;
  ordered: boolean;
  arrived: boolean;
};

export type BuildSessionShape = {
  minutes: number;
  unitsCompleted?: number | null;
};

export type BuildCardShape = {
  quantityNeeded?: number | null;
  estimatedMinutesPerUnit?: number | null;
  prototypeDone: boolean;
  targetDate?: Date | null;
  materials: BuildMaterialShape[];
  sessions: BuildSessionShape[];
};

export type BuildRollups = {
  materialsTotalPence: number;
  hoursLogged: number;
  hoursEstimated: number | null;
  unitsDone: number;
  percentMaterialsOrdered: number;
  percentMaterialsArrived: number;
  prototypeBlocker: boolean;
};

const PROTOTYPE_BLOCKER_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function buildRollups(card: BuildCardShape, now: Date = new Date()): BuildRollups {
  const materialsTotalPence = card.materials.reduce(
    (sum, m) => sum + (m.costPence ?? 0),
    0,
  );
  const hoursLogged =
    Math.round(
      (card.sessions.reduce((sum, s) => sum + s.minutes, 0) / 60) * 10,
    ) / 10;
  const hoursEstimated =
    card.estimatedMinutesPerUnit != null && card.quantityNeeded != null
      ? Math.round((card.estimatedMinutesPerUnit * card.quantityNeeded) / 60 * 10) / 10
      : null;
  const unitsDone = card.sessions.reduce(
    (sum, s) => sum + (s.unitsCompleted ?? 0),
    0,
  );
  const total = card.materials.length;
  const percentMaterialsOrdered =
    total === 0 ? 0 : Math.round((card.materials.filter((m) => m.ordered).length / total) * 100);
  const percentMaterialsArrived =
    total === 0 ? 0 : Math.round((card.materials.filter((m) => m.arrived).length / total) * 100);
  const prototypeBlocker =
    !card.prototypeDone &&
    card.targetDate != null &&
    (card.targetDate.getTime() - now.getTime()) / MS_PER_DAY <= PROTOTYPE_BLOCKER_DAYS &&
    card.targetDate.getTime() >= now.getTime();
  return {
    materialsTotalPence,
    hoursLogged,
    hoursEstimated,
    unitsDone,
    percentMaterialsOrdered,
    percentMaterialsArrived,
    prototypeBlocker,
  };
}

// ─── MENU card (v1.32.0) ──────────────────────────────────────────
//
// Live counts of how many guests have selected each option. We
// match by case-insensitive label equality against
// Guest.mealStarter / mealMain / mealDessert (CSV-imported free text)
// scoped to the course label. The structured MealOption FK exists
// in the legacy schema but is unwired; relying on it would silently
// undercount real guest data.

export type MenuOptionShape = {
  id: string;
  label: string;
  dietary: string[];
  isVegetarianMain: boolean;
  isKidsMeal: boolean;
};

export type MenuCourseShape = {
  id: string;
  courseLabel: string;
  options: MenuOptionShape[];
};

export type MenuCardShape = {
  pricePerHeadPence?: number | null;
  confirmedHeadcount?: number | null;
  courses: MenuCourseShape[];
};

export type GuestMealRow = {
  attending?: boolean | null;
  isChild?: boolean;
  mealStarter?: string | null;
  mealMain?: string | null;
  mealDessert?: string | null;
  dietary?: string[];
};

export type MenuRollups = {
  totalConfirmed: number; // sum of confirmed adults + confirmed children
  pricePence: number; // confirmed × pricePerHeadPence (0 if either is null)
  perCourseCounts: Record<string /* courseId */, Record<string /* optionId */, number>>;
  /** Allergen / dietary tag → number of selected guests */
  allergenAggregate: Record<string, number>;
};

const MEAL_FIELD_BY_COURSE_PREFIX: Array<{ prefix: string; field: keyof GuestMealRow }> = [
  { prefix: "starter", field: "mealStarter" },
  { prefix: "main", field: "mealMain" },
  { prefix: "dessert", field: "mealDessert" },
];

function fieldForCourseLabel(courseLabel: string): keyof GuestMealRow | null {
  const lower = courseLabel.toLowerCase();
  for (const { prefix, field } of MEAL_FIELD_BY_COURSE_PREFIX) {
    if (lower.includes(prefix)) return field;
  }
  // Late-night / canapés / etc. don't have a guest field; counts stay 0.
  return null;
}

export function menuRollups(
  card: MenuCardShape,
  guests: GuestMealRow[],
): MenuRollups {
  const attending = guests.filter((g) => g.attending !== false);
  const totalConfirmed = card.confirmedHeadcount ?? attending.length;
  const pricePence =
    card.pricePerHeadPence != null && totalConfirmed > 0
      ? card.pricePerHeadPence * totalConfirmed
      : 0;

  const perCourseCounts: Record<string, Record<string, number>> = {};
  const allergenAggregate: Record<string, number> = {};

  for (const course of card.courses) {
    perCourseCounts[course.id] = {};
    const field = fieldForCourseLabel(course.courseLabel);
    for (const option of course.options) {
      perCourseCounts[course.id]![option.id] = 0;
    }
    if (!field) continue;
    for (const guest of attending) {
      const raw = guest[field];
      if (typeof raw !== "string" || !raw.trim()) continue;
      const normalised = raw.trim().toLowerCase();
      const match = course.options.find(
        (o) => o.label.trim().toLowerCase() === normalised,
      );
      if (match) {
        perCourseCounts[course.id]![match.id] = (perCourseCounts[course.id]![match.id] ?? 0) + 1;
        // Record this guest's dietary tags against the option's allergens
        // to surface "X guests have a dietary tag" — but only against
        // options they actually selected (cleaner than counting tags
        // across all guests).
        for (const tag of guest.dietary ?? []) {
          const t = tag.trim();
          if (!t) continue;
          allergenAggregate[t] = (allergenAggregate[t] ?? 0) + 1;
        }
      }
    }
  }
  return { totalConfirmed, pricePence, perCourseCounts, allergenAggregate };
}

// ─── BAR card (v1.32.0) ──────────────────────────────────────────

export type BarItemShape = {
  category: string;
  quantityPlanned?: number | null;
  unit?: string | null;
  costPence?: number | null;
  // v1.32.2: per-head pricing. When set, the line is costed per
  // cover and `quantityPlanned` is interpreted as drinks per head.
  pricePerHeadPence?: number | null;
  timing?: string | null;
};

export type BarCardShape = {
  items: BarItemShape[];
};

export type BarRollups = {
  totalCostPence: number;
  perCategory: Record<
    string,
    { totalCostPence: number; itemCount: number; bottlesPlanned: number }
  >;
  /** "low" | "high" | "ok" | "unknown" — bottles per adult.
   *  unknown when there's no confirmed adult count or no bottle items. */
  perHeadFlag: "low" | "high" | "ok" | "unknown";
  bottlesPerAdult: number | null;
};

const BAR_LOW_THRESHOLD = 0.5;
const BAR_HIGH_THRESHOLD = 1.5;

function isBottleUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  const u = unit.toLowerCase();
  return u === "bottle" || u === "bottles" || u === "btl" || u === "btls";
}

/**
 * Compute the total cost for a single bar item.
 *
 *   - Per-head pricing (v1.32.2): pricePerHeadPence × adults ×
 *     (quantityPlanned ?? 1). When confirmedAdults is null we can't
 *     compute the per-head sum — falls back to 0 contribution to keep
 *     the totals stable when the head count is unknown. costPence is
 *     ignored in this mode.
 *   - Bottle / fixed pricing: just costPence.
 */
export function barItemTotalPence(
  item: BarItemShape,
  confirmedAdults: number | null,
): number {
  if (item.pricePerHeadPence != null) {
    if (!confirmedAdults || confirmedAdults <= 0) return 0;
    const drinksPerHead = item.quantityPlanned ?? 1;
    return Math.round(item.pricePerHeadPence * confirmedAdults * drinksPerHead);
  }
  return item.costPence ?? 0;
}

export function barRollups(
  card: BarCardShape,
  confirmedAdults: number | null,
): BarRollups {
  const perCategory: Record<
    string,
    { totalCostPence: number; itemCount: number; bottlesPlanned: number }
  > = {};
  let totalCostPence = 0;
  let totalBottles = 0;
  for (const item of card.items) {
    const cat = item.category || "Uncategorised";
    if (!perCategory[cat]) perCategory[cat] = { totalCostPence: 0, itemCount: 0, bottlesPlanned: 0 };
    perCategory[cat]!.itemCount += 1;
    const lineTotal = barItemTotalPence(item, confirmedAdults);
    perCategory[cat]!.totalCostPence += lineTotal;
    totalCostPence += lineTotal;
    // Per-head items don't add to the bottle-count sanity check —
    // they're already accounted for in cost terms.
    if (
      item.pricePerHeadPence == null &&
      isBottleUnit(item.unit) &&
      item.quantityPlanned != null
    ) {
      perCategory[cat]!.bottlesPlanned += item.quantityPlanned;
      totalBottles += item.quantityPlanned;
    }
  }
  let perHeadFlag: BarRollups["perHeadFlag"] = "unknown";
  let bottlesPerAdult: number | null = null;
  if (confirmedAdults && confirmedAdults > 0 && totalBottles > 0) {
    bottlesPerAdult = totalBottles / confirmedAdults;
    if (bottlesPerAdult < BAR_LOW_THRESHOLD) perHeadFlag = "low";
    else if (bottlesPerAdult > BAR_HIGH_THRESHOLD) perHeadFlag = "high";
    else perHeadFlag = "ok";
  }
  return { totalCostPence, perCategory, perHeadFlag, bottlesPerAdult };
}

// ─── SETUP card (v1.33.0) ────────────────────────────────────────
//
// Per-space spatial walkthrough. Rollups feed the header strip:
// total items, % packed, % placed. Both percentages round to
// integers and treat 0-item cards as 0% (rather than NaN).

export type SetupItemShape = {
  packed: boolean;
  placed: boolean;
};

export type SetupCardShape = {
  items: SetupItemShape[];
};

export type SetupRollups = {
  itemCount: number;
  packedCount: number;
  placedCount: number;
  percentPacked: number;
  percentPlaced: number;
};

export function setupRollups(card: SetupCardShape): SetupRollups {
  const itemCount = card.items.length;
  const packedCount = card.items.filter((i) => i.packed).length;
  const placedCount = card.items.filter((i) => i.placed).length;
  const percentPacked = itemCount === 0 ? 0 : Math.round((packedCount / itemCount) * 100);
  const percentPlaced = itemCount === 0 ? 0 : Math.round((placedCount / itemCount) * 100);
  return { itemCount, packedCount, placedCount, percentPacked, percentPlaced };
}

// ─── LEGAL card (v1.34.0) ────────────────────────────────────────
//
// Document checklist rollups. The header surfaces:
//   - days remaining until the card-level dueByDate (negative if past)
//   - % obtained
//   - whether any item expires before the wedding (red flag)
//   - whether the card-level deadline has passed (red flag)

export type LegalItemShape = {
  obtained: boolean;
  expiresAt?: Date | null;
};

export type LegalCardShape = {
  dueByDate?: Date | null;
  items: LegalItemShape[];
};

export type LegalRollups = {
  itemCount: number;
  obtainedCount: number;
  percentObtained: number;
  daysToDue: number | null;
  isOverdue: boolean;
  expiringBeforeWedding: number;
};

const LEGAL_MS_PER_DAY = 24 * 60 * 60 * 1000;

export function legalRollups(
  card: LegalCardShape,
  weddingDate: Date | null,
  now: Date = new Date(),
): LegalRollups {
  const itemCount = card.items.length;
  const obtainedCount = card.items.filter((i) => i.obtained).length;
  const percentObtained =
    itemCount === 0 ? 0 : Math.round((obtainedCount / itemCount) * 100);
  let daysToDue: number | null = null;
  let isOverdue = false;
  if (card.dueByDate) {
    const diff = card.dueByDate.getTime() - now.getTime();
    daysToDue = Math.round(diff / LEGAL_MS_PER_DAY);
    isOverdue = diff < 0 && obtainedCount < itemCount;
  }
  let expiringBeforeWedding = 0;
  if (weddingDate) {
    expiringBeforeWedding = card.items.filter(
      (i) => i.expiresAt && i.expiresAt.getTime() < weddingDate.getTime(),
    ).length;
  }
  return {
    itemCount,
    obtainedCount,
    percentObtained,
    daysToDue,
    isOverdue,
    expiringBeforeWedding,
  };
}

// ─── OUTFIT card (v1.35.0 rework) ─────────────────────────────────
//
// One card per wedding-party member. v1.93.0 drops the fitting →
// alterations → pickup milestone logic — those live as Tasks now.
// The rollup is just item progress: how many items are at one of the
// "done" statuses (Received / Already own) out of the total.

export type OutfitItemShape = {
  status?: string | null;
};

export type OutfitCardShape = {
  items: OutfitItemShape[];
};

export type OutfitRollups = {
  itemCount: number;
  collectedCount: number;
  percentCollected: number;
};

// v1.93.0: statuses that count as "done" / item handled. Lowercased
// for case-insensitive match against stored status strings.
const DONE_STATUS_KEYS = new Set(["received", "already own"]);

export function outfitRollups(card: OutfitCardShape): OutfitRollups {
  const itemCount = card.items.length;
  const collectedCount = card.items.filter(
    (i) => DONE_STATUS_KEYS.has((i.status ?? "").toLowerCase()),
  ).length;
  const percentCollected = itemCount === 0 ? 0 : Math.round((collectedCount / itemCount) * 100);
  return { itemCount, collectedCount, percentCollected };
}

// ─── STAY card (v1.36.0) ────────────────────────────────────────────
//
// Pure rollups for a single accommodation booking. Cost-only — the
// booking itself is one row, so there's nothing to count up. We
// derive nights stayed (check-in → check-out) and days-until-checkin
// for the header strip; both null when the dates aren't set.

const STAY_MS_PER_DAY = 86_400_000;

export type StayCardShape = {
  checkInDate?: Date | null;
  checkOutDate?: Date | null;
  costPence?: number | null;
  paid?: boolean;
};

export type StayRollups = {
  /** check-out − check-in, in whole days. Null when either date missing. */
  nights: number | null;
  /** days until check-in (negative if past). Null when no check-in date. */
  daysToCheckIn: number | null;
  /** "upcoming" | "current" | "past" | null based on now vs check-in/out. */
  phase: "upcoming" | "current" | "past" | null;
};

export function stayRollups(card: StayCardShape, now: Date = new Date()): StayRollups {
  const ci = card.checkInDate ?? null;
  const co = card.checkOutDate ?? null;
  let nights: number | null = null;
  if (ci && co) {
    nights = Math.max(0, Math.round((co.getTime() - ci.getTime()) / STAY_MS_PER_DAY));
  }
  let daysToCheckIn: number | null = null;
  if (ci) {
    daysToCheckIn = Math.round((ci.getTime() - now.getTime()) / STAY_MS_PER_DAY);
  }
  let phase: StayRollups["phase"] = null;
  if (ci) {
    if (now.getTime() < ci.getTime()) phase = "upcoming";
    else if (co && now.getTime() > co.getTime()) phase = "past";
    else phase = "current";
  }
  return { nights, daysToCheckIn, phase };
}

// ─── LODGING_GUIDE card (v1.36.0) ──────────────────────────────────
//
// Pure rollups for the recommended-hotels reference card. Items have
// no tracked-state, so the rollup is just a count + a per-price-band
// breakdown so the header can show "8 hotels — 3 £, 4 ££, 1 £££".

export type LodgingItemShape = {
  priceRangeLabel?: string | null;
};

export type LodgingRollups = {
  itemCount: number;
  /** Map of priceRangeLabel → count. Items with null/empty label
   *  bucketed under the empty string so the caller can choose to
   *  hide them. */
  perPriceBand: Map<string, number>;
};

export function lodgingRollups(card: { items: LodgingItemShape[] }): LodgingRollups {
  const itemCount = card.items.length;
  const perPriceBand = new Map<string, number>();
  for (const i of card.items) {
    const k = (i.priceRangeLabel ?? "").trim();
    perPriceBand.set(k, (perPriceBand.get(k) ?? 0) + 1);
  }
  return { itemCount, perPriceBand };
}
