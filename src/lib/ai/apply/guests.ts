// v2.4.0: apply bridges for guest + household proposals.
//
// updateGuest is the most dangerous full-record action on the write
// surface: every text field is overwrite-or-clear (an omitted value
// WIPES — dietary to [], notes/email/phone/role to null), the booleans
// un-flag when omitted, an omitted rsvp resets to PENDING, an omitted
// side resets to BOTH — and a wiped plusOneAllowed/plusOneName doesn't
// just lose text: the syncPlusOne side effect ARCHIVES the +1 row and
// frees their seat. So the guest.update bridge loads the live row and
// carries every field patch-else-current.
//
// v2.8.0 (T1 self-apply): these bridges no longer round-trip through
// the human "use server" actions (updateGuest / setGuestRsvp /
// deleteGuest / updateHousehold) — those start with requireEdit(),
// which calls auth()→redirect("/signin") and throws NEXT_REDIRECT on
// the session-free MCP path. They now call the session-free cores in
// src/lib/core/guests.ts directly with the already-verified user, and
// re-assert the guests-EDIT gate HERE via requireSectionEdit (the same
// canEdit + requireEdit error string the human actions used). The
// merged full-record object is still re-parsed through guestInputSchema
// / householdInputSchema — exactly what the human actions parsed
// internally, so the .email() validation and every default stay
// byte-identical.
//
// All bridges throw on failure so applyLoadedProposal's claim-rollback
// fires. Permissions compose: caller gates ai_write, the bridge gates
// guests-EDIT.

import { RsvpStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { canEdit, type Section } from "@/lib/permissions";
// Type-only import — erased at compile time, so this module never
// pulls the @/auth graph into the MCP route bundle (same convention as
// src/lib/core/*).
import type { SessionUser } from "@/lib/actions";
import {
  guestArchiveSchema,
  guestMoveHouseholdSchema,
  guestSetRsvpSchema,
  guestUpdateSchema,
  householdUpdateSchema,
} from "@/lib/ai/proposals/schemas";
import {
  archiveGuestCore,
  guestInputSchema,
  householdInputSchema,
  moveGuestHouseholdCore,
  setGuestRsvpCore,
  updateGuestCore,
  updateHouseholdCore,
} from "@/lib/core/guests";
import { ensureOk, patchOrCurrent } from "@/lib/ai/apply/common";

/** Session-free twin of requireEdit(section) — same error text, but
 *  the user comes from the caller instead of the session (same helper
 *  convention as src/lib/ai/apply/deletes.ts). Replaces the gate the
 *  human server actions used to run inside the FormData round-trip. */
async function requireSectionEdit(user: SessionUser, section: Section): Promise<void> {
  if (!(await canEdit(user, section))) {
    throw new Error(`Forbidden: no edit access to ${section}`);
  }
}

async function applyGuestUpdate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = guestUpdateSchema.parse(payload);

  const current = await db.guest.findUnique({ where: { id: parsed.guestId } });
  if (!current) {
    throw new Error(
      "Guest not found — they may have been removed since the proposal was made.",
    );
  }
  if (current.archived) {
    throw new Error("Guest is archived — restore them before editing.");
  }
  // +1 rows can't own +1 fields (updateGuestCore force-clears them
  // without erroring — a silent no-op the reviewer would never notice).
  // Refuse so the proposal fails loudly instead.
  if (
    current.parentGuestId &&
    (parsed.plusOneAllowed !== undefined || parsed.plusOneName !== undefined)
  ) {
    throw new Error(
      "This guest is a +1 — plus-one settings live on their host guest.",
    );
  }

  // Gate BEFORE the merged parse — same evaluation order as the old
  // path (updateGuest ran requireEdit before its own guestInputSchema
  // parse), so a permission failure beats a bad-email validation error.
  await requireSectionEdit(user, "guests");

  // Full-record merge, patch-else-current for every field. The
  // guestInputSchema re-parse is exactly what updateGuest ran
  // internally, so the .email() check on a patched email still applies.
  const merged = guestInputSchema.parse({
    // householdId never changes here — household moves stay human-only.
    householdId: current.householdId,
    firstName:
      parsed.firstName !== undefined ? parsed.firstName : current.firstName,
    lastName:
      parsed.lastName !== undefined ? parsed.lastName : current.lastName,
    email: patchOrCurrent(parsed.email, current.email) || null,
    phone: patchOrCurrent(parsed.phone, current.phone) || null,
    // NEVER change rsvp here — guest.set_rsvp is the only RSVP path.
    rsvp: current.rsvp,
    side: parsed.side ?? current.side,
    isChild: parsed.isChild ?? current.isChild,
    needsHighchair: parsed.needsHighchair ?? current.needsHighchair,
    plusOneAllowed: parsed.plusOneAllowed ?? current.plusOneAllowed,
    plusOneName: patchOrCurrent(parsed.plusOneName, current.plusOneName) || null,
    role: patchOrCurrent(parsed.role, current.role) || null,
    // Guest.dietary is String[] in the DB but a comma-joined string on
    // the input (readDietary splits it back inside the core).
    dietary:
      patchOrCurrent(
        parsed.dietary,
        current.dietary.length ? current.dietary.join(", ") : null,
      ) || null,
    // v2.8.1: per-course meals. patch-or-current ALWAYS defines these
    // (either the patched value or the live one), so updateGuestCore's
    // meal patch always writes them on the AI path — the form path,
    // which leaves them undefined, is the only one that skips them.
    mealStarter: patchOrCurrent(parsed.mealStarter, current.mealStarter),
    mealMain: patchOrCurrent(parsed.mealMain, current.mealMain),
    mealDessert: patchOrCurrent(parsed.mealDessert, current.mealDessert),
    notes: patchOrCurrent(parsed.notes, current.notes) || null,
  });

  await updateGuestCore(user, parsed.guestId, merged);
  return { id: parsed.guestId };
}

