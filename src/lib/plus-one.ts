// Pure decision logic for plus-one materialisation. Lives outside the
// "use server" actions file so it can be unit-tested in isolation
// (importing actions.ts from a test file pulls in next-auth + Prisma,
// which Vitest's node env can't resolve cleanly).
//
// The DB-aware wrapper `syncPlusOne` in src/app/(app)/guests/actions.ts
// reads + writes the DB based on these decisions.

import type { RsvpStatus, Side } from "@prisma/client";
import { splitFullName } from "@/lib/csv";

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

  return {
    kind: "update",
    childId: child.id,
    data: {
      householdId: host.householdId,
      firstName,
      lastName,
      side: host.side,
      rsvp: host.rsvp,
    },
  };
}
