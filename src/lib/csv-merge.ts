// Pure decision module for the CSV-import merge step.
//
// `decideGuestMerge` takes the existing-guest snapshot + the incoming
// CSV row and returns:
//   - `data`: the partial Guest update payload (passes straight to
//     `db.guest.update({ data })`)
//   - `diffs`: the field-level "old → new" pairs for the preview UI
//   - `songsToAdd`: titles of song requests that are new for this guest
//
// Keeping the decision pure-function lets both the preview action
// (which displays diffs) and the commit action (which applies them)
// reuse the same logic, and lets unit tests cover the matrix without
// a DB. The opt-out set (B1: per-field opt-out from the preview UI)
// short-circuits any field the user un-ticked before submit.

export type MergeableField =
  | "email"
  | "phone"
  | "plusOneName"
  | "role"
  | "mealStarter"
  | "mealMain"
  | "mealDessert"
  | "rsvpLink"
  | "notes"
  | "side"
  | "rsvp"
  | "isChild"
  | "needsHighchair"
  | "childrenMeal"
  | "plusOneAllowed"
  | "dietary"
  | "tags"
  | "songs";

export const MERGEABLE_FIELDS: readonly MergeableField[] = [
  "email", "phone", "plusOneName", "role",
  "mealStarter", "mealMain", "mealDessert",
  "rsvpLink", "notes", "side", "rsvp",
  "isChild", "needsHighchair", "childrenMeal", "plusOneAllowed",
  "dietary", "tags", "songs",
];

// Human-friendly labels for the preview UI. Keep in sync with the
// schema's natural-language names (matches existing meal/dietary
// chips in ImportClient).
export const FIELD_LABELS: Record<MergeableField, string> = {
  email: "Email",
  phone: "Phone",
  plusOneName: "+1 name",
  role: "Role",
  mealStarter: "Meal — starter",
  mealMain: "Meal — main",
  mealDessert: "Meal — dessert",
  rsvpLink: "RSVP link",
  notes: "Notes",
  side: "Side",
  rsvp: "RSVP",
  isChild: "Child",
  needsHighchair: "Highchair",
  childrenMeal: "Kids meal",
  plusOneAllowed: "+1 allowed",
  dietary: "Dietary",
  tags: "Tags",
  songs: "Song requests",
};

export type GuestSnapshot = {
  email: string | null;
  phone: string | null;
  plusOneName: string | null;
  role: string | null;
  side: "BRIDE" | "GROOM" | "BOTH";
  rsvp: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
  isChild: boolean;
  needsHighchair: boolean;
  childrenMeal: boolean;
  plusOneAllowed: boolean;
  dietary: string[];
  tags: string[];
  mealStarter: string | null;
  mealMain: string | null;
  mealDessert: string | null;
  rsvpUniqueLink: string | null;
  notes: string | null;
  songTitles: string[];
};

export type IncomingRow = {
  email: string | null;
  phone: string | null;
  plusOneName: string | null;
  role: string | null;
  side: "BRIDE" | "GROOM" | "BOTH";
  rsvp: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
  isChild: boolean;
  needsHighchair: boolean;
  childrenMeal: boolean;
  plusOneAllowed: boolean;
  dietary: string[];
  tags: string[];
  mealStarter: string | null;
  mealMain: string | null;
  mealDessert: string | null;
  rsvpLink: string | null;
  notes: string | null;
  songs: string[];
};

export type FieldDiff = {
  field: MergeableField;
  label: string;
  oldValue: string;
  newValue: string;
};

export type MergeDecision = {
  data: Record<string, unknown>;
  diffs: FieldDiff[];
  songsToAdd: string[];
};