async function applyGuestSetRsvp(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = guestSetRsvpSchema.parse(payload);
  await requireSectionEdit(user, "guests");
  // The payload enum re-declares Prisma's RsvpStatus values (drift is
  // schema-test territory) — cast to the enum the core expects.
  await setGuestRsvpCore(user, parsed.guestId, parsed.rsvp as RsvpStatus);
  return { id: parsed.guestId };
}

async function applyGuestArchive(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = guestArchiveSchema.parse(payload);
  await requireSectionEdit(user, "guests");
  // Soft archive (DeleteResult shape, not a throw) — funnel through
  // ensureOk so a refusal rolls the claim back.
  ensureOk(await archiveGuestCore(user, parsed.guestId));
  return { id: parsed.guestId };
}

/** v2.8.1: move a guest into a different household. EXPORTED so the
 *  execute.ts dispatch can route guest.move_household here (it also
 *  runs through applyGuestProposal's switch). Loads the live row, runs
 *  the same refusals the propose tool checked (archived / +1 /
 *  already-in-target), verifies the destination exists, gates
 *  guests-EDIT, then delegates to the core (which re-syncs the +1). */
export async function applyGuestMoveHousehold(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = guestMoveHouseholdSchema.parse(payload);

  const current = await db.guest.findUnique({ where: { id: parsed.guestId } });
  if (!current) {
    throw new Error(
      "Guest not found — they may have been removed since the proposal was made.",
    );
  }
  if (current.archived) {
    throw new Error("Guest is archived — restore them before moving households.");
  }
  // A +1 follows its host's household automatically (syncPlusOne copies
  // the host's householdId onto the child); moving one directly would
  // be silently undone. Refuse loudly instead.
  if (current.parentGuestId) {
    throw new Error(
      "This guest is a +1 — move their host guest instead; the +1 follows the host's household.",
    );
  }
  if (current.householdId === parsed.householdId) {
    throw new Error("Guest is already in that household — nothing to move.");
  }

  // Verify the destination exists — the FK would throw anyway, but a
  // clear message beats a raw constraint error on the claim rollback.
  const household = await db.household.findUnique({
    where: { id: parsed.householdId },
    select: { id: true },
  });
  if (!household) {
    throw new Error(
      "Destination household not found — it may have been deleted since the proposal was made.",
    );
  }

  await requireSectionEdit(user, "guests");
  await moveGuestHouseholdCore(user, parsed.guestId, parsed.householdId);
  return { id: parsed.guestId };
}

async function applyHouseholdUpdate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = householdUpdateSchema.parse(payload);

  const current = await db.household.findUnique({
    where: { id: parsed.householdId },
  });
  if (!current) {
    throw new Error(
      "Household not found — it may have been deleted since the proposal was made.",
    );
  }

  await requireSectionEdit(user, "guests");

  const merged = householdInputSchema.parse({
    name: parsed.name ?? current.name,
    // ALWAYS carry side — an omitted side would reset to BOTH.
    side: parsed.side ?? current.side,
    notes: patchOrCurrent(parsed.notes, current.notes) || null,
  });

  await updateHouseholdCore(user, parsed.householdId, merged);
  return { id: parsed.householdId };
}

export async function applyGuestProposal(
  user: SessionUser,
  kind: string,
  payload: unknown,
): Promise<{ id: string }> {
  switch (kind) {
    case "guest.update":
      return applyGuestUpdate(user, payload);
    case "guest.set_rsvp":
      return applyGuestSetRsvp(user, payload);
    case "guest.archive":
      return applyGuestArchive(user, payload);
    case "guest.move_household":
      return applyGuestMoveHousehold(user, payload);
    case "household.update":
      return applyHouseholdUpdate(user, payload);
    default:
      throw new Error(`Unknown guest proposal kind: ${kind}`);
  }
}
