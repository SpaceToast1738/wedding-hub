// v1.37.5 (P7b/C): pure-decision helpers for the Guest detail panel's
// cross-module surfaces. Two read-time queries:
//   1. findStaysForGuest — STAY cards (BookStayCard) where the guest's
//      id appears in `guestIds`. Forward-only relation per the
//      v1.30.5 cross-module-reference rule; the reverse query lives
//      here.
//   2. findMealChoiceLinks — match a guest's mealStarter / mealMain /
//      mealDessert (free-text) against MENU card option labels (case-
//      insensitive). Returns the deep-link target for the option's
//      parent BookSubsection so the panel can offer "view on menu".

// ─── findStaysForGuest ───────────────────────────────────────────

export type StayForGuestShape = {
  cardId: string;
  subsectionId: string;
  subsectionSlug: string;
  subsectionTitle: string;
  sectionSlug: string;
  propertyName: string | null;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  guestIds: string[];
};

export type StayForGuestHit = {
  cardId: string;
  subsectionId: string;
  subsectionSlug: string;
  subsectionTitle: string;
  sectionSlug: string;
  propertyName: string | null;
  checkInDate: Date | null;
  checkOutDate: Date | null;
};

export function findStaysForGuest(
  guestId: string,
  stays: StayForGuestShape[],
): StayForGuestHit[] {
  return stays
    .filter((s) => s.guestIds.includes(guestId))
    .map((s) => {
      // Strip guestIds from the returned shape — the consumer only
      // needs the deep-link target + dates.
      const { guestIds, ...rest } = s;
      void guestIds;
      return rest;
    })
    .sort((a, b) => {
      const ad = a.checkInDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const bd = b.checkInDate?.getTime() ?? Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      return (a.propertyName ?? "").localeCompare(b.propertyName ?? "");
    });
}

// ─── findMealChoiceLinks ──────────────────────────────────────────
//
// MENU cards live under the Food & Drink section (or wherever the
// couple has put them). Each course has options with labels like
// "Tomato soup". A guest's mealStarter / mealMain / mealDessert is
// stored as a free-text string mirroring the option label. The
// match is case-insensitive whitespace-trimmed; we don't try to be
// clever about typos.

export type MenuOptionShape = {
  optionId: string;
  optionLabel: string;
  courseLabel: string;
  cardId: string;
  subsectionSlug: string;
  subsectionTitle: string;
  sectionSlug: string;
};

export type GuestMealShape = {
  mealStarter?: string | null;
  mealMain?: string | null;
  mealDessert?: string | null;
};

export type MealChoiceHit = {
  course: "starter" | "main" | "dessert";
  guestChoice: string;
  /** Null when the guest has a choice but it doesn't match any
   *  current MENU option (eg. typo / archived option). The panel
   *  still shows the choice text in that case, just without a link. */
  matched: MenuOptionShape | null;
};

function normalise(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function findMealChoiceLinks(
  guest: GuestMealShape,
  options: MenuOptionShape[],
): MealChoiceHit[] {
  const out: MealChoiceHit[] = [];
  const byLabel = new Map<string, MenuOptionShape[]>();
  for (const o of options) {
    const k = normalise(o.optionLabel);
    if (!k) continue;
    const arr = byLabel.get(k) ?? [];
    arr.push(o);
    byLabel.set(k, arr);
  }

  // Helper: find the best match for a free-text choice + course
  // label. Prefer a match in the same course; fall back to any
  // course; null when nothing matches.
  function best(choice: string, course: string): MenuOptionShape | null {
    const k = normalise(choice);
    if (!k) return null;
    const candidates = byLabel.get(k) ?? [];
    if (candidates.length === 0) return null;
    const inCourse = candidates.find(
      (c) => normalise(c.courseLabel) === normalise(course),
    );
    return inCourse ?? candidates[0]!;
  }

  if (guest.mealStarter && guest.mealStarter.trim()) {
    out.push({
      course: "starter",
      guestChoice: guest.mealStarter,
      matched: best(guest.mealStarter, "Starter"),
    });
  }
  if (guest.mealMain && guest.mealMain.trim()) {
    out.push({
      course: "main",
      guestChoice: guest.mealMain,
      matched: best(guest.mealMain, "Main"),
    });
  }
  if (guest.mealDessert && guest.mealDessert.trim()) {
    out.push({
      course: "dessert",
      guestChoice: guest.mealDessert,
      matched: best(guest.mealDessert, "Dessert"),
    });
  }
  return out;
}
