// v2.8.0: session-free cores for the guest write surface (T1 self-apply).
//
// The MCP agent applies its own proposals over token auth — no Auth.js
// session exists on that path, so the entity-writing halves of the
// guest actions can't live behind `requireEdit()` in a "use server"
// file. They live here instead, taking an explicit `user: SessionUser`.
//
// Contract (same as the chat-loop extraction):
// - Cores do NOT authenticate. Callers own the gate: server-action
//   wrappers in src/app/(app)/guests/actions.ts run requireEdit("guests")
//   before delegating; the AI apply dispatch passes its already-verified
//   user. NEVER export these from a "use server" file — any export
//   there becomes a client-invokable action, and a core that skips
//   auth would be a forged-user endpoint.
// - Cores keep EVERYTHING after the parse: db writes, cascades
//   (syncPlusOne), audit rows, revalidatePath calls (legal in both
//   server actions and route handlers), and return values — so human
//   flows through the wrappers stay byte-identical.
// - Cores take the action-schema parse OUTPUT. Wrappers parse
//   FormData; the AI apply path parses its payload through the same
//   exported schemas so validation is identical on both routes.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RsvpStatus, Side } from "@prisma/client";
import { db } from "@/lib/db";
// Type-only import from actions: a VALUE import would drag the
// @/auth (next-auth) module graph into every registry consumer.
import type { SessionUser } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { decidePlusOneAction } from "@/lib/plus-one";
import {
  diffEditedFields,
  mergeEditedFields,
  type EditedFieldsMap,
} from "@/lib/last-edited-fields";

// v1.53.0 (C1): result-shape return so callers can render a real error
// toast instead of relying on Next prod redaction. Same structural
// shape as the DeleteResult declared in guests/actions.ts (each domain
// declares its own — they're interchangeable by structure).
export type DeleteResult = { ok: true } | { ok: false; error: string };

// v2.8.0: moved verbatim from src/app/(app)/guests/actions.ts (where
// they were module-private) so both the wrapper and the AI apply path
// validate against the SAME shape. Named *InputSchema to keep them
// visually distinct from the AI payload schemas in
// src/lib/ai/proposals/schemas.ts (guestCreateSchema etc.).
export const householdInputSchema = z.object({
  name: z.string().min(1).max(200),
  side: z.nativeEnum(Side).default(Side.BOTH),
  notes: z.string().max(2000).optional().nullable(),
});
export type HouseholdInput = z.infer<typeof householdInputSchema>;

