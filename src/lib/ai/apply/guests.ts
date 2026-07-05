// v2.4.0: apply bridges for guest + household proposals.
//
// updateGuest is the most dangerous full-record action on the write
// surface: every text field reads `formData.get(x) || null` (omission
// WIPES — dietary to [], notes/email/phone/role to null), checkboxes
// read `=== "on"` (omission un-flags children and highchairs), an
// omitted rsvp resets to PENDING, an omitted side resets to BOTH —
// and a wiped plusOneAllowed/plusOneName doesn't just lose text: the
// syncPlusOne side effect ARCHIVES the +1 row and frees their seat.
// So the guest.update bridge loads the live row and posts every field
// updateGuest reads, patch-else-current.
//
// All bridges throw on failure so applyLoadedProposal's claim-rollback
// fires. Permissions compose: caller gates ai_write, the actions gate
// requireEdit("guests").

import { RsvpStatus } from "@prisma/client";
import {
  deleteGuest,
  setGuestRsvp,
  updateGuest,
  updateHousehold,
} from "@/app/(app)/guests/actions";
import { db } from "@/lib/db";
import {
  guestArchiveSchema,
  guestSetRsvpSchema,
  guestUpdateSchema,
  householdUpdateSchema,
} from "@/lib/ai/proposals/schemas";
import { ensureOk, patchOrCurrent } from "@/lib/ai/apply/common";

async function applyGuestUpdate(payload: unknown): Promise<{ id: string }> {
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
  // +1 rows can't own +1 fields (updateGuest force-clears them without
  // erroring — a silent no-op the reviewer would never notice). Refuse
  // so the proposal fails loudly instead.
  if (
    current.parentGuestId &&
    (parsed.plusOneAllowed !== undefined || parsed.plusOneName !== undefined)
  ) {
    throw new Error(
      "This guest is a +1 — plus-one settings live on their host guest.",
    );
  }

  const fd = new FormData();
  // Parser fodder: guestSchema requires householdId but updateGuest
  // never writes it — household moves stay human-only.
  fd.append("householdId", current.householdId);
  // NEVER omit rsvp: `formData.get("rsvp") || PENDING` would silently
  // reset the RSVP. guest.set_rsvp is the only RSVP write path.
  fd.append("rsvp", current.rsvp);
  fd.append("side", parsed.side ?? current.side);
  fd.append(
    "firstName",
    parsed.firstName !== undefined ? parsed.firstName : current.firstName,
  );
  fd.append(
    "lastName",
    parsed.lastName !== undefined ? parsed.lastName : current.lastName,
  );

  // Text fields: the parser treats a missing key as null, so appending
  // only non-null merged values gives both carry and explicit-clear.
  const email = patchOrCurrent(parsed.email, current.email);
  if (email) fd.append("email", email);
  const phone = patchOrCurrent(parsed.phone, current.phone);
  if (phone) fd.append("phone", phone);
  const role = patchOrCurrent(parsed.role, current.role);
  if (role) fd.append("role", role);
  // Guest.dietary is String[] in the DB but a comma-joined string on
  // the form (readDietary splits it back). Round-trip via join.
  const dietary = patchOrCurrent(
    parsed.dietary,
    current.dietary.length ? current.dietary.join(", ") : null,
  );
  if (dietary) fd.append("dietary", dietary);
  const notes = patchOrCurrent(parsed.notes, current.notes);
  if (notes) fd.append("notes", notes);

  // Checkboxes: append "on" only when the merged value is true.
  if (parsed.isChild ?? current.isChild) fd.append("isChild", "on");
  if (parsed.needsHighchair ?? current.needsHighchair) {
    fd.append("needsHighchair", "on");
  }
  if (parsed.plusOneAllowed ?? current.plusOneAllowed) {
    fd.append("plusOneAllowed", "on");
  }
  const plusOneName = patchOrCurrent(parsed.plusOneName, current.plusOneName);
  if (plusOneName) fd.append("plusOneName", plusOneName);

  await updateGuest(parsed.guestId, fd);
  return { id: parsed.guestId };
}

async function applyGuestSetRsvp(payload: unknown): Promise<{ id: string }> {
  const parsed = guestSetRsvpSchema.parse(payload);
  // The payload enum re-declares Prisma's RsvpStatus values (drift is
  // schema-test territory) — cast to the enum the action expects.
  await setGuestRsvp(parsed.guestId, parsed.rsvp as RsvpStatus);
  return { id: parsed.guestId };
}

async function applyGuestArchive(payload: unknown): Promise<{ id: string }> {
  const parsed = guestArchiveSchema.parse(payload);
  // Soft archive (DeleteResult shape, not a throw) — funnel through
  // ensureOk so a refusal rolls the claim back.
  ensureOk(await deleteGuest(parsed.guestId));
  return { id: parsed.guestId };
}

async function applyHouseholdUpdate(payload: unknown): Promise<{ id: string }> {
  const parsed = householdUpdateSchema.parse(payload);

  const current = await db.household.findUnique({
    where: { id: parsed.householdId },
  });
  if (!current) {
    throw new Error(
      "Household not found — it may have been deleted since the proposal was made.",
    );
  }

  const fd = new FormData();
  fd.append("name", parsed.name ?? current.name);
  // ALWAYS post side — `formData.get("side") || Side.BOTH` would reset
  // an omitted side to BOTH.
  fd.append("side", parsed.side ?? current.side);
  const notes = patchOrCurrent(parsed.notes, current.notes);
  if (notes) fd.append("notes", notes);

  await updateHousehold(parsed.householdId, fd);
  return { id: parsed.householdId };
}

export async function applyGuestProposal(
  _user: { id: string; isCouple: boolean },
  kind: string,
  payload: unknown,
): Promise<{ id: string }> {
  switch (kind) {
    case "guest.update":
      return applyGuestUpdate(payload);
    case "guest.set_rsvp":
      return applyGuestSetRsvp(payload);
    case "guest.archive":
      return applyGuestArchive(payload);
    case "household.update":
      return applyHouseholdUpdate(payload);
    default:
      throw new Error(`Unknown guest proposal kind: ${kind}`);
  }
}
