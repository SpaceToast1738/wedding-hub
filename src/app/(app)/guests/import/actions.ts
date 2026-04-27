"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
import {
  type GuestField,
  coerceBool,
  coerceDietary,
  coerceRsvp,
  coerceSide,
  parseCsv,
} from "@/lib/csv";

export type ImportRowPreview = {
  rowIndex: number; // 1-based, excluding header
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  householdName: string | null;
  side: "BRIDE" | "GROOM" | "BOTH";
  rsvp: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
  isChild: boolean;
  plusOneAllowed: boolean;
  plusOneName: string | null;
  role: string | null;
  dietary: string[];
  notes: string | null;
  errors: string[];
  warnings: string[];
  // Resolved against the existing DB at preview time:
  householdAction: "create" | "merge" | null; // null if no household name
};

export type ImportPreview = {
  rows: ImportRowPreview[];
  newHouseholds: string[];
  existingHouseholds: string[];
  totalGuests: number;
  validGuests: number;
  rowErrors: number;
};

const fieldEnum = z.enum([
  "firstName",
  "lastName",
  "email",
  "phone",
  "household",
  "side",
  "rsvp",
  "isChild",
  "plusOneAllowed",
  "plusOneName",
  "role",
  "dietary",
  "notes",
  "ignore",
]);

const inputSchema = z.object({
  text: z.string().min(1).max(500_000),
  mapping: z.array(fieldEnum),
});

function buildRowPreview(
  rawRow: string[],
  mapping: GuestField[],
  rowIndex: number,
): Omit<ImportRowPreview, "householdAction"> {
  const get = (field: GuestField): string => {
    const idx = mapping.indexOf(field);
    if (idx === -1) return "";
    return (rawRow[idx] ?? "").trim();
  };

  const firstName = get("firstName");
  const lastName = get("lastName");
  const email = get("email") || null;
  const phone = get("phone") || null;
  const householdName = get("household") || null;
  const sideRaw = get("side");
  const rsvpRaw = get("rsvp");
  const isChildRaw = get("isChild");
  const plusOneAllowedRaw = get("plusOneAllowed");
  const plusOneName = get("plusOneName") || null;
  const role = get("role") || null;
  const dietaryRaw = get("dietary");
  const notes = get("notes") || null;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!firstName) errors.push("missing first name");
  if (!lastName) errors.push("missing last name");
  if (firstName.length > 100) errors.push("first name too long (max 100)");
  if (lastName.length > 100) errors.push("last name too long (max 100)");

  if (email) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      warnings.push(`email "${email}" looks malformed — importing as-is`);
    }
  }

  let isChild = false;
  if (isChildRaw) {
    const v = coerceBool(isChildRaw);
    if (v === null) warnings.push(`couldn't parse "is child" value "${isChildRaw}", treating as no`);
    else isChild = v;
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
    side: coerceSide(sideRaw),
    rsvp: coerceRsvp(rsvpRaw),
    isChild,
    plusOneAllowed,
    plusOneName,
    role,
    dietary: coerceDietary(dietaryRaw),
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
    return { rows: [], newHouseholds: [], existingHouseholds: [], totalGuests: 0, validGuests: 0, rowErrors: 0 };
  }

  // First row is the header. Skip it for guest rows.
  const dataRows = rows.slice(1);

  const previews = dataRows.map((row, i) => buildRowPreview(row, parsed.mapping as GuestField[], i + 1));

  const householdNames = new Set(
    previews.map((p) => p.householdName).filter((n): n is string => !!n),
  );
  const existing = await db.household.findMany({
    where: { name: { in: Array.from(householdNames) } },
    select: { id: true, name: true },
  });
  const existingSet = new Set(existing.map((h) => h.name));

  const decorated: ImportRowPreview[] = previews.map((p) => ({
    ...p,
    householdAction: p.householdName
      ? existingSet.has(p.householdName)
        ? "merge"
        : "create"
      : null,
  }));

  const validGuests = decorated.filter((p) => p.errors.length === 0).length;
  const rowErrors = decorated.length - validGuests;

  const newHouseholds = Array.from(householdNames).filter((n) => !existingSet.has(n));
  const existingHouseholds = Array.from(householdNames).filter((n) => existingSet.has(n));

  return {
    rows: decorated,
    newHouseholds,
    existingHouseholds,
    totalGuests: decorated.length,
    validGuests,
    rowErrors,
  };
}

export async function commitImport(input: {
  text: string;
  mapping: GuestField[];
}): Promise<{ created: number; skipped: number }> {
  const user = await requireEdit("guests");
  const parsed = inputSchema.parse(input);

  const rows = parseCsv(parsed.text);
  if (rows.length === 0) return { created: 0, skipped: 0 };

  const dataRows = rows.slice(1);
  const previews = dataRows
    .map((row, i) => buildRowPreview(row, parsed.mapping as GuestField[], i + 1))
    .filter((p) => p.errors.length === 0);

  if (previews.length === 0) {
    return { created: 0, skipped: dataRows.length };
  }

  // Resolve / create households first. Match by exact name.
  const householdNames = Array.from(
    new Set(previews.map((p) => p.householdName).filter((n): n is string => !!n)),
  );
  const existingHouseholds = await db.household.findMany({
    where: { name: { in: householdNames } },
  });
  const householdByName = new Map(existingHouseholds.map((h) => [h.name, h]));

  // Group preview rows by household so newly-created households can pick up
  // the most-popular `side` value from their members. (e.g. if 4 of 5 members
  // are bride-side, the household defaults to BRIDE.)
  const newHouseholdsToCreate = householdNames.filter((n) => !householdByName.has(n));
  for (const name of newHouseholdsToCreate) {
    const members = previews.filter((p) => p.householdName === name);
    const counts = { BRIDE: 0, GROOM: 0, BOTH: 0 };
    for (const m of members) counts[m.side]++;
    const dominantSide: "BRIDE" | "GROOM" | "BOTH" =
      counts.BRIDE >= counts.GROOM && counts.BRIDE >= counts.BOTH
        ? "BRIDE"
        : counts.GROOM >= counts.BOTH
          ? "GROOM"
          : "BOTH";
    const created = await db.household.create({
      data: { name, side: dominantSide },
    });
    householdByName.set(name, created);
  }

  // Rows without an explicit household → unique household per guest, named
  // "FirstName LastName". Avoids dumping unfiled rows into one giant pile.
  let createdCount = 0;
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

    await db.guest.create({
      data: {
        householdId,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        side: p.side,
        rsvp: p.rsvp,
        isChild: p.isChild,
        plusOneAllowed: p.plusOneAllowed,
        plusOneName: p.plusOneName,
        role: p.role,
        dietary: p.dietary,
        notes: p.notes,
      },
    });
    createdCount++;
  }

  await audit(user, {
    action: "import",
    entity: "Guest",
    metadata: {
      created: createdCount,
      skipped: dataRows.length - createdCount,
      newHouseholds: newHouseholdsToCreate,
    },
  });

  revalidatePath("/guests");
  revalidatePath("/");

  return { created: createdCount, skipped: dataRows.length - createdCount };
}
