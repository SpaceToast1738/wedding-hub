// v2.15.0: match a CSV import row to an existing guest.
//
// Pre-fix the importer merged a row into an existing guest ONLY when
// `household name + first + last` matched the hub exactly (and only
// looked inside households named in the CSV). A Say I Do party whose
// export name differs from the hub household ("Luke Maple and Guest"),
// or a plus-one still holding a placeholder name, never matched — the
// row was treated as a NEW guest, so the meals / emails / songs on it
// never reached the existing record and the hub just looked blank.
// Ten attending guests had full menu choices in the export and nothing
// in the hub on 5 Aug 2026 (enhancement cmskqxsu).
//
// Rules, in order — first hit wins, and every hit is reported so the
// preview can say WHY a row merged:
//   1. household+name — the original rule (exact household, same name).
//   2. rsvpLink+name  — the per-party Say I Do link is shared across a
//                       household, so it identifies the PARTY; the name
//                       picks the person within it. Survives a renamed
//                       household.
//   3. email          — exactly one guest holds this email.
//   4. name           — exactly one non-archived guest has this name at
//                       all. Ambiguous names (two Sam Smiths) don't
//                       match; they surface as a collision instead.
// Unmatched rows that still look like someone we know (same email, or
// same name held by 2+ guests) come back as a `collision` so the preview
// can warn "would create a duplicate of X" loudly rather than quietly
// inserting a second row.
//
// Pure: no DB. The caller builds the index from a snapshot of every
// non-archived guest.

export type IndexedGuest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  rsvpUniqueLink: string | null;
  householdName: string;
};

export type ImportRowKey = {
  firstName: string;
  lastName: string;
  email: string | null;
  rsvpLink: string | null;
  householdName: string | null;
};

export type MatchRule = "household+name" | "rsvpLink+name" | "email" | "name";

export const MATCH_RULE_LABELS: Record<MatchRule, string> = {
  "household+name": "same household + name",
  "rsvpLink+name": "same RSVP link + name",
  email: "same email",
  name: "same name (only one in the hub)",
};

export type MatchResult<G extends IndexedGuest = IndexedGuest> = { guest: G; rule: MatchRule } | null;

export type Collision<G extends IndexedGuest = IndexedGuest> =
  | { via: "email"; guest: G }
  | { via: "name"; guests: G[] }
  | null;

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function nameKey(first: string, last: string): string {
  return `${norm(first)}|${norm(last)}`;
}

export function householdNameKey(household: string, first: string, last: string): string {
  return `${norm(household)}|${nameKey(first, last)}`;
}

export type GuestIndex<G extends IndexedGuest = IndexedGuest> = {
  byHouseholdName: Map<string, G>;
  byLink: Map<string, G[]>;
  byEmail: Map<string, G[]>;
  byName: Map<string, G[]>;
};

export function buildGuestIndex<G extends IndexedGuest>(guests: readonly G[]): GuestIndex<G> {
  const idx: GuestIndex<G> = {
    byHouseholdName: new Map(),
    byLink: new Map(),
    byEmail: new Map(),
    byName: new Map(),
  };
  for (const g of guests) indexGuest(idx, g);
  return idx;
}

/** Add one guest to an index — used for a row the importer has JUST
 *  created, so a later row in the same file (a household member listed
 *  twice, a plus-one row after its host) merges into it instead of
 *  creating yet another duplicate. */
export function indexGuest<G extends IndexedGuest>(idx: GuestIndex<G>, g: G): void {
  const push = <K,>(m: Map<K, G[]>, k: K, v: G) => {
    const list = m.get(k);
    if (list) list.push(v);
    else m.set(k, [v]);
  };
  idx.byHouseholdName.set(householdNameKey(g.householdName, g.firstName, g.lastName), g);
  if (g.rsvpUniqueLink) push(idx.byLink, g.rsvpUniqueLink.trim(), g);
  if (g.email) push(idx.byEmail, norm(g.email), g);
  push(idx.byName, nameKey(g.firstName, g.lastName), g);
}

export function resolveImportMatch<G extends IndexedGuest>(
  row: ImportRowKey,
  idx: GuestIndex<G>,
): MatchResult<G> {
  const name = nameKey(row.firstName, row.lastName);
  if (!norm(row.firstName) && !norm(row.lastName)) return null;

  if (row.householdName) {
    const g = idx.byHouseholdName.get(householdNameKey(row.householdName, row.firstName, row.lastName));
    if (g) return { guest: g, rule: "household+name" };
  }

  if (row.rsvpLink) {
    const party = idx.byLink.get(row.rsvpLink.trim()) ?? [];
    const g = party.find((p) => nameKey(p.firstName, p.lastName) === name);
    if (g) return { guest: g, rule: "rsvpLink+name" };
  }

  if (row.email) {
    const holders = idx.byEmail.get(norm(row.email)) ?? [];
    if (holders.length === 1) return { guest: holders[0]!, rule: "email" };
  }

  const sameName = idx.byName.get(name) ?? [];
  if (sameName.length === 1) return { guest: sameName[0]!, rule: "name" };

  return null;
}

/** For an UNMATCHED row: is there an existing guest this could be a
 *  duplicate of? Email first (strong signal), then an ambiguous name. */
export function findCollision<G extends IndexedGuest>(row: ImportRowKey, idx: GuestIndex<G>): Collision<G> {
  if (row.email) {
    const holders = idx.byEmail.get(norm(row.email)) ?? [];
    if (holders.length >= 1) return { via: "email", guest: holders[0]! };
  }
  const sameName = idx.byName.get(nameKey(row.firstName, row.lastName)) ?? [];
  if (sameName.length >= 2) return { via: "name", guests: sameName };
  return null;
}