const fmt = {
  str: (v: string | null) => v ?? "—",
  bool: (v: boolean) => (v ? "Yes" : "No"),
  side: (v: "BRIDE" | "GROOM" | "BOTH") =>
    v === "BRIDE" ? "Bride" : v === "GROOM" ? "Groom" : "Both",
  rsvp: (v: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE") =>
    v.charAt(0) + v.slice(1).toLowerCase(),
  arr: (v: string[]) => (v.length === 0 ? "—" : v.join(", ")),
};

// Case-insensitive set membership for array union semantics.
function unionAdditions(current: readonly string[], next: readonly string[]): string[] {
  if (next.length === 0) return [];
  const seen = new Set(current.map((s) => s.toLowerCase()));
  return next.filter((s) => !seen.has(s.toLowerCase()));
}

export function decideGuestMerge(
  existing: GuestSnapshot,
  incoming: IncomingRow,
  optOut: ReadonlySet<MergeableField> = new Set(),
): MergeDecision {
  const data: Record<string, unknown> = {};
  const diffs: FieldDiff[] = [];

  // ── Strings (overwrite-if-new): change only if incoming is non-empty
  // and different. Skip silently if the user opted out for this field.
  function tryStringField(
    field: Exclude<MergeableField, "rsvpLink" | "notes" | "side" | "rsvp" | "isChild" | "needsHighchair" | "childrenMeal" | "plusOneAllowed" | "dietary" | "tags" | "songs">,
    dbColumn: string,
    current: string | null,
    next: string | null,
  ) {
    if (!next || next === current) return;
    diffs.push({
      field,
      label: FIELD_LABELS[field],
      oldValue: fmt.str(current),
      newValue: fmt.str(next),
    });
    if (!optOut.has(field)) data[dbColumn] = next;
  }
  tryStringField("email", "email", existing.email, incoming.email);
  tryStringField("phone", "phone", existing.phone, incoming.phone);
  tryStringField("plusOneName", "plusOneName", existing.plusOneName, incoming.plusOneName);
  tryStringField("role", "role", existing.role, incoming.role);
  tryStringField("mealStarter", "mealStarter", existing.mealStarter, incoming.mealStarter);
  tryStringField("mealMain", "mealMain", existing.mealMain, incoming.mealMain);
  tryStringField("mealDessert", "mealDessert", existing.mealDessert, incoming.mealDessert);

  // rsvpLink → rsvpUniqueLink in the DB column.
  if (incoming.rsvpLink && incoming.rsvpLink !== existing.rsvpUniqueLink) {
    diffs.push({
      field: "rsvpLink",
      label: FIELD_LABELS.rsvpLink,
      oldValue: fmt.str(existing.rsvpUniqueLink),
      newValue: fmt.str(incoming.rsvpLink),
    });
    if (!optOut.has("rsvpLink")) data.rsvpUniqueLink = incoming.rsvpLink;
  }

  // ── Notes: append rather than overwrite. Diff shows the appended text.
  if (incoming.notes && !(existing.notes && existing.notes.includes(incoming.notes))) {
    const appended = existing.notes ? `${existing.notes}\n${incoming.notes}` : incoming.notes;
    diffs.push({
      field: "notes",
      label: FIELD_LABELS.notes,
      oldValue: fmt.str(existing.notes),
      newValue: appended,
    });
    if (!optOut.has("notes")) data.notes = appended;
  }

  // ── Side: overwrite only when explicitly different from default BOTH.
  if (incoming.side !== "BOTH" && incoming.side !== existing.side) {
    diffs.push({
      field: "side",
      label: FIELD_LABELS.side,
      oldValue: fmt.side(existing.side),
      newValue: fmt.side(incoming.side),
    });
    if (!optOut.has("side")) data.side = incoming.side;
  }

  // ── RSVP: overwrite only if the new value is something other than
  // PENDING (don't reset confirmed RSVPs back to pending on re-import).
  if (incoming.rsvp !== "PENDING" && incoming.rsvp !== existing.rsvp) {
    diffs.push({
      field: "rsvp",
      label: FIELD_LABELS.rsvp,
      oldValue: fmt.rsvp(existing.rsvp),
      newValue: fmt.rsvp(incoming.rsvp),
    });
    if (!optOut.has("rsvp")) data.rsvp = incoming.rsvp;
  }

  // ── Booleans: OR semantics (never downgrade true → false).
  function tryBoolField(
    field: "isChild" | "needsHighchair" | "childrenMeal" | "plusOneAllowed",
    current: boolean,
    next: boolean,
  ) {
    if (!(next && !current)) return;
    diffs.push({
      field,
      label: FIELD_LABELS[field],
      oldValue: fmt.bool(current),
      newValue: fmt.bool(next),
    });
    if (!optOut.has(field)) data[field] = true;
  }
  tryBoolField("isChild", existing.isChild, incoming.isChild);
  tryBoolField("needsHighchair", existing.needsHighchair, incoming.needsHighchair);
  tryBoolField("childrenMeal", existing.childrenMeal, incoming.childrenMeal);
  tryBoolField("plusOneAllowed", existing.plusOneAllowed, incoming.plusOneAllowed);

  // ── Arrays: union with case-insensitive dedupe. Diff only when there
  // are additions.
  function tryArrayField(
    field: "dietary" | "tags",
    current: readonly string[],
    next: readonly string[],
  ) {
    const additions = unionAdditions(current, next);
    if (additions.length === 0) return;
    const merged = [...current, ...additions];
    diffs.push({
      field,
      label: FIELD_LABELS[field],
      oldValue: fmt.arr([...current]),
      newValue: fmt.arr(merged),
    });
    if (!optOut.has(field)) data[field] = merged;
  }
  tryArrayField("dietary", existing.dietary, incoming.dietary);
  tryArrayField("tags", existing.tags, incoming.tags);

  // ── Songs: only titles not already on the guest are added. The diff
  // shows the added titles; songsToAdd is the side-effect the action
  // applies via `db.songRequest.createMany`.
  const songAdditions = unionAdditions(existing.songTitles, incoming.songs);
  let songsToAdd: string[] = [];
  if (songAdditions.length > 0) {
    diffs.push({
      field: "songs",
      label: FIELD_LABELS.songs,
      oldValue: fmt.arr(existing.songTitles),
      newValue: fmt.arr([...existing.songTitles, ...songAdditions]),
    });
    if (!optOut.has("songs")) songsToAdd = songAdditions;
  }

  return { data, diffs, songsToAdd };
}
