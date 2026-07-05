import { describe, expect, it } from "vitest";
import {
  mergeTaskRelations,
  patchTouchesAssignees,
  patchTouchesTopics,
  type TaskRelationState,
} from "@/lib/ai/proposals/merge-task-update";

const base: TaskRelationState = {
  assigneeIds: ["u1", "u2"],
  bookSectionIds: ["s1"],
  bookSubsectionIds: ["card1", "card2"],
  navTagIds: ["t1"],
  guestGroupIds: [],
};

describe("mergeTaskRelations", () => {
  it("adds and removes assignees without touching topics", () => {
    const next = mergeTaskRelations(base, {
      addAssigneeIds: ["u3"],
      removeAssigneeIds: ["u1"],
    });
    expect(next.assigneeIds.sort()).toEqual(["u2", "u3"]);
    expect(next.bookSectionIds).toEqual(["s1"]);
    expect(next.navTagIds).toEqual(["t1"]);
  });

  it("carries bookSubsectionIds through untouched when the patch doesn't mention them", () => {
    const next = mergeTaskRelations(base, {
      addNavTagIds: ["t2"],
      removeBookSectionIds: ["s1"],
    });
    expect(next.bookSubsectionIds).toEqual(["card1", "card2"]);
    expect(next.navTagIds.sort()).toEqual(["t1", "t2"]);
    expect(next.bookSectionIds).toEqual([]);
  });

  it("adds and removes bookSubsectionIds (card-level links) via the same delta pattern", () => {
    const next = mergeTaskRelations(base, {
      addBookSubsectionIds: ["card3"],
      removeBookSubsectionIds: ["card1"],
    });
    expect(next.bookSubsectionIds.sort()).toEqual(["card2", "card3"]);
    expect(next.assigneeIds.sort()).toEqual(["u1", "u2"]);
  });

  it("dedupes an add of an id that's already present", () => {
    const next = mergeTaskRelations(base, { addAssigneeIds: ["u1"] });
    expect(next.assigneeIds.sort()).toEqual(["u1", "u2"]);
  });

  it("ignores removal of an id that isn't present", () => {
    const next = mergeTaskRelations(base, { removeNavTagIds: ["nope"] });
    expect(next.navTagIds).toEqual(["t1"]);
  });

  it("remove wins when the same id is both added and removed", () => {
    const next = mergeTaskRelations(base, {
      addGuestGroupIds: ["g1"],
      removeGuestGroupIds: ["g1"],
    });
    expect(next.guestGroupIds).toEqual([]);
  });

  it("empty patch returns an equal copy (not the same arrays)", () => {
    const next = mergeTaskRelations(base, {});
    expect(next).toEqual(base);
    expect(next.bookSubsectionIds).not.toBe(base.bookSubsectionIds);
  });
});

describe("patchTouches*", () => {
  it("assignee-only patch touches assignees but not topics", () => {
    const patch = { addAssigneeIds: ["u9"] };
    expect(patchTouchesAssignees(patch)).toBe(true);
    expect(patchTouchesTopics(patch)).toBe(false);
  });

  it("topic-only patch touches topics but not assignees", () => {
    const patch = { removeGuestGroupIds: ["g2"] };
    expect(patchTouchesAssignees(patch)).toBe(false);
    expect(patchTouchesTopics(patch)).toBe(true);
  });

  it("bookSubsectionIds patch touches topics but not assignees", () => {
    const patch = { addBookSubsectionIds: ["card9"] };
    expect(patchTouchesAssignees(patch)).toBe(false);
    expect(patchTouchesTopics(patch)).toBe(true);
  });

  it("empty patch touches neither", () => {
    expect(patchTouchesAssignees({})).toBe(false);
    expect(patchTouchesTopics({})).toBe(false);
  });

  it("empty arrays don't count as touching", () => {
    expect(patchTouchesAssignees({ addAssigneeIds: [] })).toBe(false);
    expect(patchTouchesTopics({ addNavTagIds: [], removeBookSectionIds: [] })).toBe(false);
  });
});
