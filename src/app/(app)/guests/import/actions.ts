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
  emailDuplicate: boolean;
};

export type ImportPreview = {
  rows: ImportRowPreview[];
  newHouseholds: string[];
  existingHouseholds: string[];
  newTables: string[];
  existingTables: string[];
  totalGuests: number;
  validGuests: number;
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
): Omit<ImportRowPreview, "householdAction" | "tableAction" | "emailDuplicate"> {
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

  const [existingHouseholds, existingTables, existingEmails] = await Promise.all([
    db.household.findMany({ where: { name: { in: householdNames } }, select: { name: true } }),
    db.table.findMany({ where: { name: { in: tableNames } }, select: { name: true } }),
    db.guest.findMany({ where: { email: { in: emails } }, select: { email: true } }),
  ]);
  const existingHouseholdSet = new Set(existingHouseholds.map((h) => h.name));
  const existingTableSet = new Set(existingTables.map((t) => t.name));
  const existingEmailSet = new Set(
    existingEmails.map((e) => e.email).filter((e): e is string => !!e),
  );

  const decorated: ImportRowPreview[] = previews.map((p) => {
    const isDup = !!p.email && existingEmailSet.has(p.email);
    return {
      ...p,
      warnings: isDup
        ? [
            ...p.warnings,
            // Important: this only checks the Guest table, not User accounts.
            // User sign-in identities and wedding-Guest rows live in separate
            // tables — having a User row with the same email does NOT trigger
            // this warning.
            `another Guest row already has this email — importing will create a second guest row`,
          ]
        : p.warnings,
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
      emailDuplicate: isDup,
    };
  });

  const validGuests = decorated.filter((p) => p.errors.length === 0).length;

  return {
    rows: decorated,
    newHouseholds: householdNames.filter((n) => !existingHouseholdSet.has(n)),
    existingHouseholds: householdNames.filter((n) => existingHouseholdSet.has(n)),
    newTables: tableNames.filter((n) => !existingTableSet.has(n)),
    existingTables: tableNames.filter((n) => existingTableSet.has(n)),
    totalGuests: decorated.length,
    validGuests,
    rowErrors: decorated.length - validGuests,
    duplicateEmails: decorated.filter((p) => p.emailDuplicate).length,
  };
}

export async function commitImport(input: {
  text: string;
  mapping: GuestField[];
}): Promise<{ created: number; skipped: number; songs: number; tables: number }> {
  const user = await requireEdit("guests");
  const parsed = inputSchema.parse(input);

  const rows = parseCsv(parsed.text);
  if (rows.length === 0) return { created: 0, skipped: 0, songs: 0, tables: 0 };

  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const allPreviews = dataRows.map((row, i) =>
    buildRowPreview(row, parsed.mapping as GuestField[], headers, i + 1),
  );
  const previews = allPreviews.filter((p) => p.errors.length === 0);

  if (previews.length === 0) {
    return { created: 0, skipped: dataRows.length, songs: 0, tables: 0 };
  }

  // ── Resolve / create households ────────────────────────────────────────
  const householdNames = Array.from(
    new Set(previews.map((p) => p.householdName).filter((n): n is string => !!n)),
  );
  const existingHouseholds = await db.household.findMany({
    where: { name: { in: householdNames } },
  });
  const householdByName = new Map(existingHouseholds.map((h) => [h.name, h]));
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

  // ── Create guests, song requests, and seat assignments ────────────────
  let createdCount = 0;
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

    createdCount++;
  }

  await audit(user, {
    action: "import",
    entity: "Guest",
    metadata: {
      created: createdCount,
      skipped: dataRows.length - createdCount,
      songs: songsCount,
      newHouseholds: newlyCreatedHouseholds,
      newTables: createdTablesCount,
    },
  });

  revalidatePath("/guests");
  revalidatePath("/seating");
  revalidatePath("/songs");
  revalidatePath("/");

  return {
    created: createdCount,
    skipped: dataRows.length - createdCount,
    songs: songsCount,
    tables: createdTablesCount,
  };
}
