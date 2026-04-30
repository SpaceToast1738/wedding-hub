"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RsvpStatus, Side } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
import { decidePlusOneAction } from "@/lib/plus-one";
import { diffEditedFields, mergeEditedFields, type EditedFieldsMap } from "@/lib/last-edited-fields";
import {
  parseCustomFieldValue,
  mergeCustomFieldValue,
  type CustomFieldDef,
  type CustomFieldType,
  type CustomFieldValues,
} from "@/lib/custom-fields";

const householdSchema = z.object({
  name: z.string().min(1).max(200),
  side: z.nativeEnum(Side).default(Side.BOTH),
  notes: z.string().max(2000).optional().nullable(),
});

const guestSchema = z.object({
  householdId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  rsvp: z.nativeEnum(RsvpStatus).default(RsvpStatus.PENDING),
  side: z.nativeEnum(Side).default(Side.BOTH),
  isChild: z.boolean().optional(),
  needsHighchair: z.boolean().optional(),
  plusOneAllowed: z.boolean().optional(),
  plusOneName: z.string().max(200).optional().nullable(),
  role: z.string().max(100).optional().nullable(),
  dietary: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

function readDietary(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

// ── +1 materialisation ────────────────────────────────────────────────────
//
// When a host has plusOneAllowed=true AND plusOneName is non-empty, we
// materialise a child Guest row linked via parentGuestId. The +1 row:
//   - is a real Guest, so it shows up in totals (Today, Glance, catering
//     brief, etc.) without any special-casing
//   - inherits householdId, side, rsvp, archived from the host (synced on
//     every host update via this helper)
//   - has its first/last name derived from the host's plusOneName field
//     — the host is the source of truth for the name; the +1 row's name
//     fields are display-only
//   - keeps independent dietary, meal, song-request, table-seat data
//
// Edge cases:
//   - plusOneAllowed flips to false OR plusOneName cleared → archive the
//     existing +1 row (don't hard-delete; preserves dietary/meal data
//     in case it comes back)
//   - host archived → +1 archived (cascaded from caller)
//   - host hard-deleted → +1 cascade-deleted by the FK
//   - +1 itself can't have a +1 (we don't recurse)
//
// Pure decision logic lives at @/lib/plus-one (testable without
// pulling in next-auth/Prisma). This wrapper does the DB I/O around it.

async function syncPlusOne(hostId: string): Promise<void> {
  const host = await db.guest.findUnique({
    where: { id: hostId },
    select: {
      id: true,
      householdId: true,
      side: true,
      rsvp: true,
      plusOneAllowed: true,
      plusOneName: true,
      parentGuestId: true,
    },
  });
  if (!host) return;

  const childRow = await db.guest.findFirst({
    where: { parentGuestId: host.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, archived: true },
  });

  const action = decidePlusOneAction(host, childRow);
  switch (action.kind) {
    case "noop":
      return;
    case "create":
      await db.guest.create({ data: action.data });
      return;
    case "update":
      await db.guest.update({ where: { id: action.childId }, data: action.data });
      return;
    case "archive":
      await db.guest.update({
        where: { id: action.childId },
        data: { archived: true, tableSeatId: null },
      });
      return;
  }
}

export async function createHousehold(formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = householdSchema.parse({
    name: formData.get("name"),
    side: formData.get("side") || Side.BOTH,
    notes: formData.get("notes") || null,
  });
  const created = await db.household.create({
    data: { name: parsed.name, side: parsed.side, notes: parsed.notes ?? null },
  });
  await audit(user, {
    action: "create",
    entity: "Household",
    entityId: created.id,
    metadata: { name: created.name, side: created.side },
  });
  revalidatePath("/guests");
}

export async function updateHousehold(id: string, formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = householdSchema.parse({
    name: formData.get("name"),
    side: formData.get("side") || Side.BOTH,
    notes: formData.get("notes") || null,
  });
  // Read before for the changedFields diff.
  const before = await db.household.findUnique({ where: { id } });
  const next = { name: parsed.name, side: parsed.side, notes: parsed.notes ?? null };
  await db.household.update({ where: { id }, data: next });
  const changedFields: string[] = [];
  if (before) {
    if (before.name !== next.name) changedFields.push("name");
    if (before.side !== next.side) changedFields.push("side");
    if (before.notes !== next.notes) changedFields.push("notes");
  }
  await audit(user, {
    action: "update",
    entity: "Household",
    entityId: id,
    metadata: { name: next.name, changedFields },
  });
  revalidatePath("/guests");
}

export async function deleteHousehold(id: string) {
  const user = await requireEdit("guests");
  // Snapshot name + guest count before delete.
  const before = await db.household.findUnique({
    where: { id },
    include: { _count: { select: { guests: true } } },
  });
  await db.household.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "Household",
    entityId: id,
    metadata: {
      name: before?.name ?? null,
      side: before?.side ?? null,
      guestCount: before?._count.guests ?? 0,
    },
  });
  revalidatePath("/guests");
}

export async function createGuest(formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = guestSchema.parse({
    householdId: formData.get("householdId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    rsvp: formData.get("rsvp") || RsvpStatus.PENDING,
    side: formData.get("side") || Side.BOTH,
    isChild: formData.get("isChild") === "on",
    needsHighchair: formData.get("needsHighchair") === "on",
    plusOneAllowed: formData.get("plusOneAllowed") === "on",
    plusOneName: formData.get("plusOneName") || null,
    role: formData.get("role") || null,
    dietary: formData.get("dietary") || null,
    notes: formData.get("notes") || null,
  });
  const created = await db.guest.create({
    data: {
      householdId: parsed.householdId,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email || null,
      phone: parsed.phone ?? null,
      rsvp: parsed.rsvp,
      side: parsed.side,
      isChild: !!parsed.isChild,
      needsHighchair: !!parsed.needsHighchair,
      plusOneAllowed: !!parsed.plusOneAllowed,
      plusOneName: parsed.plusOneName ?? null,
      role: parsed.role ?? null,
      dietary: readDietary(parsed.dietary ?? null),
      notes: parsed.notes ?? null,
    },
  });
  await syncPlusOne(created.id);
  await audit(user, {
    action: "create",
    entity: "Guest",
    entityId: created.id,
    metadata: {
      firstName: created.firstName,
      lastName: created.lastName,
      side: created.side,
      rsvp: created.rsvp,
      isChild: created.isChild,
      plusOneAllowed: created.plusOneAllowed,
    },
  });
  revalidatePath("/guests");
  revalidatePath("/");
}

export async function updateGuest(id: string, formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = guestSchema.parse({
    householdId: formData.get("householdId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    rsvp: formData.get("rsvp") || RsvpStatus.PENDING,
    side: formData.get("side") || Side.BOTH,
    isChild: formData.get("isChild") === "on",
    needsHighchair: formData.get("needsHighchair") === "on",
    plusOneAllowed: formData.get("plusOneAllowed") === "on",
    plusOneName: formData.get("plusOneName") || null,
    role: formData.get("role") || null,
    dietary: formData.get("dietary") || null,
    notes: formData.get("notes") || null,
  });

  // If this guest is itself a +1 (parentGuestId set), force the +1
  // fields off — a +1 can't have a +1 of its own. The host is the only
  // place plusOneAllowed / plusOneName can be set.
  const existing = await db.guest.findUnique({
    where: { id },
    // C4: also pull the fields we're about to overwrite + the existing
    // edit-tracking map so we can stamp only fields that actually
    // changed.
    select: {
      parentGuestId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      rsvp: true,
      side: true,
      isChild: true,
      needsHighchair: true,
      plusOneAllowed: true,
      plusOneName: true,
      role: true,
      dietary: true,
      notes: true,
      lastEditedFields: true,
    },
  });
  const isPlusOne = !!existing?.parentGuestId;
  const plusOneAllowed = isPlusOne ? false : !!parsed.plusOneAllowed;
  const plusOneName = isPlusOne ? null : (parsed.plusOneName ?? null);

  const nextValues = {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    email: parsed.email || null,
    phone: parsed.phone ?? null,
    rsvp: parsed.rsvp,
    side: parsed.side,
    isChild: !!parsed.isChild,
    needsHighchair: !!parsed.needsHighchair,
    plusOneAllowed,
    plusOneName,
    role: parsed.role ?? null,
    dietary: readDietary(parsed.dietary ?? null),
    notes: parsed.notes ?? null,
  };
  // C4 (v1.14.0): record per-field manual-edit timestamps so the CSV
  // import preview can warn before overwriting a recent edit.
  const changed = existing
    ? diffEditedFields(
        existing as Record<string, unknown>,
        nextValues as Record<string, unknown>,
      )
    : Object.keys(nextValues);
  const lastEditedFields =
    changed.length > 0
      ? mergeEditedFields(
          (existing?.lastEditedFields as EditedFieldsMap | null) ?? null,
          changed,
        )
      : undefined;

  await db.guest.update({
    where: { id },
    data: {
      ...nextValues,
      ...(lastEditedFields !== undefined && { lastEditedFields }),
    },
  });

  // Cascade to the +1 if this is a host. syncPlusOne short-circuits if
  // the row is itself a +1 (parentGuestId set), so it's safe to call
  // unconditionally.
  await syncPlusOne(id);
  // v1.39.0: enrich with name + the actual changed field names. The
  // diffEditedFields call above already computed `changed` for the
  // last-edited-fields stamp; reuse that list here so the audit row
  // and the lastEditedFields map agree.
  await audit(user, {
    action: "update",
    entity: "Guest",
    entityId: id,
    metadata: {
      firstName: nextValues.firstName,
      lastName: nextValues.lastName,
      changedFields: changed,
    },
  });
  revalidatePath("/guests");
  revalidatePath("/");
}

export async function setGuestRsvp(id: string, rsvp: RsvpStatus) {
  const user = await requireEdit("guests");
  await db.guest.update({
    where: { id },
    data: {
      rsvp,
      attending: rsvp === RsvpStatus.ATTENDING ? true : rsvp === RsvpStatus.DECLINED ? false : null,
    },
  });
  // Cascade to any +1 — host RSVP is the source of truth for the +1's
  // RSVP. (A +1's own RSVP can be set independently via this same
  // action, but the next host RSVP change will overwrite it.)
  await syncPlusOne(id);
  // Add name to the RSVP audit so the log reads as "Set RSVP for
  // <name> to attending" rather than just an id.
  const guest = await db.guest.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  });
  await audit(user, {
    action: "rsvp",
    entity: "Guest",
    entityId: id,
    metadata: {
      rsvp,
      firstName: guest?.firstName ?? null,
      lastName: guest?.lastName ?? null,
    },
  });
  revalidatePath("/guests");
  revalidatePath("/");
}

// Soft-archive — was previously a hard delete, but the audit (R1)
// flagged the lack of undo as a real risk on the wedding day. Default
// flow now sets `archived = true`; the row is hidden from default
// views but can be restored. Their tableSeat is freed at the same
// time so the seat goes back into the pool.
export async function deleteGuest(id: string) {
  const user = await requireEdit("guests");
  const guest = await db.guest.findUnique({
    where: { id },
    select: { firstName: true, lastName: true, tableSeatId: true },
  });
  if (!guest) return;
  // Archive the host AND any of its +1 rows in a single transaction so
  // the totals never see a half-archived household. Free both seats.
  await db.$transaction([
    db.guest.update({
      where: { id },
      data: { archived: true, tableSeatId: null },
    }),
    db.guest.updateMany({
      where: { parentGuestId: id },
      data: { archived: true, tableSeatId: null },
    }),
  ]);
  await audit(user, {
    action: "archive",
    entity: "Guest",
    entityId: id,
    metadata: {
      firstName: guest.firstName,
      lastName: guest.lastName,
      hadSeat: guest.tableSeatId !== null,
    },
  });
  revalidatePath("/guests");
  revalidatePath("/seating");
  revalidatePath("/");
}

// Bring an archived guest back. Their seat does NOT auto-reassign —
// that would be surprising — they come back unseated and the user
// reseats them via the Seating page. If the guest was a host with
// archived +1 rows, those come back too (archiving was atomic; restore
// is symmetric).
export async function restoreGuest(id: string) {
  const user = await requireEdit("guests");
  await db.$transaction([
    db.guest.update({ where: { id }, data: { archived: false } }),
    db.guest.updateMany({
      where: { parentGuestId: id },
      data: { archived: false },
    }),
  ]);
  const restored = await db.guest.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  });
  await audit(user, {
    action: "restore",
    entity: "Guest",
    entityId: id,
    metadata: {
      firstName: restored?.firstName ?? null,
      lastName: restored?.lastName ?? null,
    },
  });
  revalidatePath("/guests");
  revalidatePath("/");
}

