import { describe, expect, it } from "vitest";
import { decidePlusOneAction } from "@/lib/plus-one";

// The +1 sync logic is split into:
//   - decidePlusOneAction (pure, in actions.ts) — tested here
//   - syncPlusOne (DB-aware wrapper, in actions.ts) — integration territory
//
// These cases mirror the audit/feedback for v1.7.0. Each scenario maps
// to a real user flow:
//   - host marks "Plus-one allowed" + types a name + RSVPs ATTENDING
//     → child row materialised
//   - host updates plusOneName → child row's firstName/lastName sync
//   - host un-allows the +1 → child row archived (not hard-deleted, so
//     dietary/meal/song data persists if they flip it back on)
//   - host changes household / side / RSVP → child row inherits
//   - the +1 itself is passed in as a "host" by mistake → no-op

const HOST_BASE = {
  id: "host_1",
  householdId: "hh_1",
  side: "GROOM" as const,
  rsvp: "ATTENDING" as const,
  plusOneAllowed: true,
  plusOneName: "Sarah Smith",
  parentGuestId: null,
};

describe("decidePlusOneAction — create path", () => {
  it("creates a new +1 with name split from plusOneName", () => {
    const action = decidePlusOneAction(HOST_BASE, null);
    expect(action.kind).toBe("create");
    if (action.kind !== "create") return;
    expect(action.data.parentGuestId).toBe("host_1");
    expect(action.data.householdId).toBe("hh_1");
    expect(action.data.firstName).toBe("Sarah");
    expect(action.data.lastName).toBe("Smith");
    expect(action.data.side).toBe("GROOM");
    expect(action.data.rsvp).toBe("ATTENDING");
  });

  it("handles single-word names (firstName only, lastName empty)", () => {
    const action = decidePlusOneAction({ ...HOST_BASE, plusOneName: "Cher" }, null);
    expect(action.kind).toBe("create");
    if (action.kind !== "create") return;
    expect(action.data.firstName).toBe("Cher");
    expect(action.data.lastName).toBe("");
  });

  it("trims whitespace around plusOneName", () => {
    const action = decidePlusOneAction({ ...HOST_BASE, plusOneName: "  Sarah Smith  " }, null);
    expect(action.kind).toBe("create");
    if (action.kind !== "create") return;
    expect(action.data.firstName).toBe("Sarah");
    expect(action.data.lastName).toBe("Smith");
  });

  it("no-ops when plusOneAllowed is true but name is empty", () => {
    const action = decidePlusOneAction({ ...HOST_BASE, plusOneName: "" }, null);
    expect(action.kind).toBe("noop");
  });

  it("no-ops when plusOneAllowed is true but name is whitespace only", () => {
    const action = decidePlusOneAction({ ...HOST_BASE, plusOneName: "   " }, null);
    expect(action.kind).toBe("noop");
  });

  it("no-ops when plusOneAllowed is false even with a name", () => {
    const action = decidePlusOneAction(
      { ...HOST_BASE, plusOneAllowed: false, plusOneName: "Sarah Smith" },
      null,
    );
    expect(action.kind).toBe("noop");
  });
});

describe("decidePlusOneAction — update path", () => {
  it("updates an existing +1's first/last from a renamed plusOneName", () => {
    const action = decidePlusOneAction(
      { ...HOST_BASE, plusOneName: "Sarah Smith-Jones" },
      { id: "child_1", archived: false },
    );
    expect(action.kind).toBe("update");
    if (action.kind !== "update") return;
    expect(action.childId).toBe("child_1");
    expect(action.data.firstName).toBe("Sarah");
    expect(action.data.lastName).toBe("Smith-Jones");
  });

  it("syncs household + side + rsvp from the host", () => {
    const action = decidePlusOneAction(
      {
        ...HOST_BASE,
        householdId: "hh_other",
        side: "BRIDE",
        rsvp: "DECLINED",
      },
      { id: "child_1", archived: false },
    );
    expect(action.kind).toBe("update");
    if (action.kind !== "update") return;
    expect(action.data.householdId).toBe("hh_other");
    expect(action.data.side).toBe("BRIDE");
    expect(action.data.rsvp).toBe("DECLINED");
  });

  it("doesn't archive an already-archived child on update path", () => {
    // If +1 was previously archived (e.g. host disabled then re-enabled
    // it), the action is still "update" — caller decides whether to
    // un-archive separately. Default sync stays minimal.
    const action = decidePlusOneAction(HOST_BASE, { id: "child_1", archived: true });
    expect(action.kind).toBe("update");
  });
});

describe("decidePlusOneAction — archive path", () => {
  it("archives the +1 when plusOneAllowed flips to false", () => {
    const action = decidePlusOneAction(
      { ...HOST_BASE, plusOneAllowed: false },
      { id: "child_1", archived: false },
    );
    expect(action.kind).toBe("archive");
    if (action.kind !== "archive") return;
    expect(action.childId).toBe("child_1");
  });

  it("archives the +1 when plusOneName is cleared", () => {
    const action = decidePlusOneAction(
      { ...HOST_BASE, plusOneName: "" },
      { id: "child_1", archived: false },
    );
    expect(action.kind).toBe("archive");
  });

  it("no-ops when plusOne is already archived (idempotent)", () => {
    const action = decidePlusOneAction(
      { ...HOST_BASE, plusOneAllowed: false },
      { id: "child_1", archived: true },
    );
    expect(action.kind).toBe("noop");
  });

  it("no-ops when plusOne is disabled and no child exists", () => {
    const action = decidePlusOneAction(
      { ...HOST_BASE, plusOneAllowed: false },
      null,
    );
    expect(action.kind).toBe("noop");
  });
});

describe("decidePlusOneAction — recursion guard", () => {
  it("no-ops when the 'host' is itself a +1 (parentGuestId set)", () => {
    const action = decidePlusOneAction(
      { ...HOST_BASE, parentGuestId: "some_other_host" },
      null,
    );
    expect(action.kind).toBe("noop");
    if (action.kind !== "noop") return;
    expect(action.reason).toBe("host_is_plus_one");
  });
});
