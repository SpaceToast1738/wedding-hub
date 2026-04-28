"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TableShape } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
import {
  type GuestField,
  coerceBool,
  coerceChild,
  coerceDietary,
  coerceRsvp,
  coerceSide,
  coerceTags,
  inferSideFromTags,
  isEmptyValue,
  nonEmptyOrNull,
  parseCsv,
  splitFullName,
} from "@/lib/csv";
import {
  decideGuestMerge,
  type FieldDiff,
  type GuestSnapshot,
  type IncomingRow,
  type MergeableField,
  MERGEABLE_FIELDS,
} from "@/lib/csv-merge";
import { daysSinceEdited, type EditedFieldsMap } from "@/lib/last-edited-fields";

// C4: fields that map between MergeableField (CSV-side) and the
// Guest column whose edit-timestamp we'd check. Only fields the
// updateGuest action actually stamps appear here.
const MERGEABLE_TO_GUEST_FIELD: Partial<Record<MergeableField, string>> = {
  email: "email",
  phone: "phone",
  plusOneName: "plusOneName",
  role: "role",
  notes: "notes",
  side: "side",
  rsvp: "rsvp",
  isChild: "isChild",
  needsHighchair: "needsHighchair",
  plusOneAllowed: "plusOneAllowed",
  dietary: "dietary",
};

// Threshold for "recent" — a manual edit younger than this triggers
// a warning on the preview row. 14 days = a fortnight; tuned for the
// "I edited this last weekend, would hate to clobber it" use case.
const RECENT_EDIT_DAYS = 14;

export type ImportRowPreview = {
  rowIndex: number; // 1-based, excluding header
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  householdName: string | null;
  tableName: string | null;
  side: "BRIDE" | "GROOM" | "BOTH";
  rsvp: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
  isChild: boolean;
  needsHighchair: boolean;
  childrenMeal: boolean;
  plusOneAllowed: boolean;
  plusOneName: string | null;
  role: string | null;
  dietary: string[];
  tags: string[];
  mealStarter: string | null;
  mealMain: string | null;
  mealDessert: string | null;
  songs: string[];
  rsvpLink: string | null;
  notes: string | null;
  errors: string[];
  warnings: string[];
  // Resolved against the existing DB at preview time:
  householdAction: "create" | "merge" | null;
  tableAction: "create" | "merge" | null;
  // "create" = no matching guest in this household → insert new row.
  // "update" = matching guest exists (same household, same first+last,
  // case-insensitive) → merge into the existing row.
  guestAction: "create" | "update";
  emailDuplicate: boolean;
  // Populated only on update rows. Each diff shows what would change
  // if the merge applied. The UI renders these expandably with a
  // checkbox per row to opt out individual fields. Empty array means
  // the merge would be a no-op (the existing row already matches).
  fieldDiffs: FieldDiff[];
};

export type ImportPreview = {
  rows: ImportRowPreview[];
  newHouseholds: string[];
  existingHouseholds: string[];
  newTables: string[];
  existingTables: string[];
  totalGuests: number;
  validGuests: number;
  newGuests: number;
  updatedGuests: number;
  rowErrors: number;
  duplicateEmails: number;
};

const fieldEnum = z.enum([
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "household",
  "tableName",
  "side",
  "rsvp",
  "isChild",
  "needsHighchair",
  "childrenMeal",
  "plusOneAllowed",
  "plusOneName",
  "role",
  "dietary",
  "tags",
  "mealStarter",
  "mealMain",
  "mealDessert",
  "songRequest",
  "rsvpLink",
  "notes",
  "ignore",
]);

const inputSchema = z.object({
  text: z.string().min(1).max(1_000_000),
  mapping: z.array(fieldEnum),
});

function findOne(mapping: GuestField[], field: GuestField): number {
  return mapping.indexOf(field);
}

function findAll(mapping: GuestField[], field: GuestField): number[] {
  const out: number[] = [];
  mapping.forEach((m, i) => {
    if (m === field) out.push(i);
  });
  return out;
}