export const guestInputSchema = z.object({
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
  // v2.8.1: per-course meal choices. OPTIONAL (not just nullable) is
  // load-bearing: the human createGuest/updateGuest FormData path never
  // posts these keys, so they parse as `undefined` and updateGuestCore
  // leaves the CSV-imported meal choices untouched (see the wipe-hazard
  // note there). The AI apply path always defines all three via
  // patch-or-current, so an AI guest.update writes them.
  mealStarter: z.string().max(200).optional().nullable(),
  mealMain: z.string().max(200).optional().nullable(),
  mealDessert: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type GuestInput = z.infer<typeof guestInputSchema>;

export function readDietary(s: string | null | undefined): string[] {
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
//
// v2.8.0: moved here (exported) because createGuestCore needs it AND
// the remaining guest actions (updateGuest / setGuestRsvp) still call
// it — one implementation, shared from the only file that may legally
// export a non-action.

export async function syncPlusOne(hostId: string): Promise<void> {
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

export async function createHouseholdCore(
  user: SessionUser,
  parsed: HouseholdInput,
): Promise<{ id: string }> {
  const created = await db.household.create({
    data: { name: parsed.name, side: parsed.side, notes: parsed.notes ?? null },
  });
  await logAudit({
    userId: user.id,
    action: "create",
    entity: "Household",
    entityId: created.id,
    metadata: { name: created.name, side: created.side },
  });
  revalidatePath("/guests");
  // v2.1.0 phase 3: return id so applyProposal can chain a
  // createGuest into the same household.
  return { id: created.id };
}

export async function createGuestCore(
  user: SessionUser,
  parsed: GuestInput,
): Promise<{ id: string }> {
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
  await logAudit({
    userId: user.id,
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
  // v2.1.0 phase 3: return id so applyProposal can link the row.
  return { id: created.id };
}

// v2.8.0: extracted body of updateGuest (the full-record guest edit)
// — the wrapper in guests/actions.ts parses FormData + gates
// requireEdit("guests"), then delegates here. Everything a human save
// did (the +1-force-off guard, the last-edited-fields stamp, the
// syncPlusOne cascade, the enriched audit row, the revalidations)
// happens here so the AI apply path and the form path cannot drift.
export async function updateGuestCore(
  user: SessionUser,
  id: string,
  parsed: GuestInput,
): Promise<void> {
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
      // v2.8.1: pull the current meal choices so diffEditedFields can
      // compare an AI-supplied meal patch against them (otherwise an
      // unchanged AI meal value would read as a fresh edit).
      mealStarter: true,
      mealMain: true,
      mealDessert: true,
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
  // v2.8.1 (CRITICAL wipe hazard): meal fields are written ONLY when
  // the parse defined them. The human createGuest/updateGuest FormData
  // path omits the meal keys entirely, so they parse as `undefined` and
  // never appear in this patch — a plain guest save leaves the
  // CSV-imported meal choices intact. The AI apply path (applyGuestUpdate)
  // always defines all three via patch-or-current, so an AI edit writes
  // them. Writing them unconditionally in nextValues would blank a meal
  // on every form save.
  const mealPatch: {
    mealStarter?: string | null;
    mealMain?: string | null;
    mealDessert?: string | null;
  } = {};
  if (parsed.mealStarter !== undefined) mealPatch.mealStarter = parsed.mealStarter;
  if (parsed.mealMain !== undefined) mealPatch.mealMain = parsed.mealMain;
  if (parsed.mealDessert !== undefined) mealPatch.mealDessert = parsed.mealDessert;

  // C4 (v1.14.0): record per-field manual-edit timestamps so the CSV
  // import preview can warn before overwriting a recent edit. Diff the
  // meal patch too (only the fields actually being written) so an AI
  // meal change is stamped like any other edit.
  const diffTarget = { ...nextValues, ...mealPatch };
  const changed = existing
    ? diffEditedFields(
        existing as Record<string, unknown>,
        diffTarget as Record<string, unknown>,
      )
    : Object.keys(diffTarget);
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
      ...mealPatch,
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
  await logAudit({
    userId: user.id,
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

// v2.8.0: extracted body of setGuestRsvp. RSVP is the only field this
// touches; it keeps `attending` in sync and cascades the host's RSVP
// to any +1. Wrapper parses/gates, then delegates here.
export async function setGuestRsvpCore(
  user: SessionUser,
  id: string,
  rsvp: RsvpStatus,
): Promise<void> {
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
  await logAudit({
    userId: user.id,
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

// v2.8.0: extracted body of deleteGuest (the SOFT archive). Archives
// the host AND any +1 rows atomically, freeing both seats, then audits
// and revalidates. Returns the DeleteResult shape so the wrapper (and
// the AI apply path, via ensureOk) surfaces a real error instead of a
// silent no-op. Wrapper gates requireEdit("guests"), then delegates.
export async function archiveGuestCore(
  user: SessionUser,
  id: string,
): Promise<DeleteResult> {
  try {
    const guest = await db.guest.findUnique({
      where: { id },
      select: { firstName: true, lastName: true, tableSeatId: true },
    });
    if (!guest) return { ok: true }; // already gone — idempotent
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
    await logAudit({
      userId: user.id,
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
    return { ok: true };
  } catch (err) {
    console.error("deleteGuest failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't archive guest",
    };
  }
}

// v2.8.0: extracted body of updateHousehold. Full-record household
// edit with a changedFields diff for the audit row. Wrapper parses
// FormData + gates requireEdit("guests"), then delegates here.
export async function updateHouseholdCore(
  user: SessionUser,
  id: string,
  parsed: HouseholdInput,
): Promise<void> {
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
  await logAudit({
    userId: user.id,
    action: "update",
    entity: "Household",
    entityId: id,
    metadata: { name: next.name, changedFields },
  });
  revalidatePath("/guests");
}

// v2.8.1: move a guest into a different household. Genuinely new —
// the guest form has no household picker, so no human mutator moves
// households; this core exists purely for the AI apply path (its
// caller, applyGuestMoveHousehold, owns the guests-EDIT gate + the
// archived / +1 / already-in-target refusals). Writing householdId
// then re-running syncPlusOne carries the guest's materialised +1 into
// the same household (decidePlusOneAction's update branch copies the
// host's householdId onto the child), so the household never ends up
// with a split couple.
export async function moveGuestHouseholdCore(
  user: SessionUser,
  guestId: string,
  householdId: string,
): Promise<void> {
  // Snapshot name + origin for the audit before the write.
  const [guest, household] = await Promise.all([
    db.guest.findUnique({
      where: { id: guestId },
      select: { firstName: true, lastName: true, householdId: true },
    }),
    db.household.findUnique({
      where: { id: householdId },
      select: { name: true },
    }),
  ]);
  await db.guest.update({ where: { id: guestId }, data: { householdId } });
  await syncPlusOne(guestId);
  await logAudit({
    userId: user.id,
    action: "move_household",
    entity: "Guest",
    entityId: guestId,
    metadata: {
      firstName: guest?.firstName ?? null,
      lastName: guest?.lastName ?? null,
      fromHouseholdId: guest?.householdId ?? null,
      toHouseholdId: householdId,
      toHouseholdName: household?.name ?? null,
    },
  });
  revalidatePath("/guests");
  revalidatePath("/");
}