// Couple-only escape hatch for actually wiping a guest from the DB
// (e.g. cleanup of a typo'd row). The archived view exposes this on
// each row alongside Restore. Doesn't go through `requireEdit` alone
// — also gated on `user.isCouple` so a non-couple EDIT-on-guests user
// can't bypass the soft-delete guarantee.
export async function hardDeleteGuest(id: string) {
  const user = await requireEdit("guests");
  if (!user.isCouple) {
    await audit(user, {
      action: "guests_denied",
      entity: "Guest",
      entityId: id,
      metadata: { reason: "not_couple", target_action: "hardDeleteGuest" },
    });
    throw new Error("Forbidden: only the couple can permanently delete a guest");
  }
  const guest = await db.guest.findUnique({
    where: { id },
    select: { firstName: true, lastName: true, archived: true },
  });
  if (!guest) return;
  if (!guest.archived) {
    throw new Error("Archive the guest first; only archived guests can be permanently deleted.");
  }
  await db.guest.delete({ where: { id } });
  await audit(user, {
    action: "hard_delete",
    entity: "Guest",
    entityId: id,
    metadata: { firstName: guest.firstName, lastName: guest.lastName },
  });
  revalidatePath("/guests");
  revalidatePath("/");
}

// ── B9 (v1.13.0): inline song-request add on guest detail ─────────────────
//
// The guest detail page used to deep-link to /songs for any add — fine
// for batch data entry, friction for the "while I'm looking at Aunt
// Margaret's row, capture her request" flow Aimee surfaced. This action
// creates a song request for a specific guest, gated on guests-EDIT
// (matches the rest of the guest write surface; songs has its own
// section but the row is owned by the guest).