function buildRowPreview(
  rawRow: string[],
  mapping: GuestField[],
  headers: string[],
  rowIndex: number,
): Omit<ImportRowPreview, "householdAction" | "tableAction" | "emailDuplicate" | "guestAction" | "fieldDiffs"> {
  const single = (field: GuestField): string => {
    const idx = findOne(mapping, field);
    if (idx === -1) return "";
    return (rawRow[idx] ?? "").trim();
  };

  // ── Resolve names: prefer firstName/lastName columns; fall back to splitting
  // a single fullName column on first whitespace.
  let firstName = single("firstName");
  let lastName = single("lastName");
  if (!firstName && !lastName) {
    const full = single("fullName");
    if (full) {
      const split = splitFullName(full);
      firstName = split.firstName;
      lastName = split.lastName;
    }
  }

  const email = nonEmptyOrNull(single("email"));
  const phone = nonEmptyOrNull(single("phone"));
  const householdName = nonEmptyOrNull(single("household"));
  const tableName = nonEmptyOrNull(single("tableName"));
  const sideRaw = single("side");
  const rsvpRaw = single("rsvp");
  const isChildRaw = single("isChild");
  const needsHighchairRaw = single("needsHighchair");
  const childrenMealRaw = single("childrenMeal");
  const plusOneAllowedRaw = single("plusOneAllowed");
  const plusOneName = nonEmptyOrNull(single("plusOneName"));
  const role = nonEmptyOrNull(single("role"));
  const dietaryRaw = single("dietary");
  const tagsRaw = single("tags");
  const mealStarter = nonEmptyOrNull(single("mealStarter"));
  const mealMain = nonEmptyOrNull(single("mealMain"));
  const mealDessert = nonEmptyOrNull(single("mealDessert"));
  const rsvpLink = nonEmptyOrNull(single("rsvpLink"));

  // ── Multi-value fields
  const songIdxs = findAll(mapping, "songRequest");
  const songs = songIdxs
    .map((i) => (rawRow[i] ?? "").trim())
    .filter((s) => s && !isEmptyValue(s));

  const notesIdxs = findAll(mapping, "notes");
  const noteParts = notesIdxs
    .map((i) => {
      const value = (rawRow[i] ?? "").trim();
      if (!value || isEmptyValue(value)) return null;
      const label = headers[i]?.trim();
      return notesIdxs.length > 1 && label ? `${label}: ${value}` : value;
    })
    .filter((s): s is string => !!s);
  const notes = noteParts.length > 0 ? noteParts.join("\n") : null;

  // ── Errors and warnings
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!firstName) errors.push("missing first name");
  if (!lastName) errors.push("missing last name");
  if (firstName.length > 100) errors.push("first name too long (max 100)");
  if (lastName.length > 100) errors.push("last name too long (max 100)");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    warnings.push(`email "${email}" looks malformed — importing as-is`);
  }

  // ── Coercions (with side-from-tags fallback)
  const tags = coerceTags(tagsRaw);
  let side = coerceSide(sideRaw);
  if (!sideRaw && tags.length > 0) {
    const inferred = inferSideFromTags(tags, "Bryony", "Jamie");
    if (inferred) side = inferred;
  }

  let isChild = false;
  if (isChildRaw) {
    const v = coerceChild(isChildRaw);
    if (v === null) warnings.push(`couldn't parse "adult/child" value "${isChildRaw}", treating as adult`);
    else isChild = v;
  }

  let needsHighchair = false;
  if (needsHighchairRaw) {
    const v = coerceBool(needsHighchairRaw);
    if (v === null) warnings.push(`couldn't parse "highchair" value "${needsHighchairRaw}", treating as no`);
    else needsHighchair = v;
  }

  let childrenMeal = false;
  if (childrenMealRaw) {
    const v = coerceBool(childrenMealRaw);
    if (v === null) warnings.push(`couldn't parse "children's meal" value "${childrenMealRaw}", treating as no`);
    else childrenMeal = v;
  }

  let plusOneAllowed = false;
  if (plusOneAllowedRaw) {
    const v = coerceBool(plusOneAllowedRaw);
    if (v === null) warnings.push(`couldn't parse "plus-one allowed" value "${plusOneAllowedRaw}", treating as no`);
    else plusOneAllowed = v;
  }

  return {
    rowIndex,
    firstName,
    lastName,
    email,
    phone,
    householdName,
    tableName,
    side,
    rsvp: coerceRsvp(rsvpRaw),
    isChild,
    needsHighchair,
    childrenMeal,
    plusOneAllowed,
    plusOneName,
    role,
    dietary: coerceDietary(dietaryRaw),
    tags,
    mealStarter,
    mealMain,
    mealDessert,
    songs,
    rsvpLink,
    notes,
    errors,
    warnings,
  };
}

