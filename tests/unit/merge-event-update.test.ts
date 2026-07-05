import { describe, expect, it } from "vitest";
import { mergeAttendeeRefs } from "@/lib/ai/proposals/merge-event-update";

describe("mergeAttendeeRefs", () => {
  it("expands legacy attendeeIds to user: refs when attendeeRefs is empty", () => {
    const next = mergeAttendeeRefs(
      { attendeeRefs: [], attendeeIds: ["u1", "u2"] },
      ["builtin:couple"],
      undefined,
    );
    expect(next).toEqual(["user:u1", "user:u2", "builtin:couple"]);
  });

  it("ignores legacy attendeeIds once attendeeRefs is populated", () => {
    // Post-v1.41 rows have attendeeIds zeroed, but a half-migrated row
    // with both populated must prefer attendeeRefs — same precedence
    // as updateScheduleEvent's own diff.
    const next = mergeAttendeeRefs(
      { attendeeRefs: ["user:u3"], attendeeIds: ["u1", "u2"] },
      undefined,
      undefined,
    );
    expect(next).toEqual(["user:u3"]);
  });

  it("carries group: refs through untouched — the human-only-ref guard", () => {
    const next = mergeAttendeeRefs(
      { attendeeRefs: ["group:ushers", "user:u1"], attendeeIds: [] },
      ["user:u2"],
      ["user:u1"],
    );
    expect(next).toEqual(["group:ushers", "user:u2"]);
  });

  it("removes a group: ref only when explicitly listed", () => {
    const next = mergeAttendeeRefs(
      { attendeeRefs: ["group:ushers", "builtin:couple"], attendeeIds: [] },
      undefined,
      ["group:ushers"],
    );
    expect(next).toEqual(["builtin:couple"]);
  });

  it("dedupes an add of a ref that's already present", () => {
    const next = mergeAttendeeRefs(
      { attendeeRefs: ["user:u1", "builtin:couple"], attendeeIds: [] },
      ["user:u1", "user:u1", "user:u2"],
      undefined,
    );
    expect(next).toEqual(["user:u1", "builtin:couple", "user:u2"]);
  });

  it("dedupes an add against a legacy-expanded ref", () => {
    const next = mergeAttendeeRefs(
      { attendeeRefs: [], attendeeIds: ["u1"] },
      ["user:u1"],
      undefined,
    );
    expect(next).toEqual(["user:u1"]);
  });

  it("ignores removal of a ref that isn't present", () => {
    const next = mergeAttendeeRefs(
      { attendeeRefs: ["user:u1"], attendeeIds: [] },
      undefined,
      ["user:nope", "builtin:everyone"],
    );
    expect(next).toEqual(["user:u1"]);
  });

  it("remove wins when the same ref is both added and removed", () => {
    const next = mergeAttendeeRefs(
      { attendeeRefs: ["user:u1"], attendeeIds: [] },
      ["user:u2"],
      ["user:u2"],
    );
    expect(next).toEqual(["user:u1"]);
  });

  it("preserves order: existing refs first (original order), adds appended", () => {
    const next = mergeAttendeeRefs(
      { attendeeRefs: ["user:u3", "user:u1", "group:g"], attendeeIds: [] },
      ["builtin:planners-role", "user:u9"],
      undefined,
    );
    expect(next).toEqual([
      "user:u3",
      "user:u1",
      "group:g",
      "builtin:planners-role",
      "user:u9",
    ]);
  });

  it("empty deltas return an equal copy (not the same array)", () => {
    const before = { attendeeRefs: ["user:u1"], attendeeIds: [] };
    const next = mergeAttendeeRefs(before, undefined, undefined);
    expect(next).toEqual(before.attendeeRefs);
    expect(next).not.toBe(before.attendeeRefs);
  });

  it("can empty the list entirely when every ref is removed", () => {
    const next = mergeAttendeeRefs(
      { attendeeRefs: [], attendeeIds: ["u1"] },
      undefined,
      ["user:u1"],
    );
    expect(next).toEqual([]);
  });
});