const songRequestSchema = z.object({
  guestId: z.string().min(1),
  title: z.string().min(1).max(200),
  artist: z.string().max(200).optional().nullable(),
});

export async function addSongRequestForGuest(formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = songRequestSchema.parse({
    guestId: formData.get("guestId"),
    title: formData.get("title"),
    artist: formData.get("artist") || null,
  });
  // Sanity: guest must exist and not be archived. Stops a stale form
  // from creating an orphan request after the guest was deleted in
  // another tab.
  const guest = await db.guest.findUnique({
    where: { id: parsed.guestId },
    select: { id: true, archived: true },
  });
  if (!guest || guest.archived) throw new Error("Guest not found");

  const created = await db.songRequest.create({
    data: {
      guestId: parsed.guestId,
      title: parsed.title.trim(),
      artist: parsed.artist?.trim() || null,
    },
  });
  await audit(user, {
    action: "create",
    entity: "SongRequest",
    entityId: created.id,
    metadata: { guestId: parsed.guestId, title: created.title },
  });
  revalidatePath(`/guests/${parsed.guestId}`);
  revalidatePath("/songs");
}

// ── C10 (v1.15.0): per-guest custom field value writes ────────────────────
//
// One field at a time. Settings UI defines the shape; this writes a
// single value into the Guest's `customFieldValues` JSON column. Type
// validation lives in `parseCustomFieldValue` so the parsed/typed value
// is what lands on disk.

export async function setGuestCustomField(
  guestId: string,
  fieldId: string,
  rawValue: string | null,
) {
  const user = await requireEdit("guests");
  const def = await db.customField.findUnique({ where: { id: fieldId } });
  if (!def || def.entity !== "guest") {
    throw new Error("Custom field not found for this entity");
  }
  const guest = await db.guest.findUnique({
    where: { id: guestId },
    select: { customFieldValues: true, archived: true },
  });
  if (!guest) throw new Error("Guest not found");
  if (guest.archived) throw new Error("Guest is archived");

  const typedDef: CustomFieldDef = {
    id: def.id,
    entity: def.entity,
    name: def.name,
    type: def.type as CustomFieldType,
    options: def.options,
    order: def.order,
  };
  const value = parseCustomFieldValue(typedDef, rawValue);
  const next = mergeCustomFieldValue(
    (guest.customFieldValues as CustomFieldValues | null) ?? null,
    fieldId,
    value,
  );
  await db.guest.update({
    where: { id: guestId },
    data: { customFieldValues: next },
  });
  await audit(user, {
    action: "update",
    entity: "Guest",
    entityId: guestId,
    metadata: { customField: def.name, fieldId },
  });
  revalidatePath(`/guests/${guestId}`);
}