export async function previewImport(input: {
  text: string;
  mapping: GuestField[];
}): Promise<ImportPreview> {
  await requireEdit("guests");
  const parsed = inputSchema.parse(input);

  const rows = parseCsv(parsed.text);
  if (rows.length === 0) {
    return {
      rows: [],
      newHouseholds: [],
      existingHouseholds: [],
      newTables: [],
      existingTables: [],
      totalGuests: 0,
      validGuests: 0,
      newGuests: 0,
      updatedGuests: 0,
      rowErrors: 0,
      duplicateEmails: 0,
    };
  }

  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const previews = dataRows.map((row, i) =>
    buildRowPreview(row, parsed.mapping as GuestField[], headers, i + 1),
  );

  // Existence checks against the DB
  const householdNames = Array.from(
    new Set(previews.map((p) => p.householdName).filter((n): n is string => !!n)),
  );
  const tableNames = Array.from(
    new Set(previews.map((p) => p.tableName).filter((n): n is string => !!n)),
  );
  const emails = previews.map((p) => p.email).filter((e): e is string => !!e);

  const [existingHouseholdRows, existingTables, existingEmails, existingGuestsInTargetHouseholds] = await Promise.all([
    db.household.findMany({
      where: { name: { in: householdNames } },
      select: { id: true, name: true },
    }),
    db.table.findMany({ where: { name: { in: tableNames } }, select: { name: true } }),
    db.guest.findMany({ where: { email: { in: emails } }, select: { email: true } }),
    // Full snapshot for (household, firstName, lastName) dedupe at preview
    // time AND for the per-field diff computed against `decideGuestMerge`.
    db.guest.findMany({
      where: { household: { name: { in: householdNames } }, archived: false },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        plusOneName: true,
        role: true,
        side: true,
        rsvp: true,
        isChild: true,
        needsHighchair: true,
        childrenMeal: true,
        plusOneAllowed: true,
        dietary: true,
        tags: true,
        // C4: per-field edit-tracking — surfaced as warnings on the
        // preview row when the merge would overwrite a recent edit.
        lastEditedFields: true,
        mealStarter: true,
        mealMain: true,
        mealDessert: true,
        rsvpUniqueLink: true,
        notes: true,
        household: { select: { name: true } },
        songRequests: { select: { title: true } },
      },
    }),
  ]);
  const existingHouseholdSet = new Set(existingHouseholdRows.map((h) => h.name));
  const existingTableSet = new Set(existingTables.map((t) => t.name));
  const existingEmailSet = new Set(
    existingEmails.map((e) => e.email).filter((e): e is string => !!e),
  );

  // Key: "<householdName>|<firstNameLower>|<lastNameLower>"
  function dedupeKey(householdName: string, first: string, last: string): string {
    return `${householdName}|${first.trim().toLowerCase()}|${last.trim().toLowerCase()}`;
  }
  const existingGuestByKey = new Map(
    existingGuestsInTargetHouseholds.map((g) => [
      dedupeKey(g.household.name, g.firstName, g.lastName),
      g,
    ]),
  );

  const decorated: ImportRowPreview[] = previews.map((p) => {
    const isDup = !!p.email && existingEmailSet.has(p.email);
    const matchKey = p.householdName ? dedupeKey(p.householdName, p.firstName, p.lastName) : null;
    const matchedGuest = matchKey ? existingGuestByKey.get(matchKey) ?? null : null;
    const guestAction: "create" | "update" = matchedGuest ? "update" : "create";

    let fieldDiffs: FieldDiff[] = [];
    if (matchedGuest) {
      const snapshot: GuestSnapshot = {
        email: matchedGuest.email,
        phone: matchedGuest.phone,
        plusOneName: matchedGuest.plusOneName,
        role: matchedGuest.role,
        side: matchedGuest.side,
        rsvp: matchedGuest.rsvp,
        isChild: matchedGuest.isChild,
        needsHighchair: matchedGuest.needsHighchair,
        childrenMeal: matchedGuest.childrenMeal,
        plusOneAllowed: matchedGuest.plusOneAllowed,
        dietary: matchedGuest.dietary,
        tags: matchedGuest.tags,
        mealStarter: matchedGuest.mealStarter,
        mealMain: matchedGuest.mealMain,
        mealDessert: matchedGuest.mealDessert,
        rsvpUniqueLink: matchedGuest.rsvpUniqueLink,
        notes: matchedGuest.notes,
        songTitles: matchedGuest.songRequests.map((s) => s.title),
      };
      const incoming: IncomingRow = {
        email: p.email,
        phone: p.phone,
        plusOneName: p.plusOneName,
        role: p.role,
        side: p.side,
        rsvp: p.rsvp,
        isChild: p.isChild,
        needsHighchair: p.needsHighchair,
        childrenMeal: p.childrenMeal,
        plusOneAllowed: p.plusOneAllowed,
        dietary: p.dietary,
        tags: p.tags,
        mealStarter: p.mealStarter,
        mealMain: p.mealMain,
        mealDessert: p.mealDessert,
        rsvpLink: p.rsvpLink,
        notes: p.notes,
        songs: p.songs,
      };
      fieldDiffs = decideGuestMerge(snapshot, incoming).diffs;
    }

    // C4: warn when a diff would overwrite a manually-edited field
    // within the last RECENT_EDIT_DAYS days. Append to the row's
    // warnings so the existing preview UI surfaces it without a
    // separate render path.
    const editWarnings: string[] = [];
    if (matchedGuest && fieldDiffs.length > 0) {
      const editedMap = (matchedGuest.lastEditedFields as EditedFieldsMap | null) ?? null;
      if (editedMap) {
        for (const diff of fieldDiffs) {
          const guestField = MERGEABLE_TO_GUEST_FIELD[diff.field];
          if (!guestField) continue;
          const days = daysSinceEdited(editedMap, guestField);
          if (days !== null && days <= RECENT_EDIT_DAYS) {
            editWarnings.push(
              `you edited ${diff.label.toLowerCase()} ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`} — re-importing will overwrite (untick to keep)`,
            );
          }
        }
      }
    }

    const baseWarnings =
      isDup && guestAction === "create"
        ? [
            ...p.warnings,
            // Only show the duplicate-email warning when we're NOT already
            // merging via the name+household match — otherwise the user has
            // a clear merge path and the warning is noise.
            `another Guest row already has this email — importing will create a second guest row`,
          ]
        : p.warnings;
    return {
      ...p,
      warnings: [...baseWarnings, ...editWarnings],
      householdAction: p.householdName
        ? existingHouseholdSet.has(p.householdName)
          ? "merge"
          : "create"
        : null,
      tableAction: p.tableName
        ? existingTableSet.has(p.tableName)
          ? "merge"
          : "create"
        : null,
      guestAction,
      emailDuplicate: isDup,
      fieldDiffs,
    };
  });

  const validRows = decorated.filter((p) => p.errors.length === 0);
  const validGuests = validRows.length;
  const newGuests = validRows.filter((p) => p.guestAction === "create").length;
  const updatedGuests = validRows.filter((p) => p.guestAction === "update").length;

  return {
    rows: decorated,
    newHouseholds: householdNames.filter((n) => !existingHouseholdSet.has(n)),
    existingHouseholds: householdNames.filter((n) => existingHouseholdSet.has(n)),
    newTables: tableNames.filter((n) => !existingTableSet.has(n)),
    existingTables: tableNames.filter((n) => existingTableSet.has(n)),
    totalGuests: decorated.length,
    validGuests,
    newGuests,
    updatedGuests,
    rowErrors: decorated.length - validGuests,
    duplicateEmails: decorated.filter((p) => p.emailDuplicate).length,
  };
}

// Per-row opt-out map: row index (1-based, matches ImportRowPreview.rowIndex)
// to a list of fields the user un-ticked in the preview UI. Fields not in
// `MERGEABLE_FIELDS` are silently ignored — we don't trust the client.
const optOutSchema = z.record(z.string(), z.array(z.string()));

export async function commitImport(input: {
  text: string;
  mapping: GuestField[];
  optOut?: Record<string, string[]>;
}): Promise<{ created: number; updated: number; skipped: number; songs: number; tables: number; optOuts: number }> {
  const user = await requireEdit("guests");
  const parsed = inputSchema.parse(input);
  const optOutRaw = input.optOut ? optOutSchema.parse(input.optOut) : {};
  const optOutByRow = new Map<number, ReadonlySet<MergeableField>>();
  let totalOptOuts = 0;
  for (const [key, fields] of Object.entries(optOutRaw)) {
    const rowIndex = Number.parseInt(key, 10);
    if (!Number.isFinite(rowIndex)) continue;
    const filtered = fields.filter((f): f is MergeableField =>
      (MERGEABLE_FIELDS as readonly string[]).includes(f),
    );
    if (filtered.length === 0) continue;
    optOutByRow.set(rowIndex, new Set(filtered));
    totalOptOuts += filtered.length;
  }

  const rows = parseCsv(parsed.text);
  if (rows.length === 0) return { created: 0, updated: 0, skipped: 0, songs: 0, tables: 0, optOuts: 0 };

  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const allPreviews = dataRows.map((row, i) =>
    buildRowPreview(row, parsed.mapping as GuestField[], headers, i + 1),
  );
  const previews = allPreviews.filter((p) => p.errors.length === 0);

  if (previews.length === 0) {
    return { created: 0, updated: 0, skipped: dataRows.length, songs: 0, tables: 0, optOuts: 0 };
  }

  // ── Resolve / create households ────────────────────────────────────────
  const householdNames = Array.from(
    new Set(previews.map((p) => p.householdName).filter((n): n is string => !!n)),
  );
  const existingHouseholds = await db.household.findMany({
    where: { name: { in: householdNames } },
  });
  const householdByName = new Map(existingHouseholds.map((h) => [h.name, h]));

  // ── Existing-guest dedupe map: (householdName|first|last) → guest snapshot
  // Used to drive the merge-update path for rows whose name+household match
  // an existing row.
  function dedupeKey(householdName: string, first: string, last: string): string {
    return `${householdName}|${first.trim().toLowerCase()}|${last.trim().toLowerCase()}`;
  }
  const existingGuestRows = await db.guest.findMany({
    where: { household: { name: { in: householdNames } }, archived: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      side: true,
      rsvp: true,
      isChild: true,
      needsHighchair: true,
      childrenMeal: true,
      plusOneAllowed: true,
      plusOneName: true,
      role: true,
      dietary: true,
      tags: true,
      mealStarter: true,
      mealMain: true,
      mealDessert: true,
      rsvpUniqueLink: true,
      notes: true,
      tableSeatId: true,
      household: { select: { name: true } },
      songRequests: { select: { title: true } },
    },
  });
  const guestByKey = new Map(
    existingGuestRows.map((g) => [
      dedupeKey(g.household.name, g.firstName, g.lastName),
      g,
    ]),
  );
  const newlyCreatedHouseholds: string[] = [];

  for (const name of householdNames.filter((n) => !householdByName.has(n))) {
    const members = previews.filter((p) => p.householdName === name);
    const counts = { BRIDE: 0, GROOM: 0, BOTH: 0 };
    for (const m of members) counts[m.side]++;
    const dominantSide: "BRIDE" | "GROOM" | "BOTH" =
      counts.BRIDE >= counts.GROOM && counts.BRIDE >= counts.BOTH
        ? "BRIDE"
        : counts.GROOM >= counts.BOTH
          ? "GROOM"
          : "BOTH";
    const created = await db.household.create({ data: { name, side: dominantSide } });
    householdByName.set(name, created);
    newlyCreatedHouseholds.push(name);
  }

  // ── Resolve / create tables (with their seats) ────────────────────────
  const tableNames = Array.from(
    new Set(previews.map((p) => p.tableName).filter((n): n is string => !!n)),
  );
  const existingTables = await db.table.findMany({
    where: { name: { in: tableNames } },
    include: {
      seats: { include: { guest: { select: { id: true } } }, orderBy: { index: "asc" } },
    },
  });
  type TableState = {
    id: string;
    seats: { id: string; index: number; occupiedByGuestId: string | null }[];
  };
  const tableByName = new Map<string, TableState>();
  for (const t of existingTables) {
    tableByName.set(t.name, {
      id: t.id,
      seats: t.seats.map((s) => ({
        id: s.id,
        index: s.index,
        occupiedByGuestId: s.guest?.id ?? null,
      })),
    });
  }

  let createdTablesCount = 0;
  for (const tableName of tableNames.filter((n) => !tableByName.has(n))) {
    const targetCount = previews.filter((p) => p.tableName === tableName).length;
    const capacity = Math.max(targetCount, 8);
    const isHead = /head/i.test(tableName);
    const created = await db.table.create({
      data: {
        name: tableName,
        shape: isHead ? TableShape.HEAD : TableShape.ROUND,
        capacity,
      },
    });
    const seats = await db.$transaction(
      Array.from({ length: capacity }, (_, i) =>
        db.seat.create({ data: { tableId: created.id, index: i } }),
      ),
    );
    tableByName.set(tableName, {
      id: created.id,
      seats: seats.map((s) => ({ id: s.id, index: s.index, occupiedByGuestId: null })),
    });
    createdTablesCount++;
  }

  // ── Create / merge guests, song requests, and seat assignments ────────
  let createdCount = 0;
  let updatedCount = 0;
  let songsCount = 0;
  for (const p of previews) {
    let householdId: string;
    if (p.householdName && householdByName.has(p.householdName)) {
      householdId = householdByName.get(p.householdName)!.id;
    } else {
      const fallbackName = `${p.firstName} ${p.lastName}`.trim() || "Untitled household";
      const fallback = await db.household.create({
        data: { name: fallbackName, side: p.side },
      });
      householdId = fallback.id;
    }

    // Decide create vs merge: only merge when the household was named in
    // the import AND a guest with the same first+last already exists in it.
    const matchKey = p.householdName
      ? dedupeKey(p.householdName, p.firstName, p.lastName)
      : null;
    const existing = matchKey ? guestByKey.get(matchKey) ?? null : null;

    if (existing) {
      // ── Merge update ──────────────────────────────────────────────
      // Field-merge logic lives in `decideGuestMerge` (src/lib/csv-merge.ts).
      // The opt-out set comes from the preview UI (B1: per-field
      // checkboxes) — fields the user un-ticked are skipped.
      // Seat assignment is handled separately below since it depends
      // on transient table-state we track in this loop.
      const optOutForRow = optOutByRow.get(p.rowIndex) ?? new Set<MergeableField>();
      const merge = decideGuestMerge(
        {
          email: existing.email,
          phone: existing.phone,
          plusOneName: existing.plusOneName,
          role: existing.role,
          side: existing.side,
          rsvp: existing.rsvp,
          isChild: existing.isChild,
          needsHighchair: existing.needsHighchair,
          childrenMeal: existing.childrenMeal,
          plusOneAllowed: existing.plusOneAllowed,
          dietary: existing.dietary,
          tags: existing.tags,
          mealStarter: existing.mealStarter,
          mealMain: existing.mealMain,
          mealDessert: existing.mealDessert,
          rsvpUniqueLink: existing.rsvpUniqueLink,
          notes: existing.notes,
          songTitles: existing.songRequests.map((s) => s.title),
        },
        {
          email: p.email,
          phone: p.phone,
          plusOneName: p.plusOneName,
          role: p.role,
          side: p.side,
          rsvp: p.rsvp,
          isChild: p.isChild,
          needsHighchair: p.needsHighchair,
          childrenMeal: p.childrenMeal,
          plusOneAllowed: p.plusOneAllowed,
          dietary: p.dietary,
          tags: p.tags,
          mealStarter: p.mealStarter,
          mealMain: p.mealMain,
          mealDessert: p.mealDessert,
          rsvpLink: p.rsvpLink,
          notes: p.notes,
          songs: p.songs,
        },
        optOutForRow,
      );
      const data: Record<string, unknown> = { ...merge.data };

      // Seat assignment: only fill if the existing guest is unseated.
      // (Not part of `decideGuestMerge` — depends on table-state map.)
      if (!existing.tableSeatId && p.tableName && tableByName.has(p.tableName)) {
        const state = tableByName.get(p.tableName)!;
        const freeSeat = state.seats.find((s) => !s.occupiedByGuestId);
        if (freeSeat) {
          data.tableSeatId = freeSeat.id;
          freeSeat.occupiedByGuestId = existing.id;
        }
      }

      if (Object.keys(data).length > 0) {
        await db.guest.update({ where: { id: existing.id }, data });
      }

      if (merge.songsToAdd.length > 0) {
        await db.songRequest.createMany({
          data: merge.songsToAdd.map((s) => ({ guestId: existing.id, title: s })),
        });
        songsCount += merge.songsToAdd.length;
      }

      updatedCount++;
      continue;
    }

    // ── Create path ───────────────────────────────────────────────
    let tableSeatId: string | null = null;
    if (p.tableName && tableByName.has(p.tableName)) {
      const state = tableByName.get(p.tableName)!;
      const freeSeat = state.seats.find((s) => !s.occupiedByGuestId);
      if (freeSeat) {
        tableSeatId = freeSeat.id;
        // Reserve so the next imported guest at this table doesn't clash.
        // Real guestId backfilled after the create call below.
        freeSeat.occupiedByGuestId = "pending";
      }
    }

    const guest = await db.guest.create({
      data: {
        householdId,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        side: p.side,
        rsvp: p.rsvp,
        isChild: p.isChild,
        needsHighchair: p.needsHighchair,
        childrenMeal: p.childrenMeal,
        plusOneAllowed: p.plusOneAllowed,
        plusOneName: p.plusOneName,
        role: p.role,
        dietary: p.dietary,
        tags: p.tags,
        mealStarter: p.mealStarter,
        mealMain: p.mealMain,
        mealDessert: p.mealDessert,
        rsvpUniqueLink: p.rsvpLink,
        notes: p.notes,
        tableSeatId,
      },
    });

    if (tableSeatId && p.tableName) {
      const state = tableByName.get(p.tableName);
      if (state) {
        const seat = state.seats.find((s) => s.id === tableSeatId);
        if (seat) seat.occupiedByGuestId = guest.id;
      }
    }

    if (p.songs.length > 0) {
      await db.songRequest.createMany({
        data: p.songs.map((s) => ({ guestId: guest.id, title: s })),
      });
      songsCount += p.songs.length;
    }

    // Add to map so a later row in the same import targeting the same
    // (household, name) merges into this brand-new row instead of
    // creating yet another duplicate.
    if (matchKey) {
      guestByKey.set(matchKey, {
        id: guest.id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone,
        side: guest.side,
        rsvp: guest.rsvp,
        isChild: guest.isChild,
        needsHighchair: guest.needsHighchair,
        childrenMeal: guest.childrenMeal,
        plusOneAllowed: guest.plusOneAllowed,
        plusOneName: guest.plusOneName,
        role: guest.role,
        dietary: guest.dietary,
        tags: guest.tags,
        mealStarter: guest.mealStarter,
        mealMain: guest.mealMain,
        mealDessert: guest.mealDessert,
        rsvpUniqueLink: guest.rsvpUniqueLink,
        notes: guest.notes,
        tableSeatId: guest.tableSeatId,
        household: { name: p.householdName ?? "" },
        songRequests: p.songs.map((title) => ({ title })),
      });
    }

    createdCount++;
  }

  await audit(user, {
    action: "import",
    entity: "Guest",
    metadata: {
      created: createdCount,
      updated: updatedCount,
      skipped: dataRows.length - createdCount - updatedCount,
      songs: songsCount,
      newHouseholds: newlyCreatedHouseholds,
      newTables: createdTablesCount,
      // Per-field opt-outs from the preview UI. Lets a future operator
      // grep for "user un-ticked dietary on 3 merge rows in the Apr 28
      // import".
      optOuts: totalOptOuts,
    },
  });

  revalidatePath("/guests");
  revalidatePath("/seating");
  revalidatePath("/songs");
  revalidatePath("/");

  return {
    created: createdCount,
    updated: updatedCount,
    skipped: dataRows.length - createdCount - updatedCount,
    songs: songsCount,
    tables: createdTablesCount,
    optOuts: totalOptOuts,
  };
}
