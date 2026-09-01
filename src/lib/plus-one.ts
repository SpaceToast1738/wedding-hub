// Pure decision logic for plus-one materialisation. Lives outside the
// "use server" actions file so it can be unit-tested in isolation
// (importing actions.ts from a test file pulls in next-auth + Prisma,
// which Vitest's node env can't resolve cleanly).
//
// The DB-aware wrapper `syncPlusOne` in src/lib/core/guests.ts reads +
// writes the DB based on these decisions.

import type { RsvpStatus, Side } from "@prisma/client";
import { splitFullName } from "@/lib/csv";

// v2.13.1: the host fields a +1 row is DERIVED from. updateGuestCore
// only runs the cascade when one of these actually changed. Pre-fix it
// ran on every host save — so editing a host's email, phone or meal
// choices re-stamped the host's RSVP onto the +1 and silently flipped
// an explicit decline back to ATTENDING (Hannah Salyer, 5 Aug 2026: 45/4
// became 46/3 with nothing in the log to say why). `changedFields` here
// is the diffEditedFields output that already feeds the audit row, so
// the gate and the log can't disagree about what changed.
export const PLUS_ONE_SYNC_FIELDS = ["rsvp", "plusOneAllowed", "plusOneName", "side"] as const;

export function plusOneSyncNeeded(changedFields: readonly string[]): boolean {
  return changedFields.some((f) => (PLUS_ONE_SYNC_FIELDS as readonly string[]).includes(f));
}

export type HostSnapshot = {
  id: string;
  householdId: string;
  side: Side;
  rsvp: RsvpStatus;
  plusOneAllowed: boolean;
  plusOneName: string | null;
  parentGuestId: string | null;
};

export type ChildSnapshot = {
  id: string;
  archived: boolean;
  // v2.13.1: needed for the sticky-decline rule in the update path.
  rsvp: RsvpStatus;
} | null;

export type PlusOneAction =
  | { kind: "noop"; reason: string }
  | {
      kind: "create";
      data: {
        parentGuestId: string;
        householdId: string;
        firstName: string;
        lastName: string;
        side: Side;
        rsvp: RsvpStatus;
      };
    }
  | {
      kind: "update";
      childId: string;
      data: {
        householdId: string;
        firstName: string;
        lastName: string;
        side: Side;
        rsvp: RsvpStatus;
      };
    }
  | { kind: "archive"; childId: string };

// Given a host's current state and the existing child row (if any),
// decide what to do with the +1 row. See comments in actions.ts for
// the full reasoning behind each branch.
export function decidePlusOneAction(
  host: HostSnapshot,
  child: ChildSnapshot,
): PlusOneAction {
  // A +1 row can't have a +1 itself. No-op for any pathological recursion.
  if (host.parentGuestId) {
    return { kind: "noop", reason: "host_is_plus_one" };
  }

  const trimmedName = host.plusOneName?.trim() ?? "";
  const shouldExist = host.plusOneAllowed && trimmedName.length > 0;

  if (!shouldExist) {
    if (child && !child.archived) {
      return { kind: "archive", childId: child.id };
    }
    return { kind: "noop", reason: "plus_one_disabled" };
  }

  // shouldExist — derive first/last from the trimmed name.
  const split = splitFullName(trimmedName);
  const firstName = split.firstName || trimmedName;
  const lastName = split.lastName;

  if (!child) {
    return {
      kind: "create",
      data: {
        parentGuestId: host.id,
        householdId: host.householdId,
        firstName,
        lastName,
        side: host.side,
        rsvp: host.rsvp,
      },
    };
  }

  // v2.13.1: an explicit DECLINED on the +1 is sticky. A +1 starts
  // PENDING and only ever becomes DECLINED by someone setting it, so
  // "child says DECLINED, host doesn't" is always a deliberate answer —
  // the host being (or becoming) ATTENDING must not overturn it. The
  // host declining still takes the +1 with them (a +1 can't attend
  // alone). Trade-off: a +1 that reached DECLINED via an earlier host
  // decline stays DECLINED when the host later flips back to ATTENDING
  // and has to be re-set by hand — wrong-but-visible beats the pre-fix
  // silently-wrong headcount going to the venue.
  const rsvp = child.rsvp === "DECLINED" && host.rsvp !== "DECLINED" ? child.rsvp : host.rsvp;
  return {
    kind: "update",
    childId: child.id,
    data: {
      householdId: host.householdId,
      firstName,
      lastName,
      side: host.side,
      rsvp,
    },
  };
}
