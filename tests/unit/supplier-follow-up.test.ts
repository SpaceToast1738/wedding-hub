import { describe, expect, it } from "vitest";
import { decideFollowUpTask } from "@/lib/supplier-follow-up";

describe("decideFollowUpTask — B3", () => {
  it("returns null when followUpAt is null (no auto-task)", () => {
    const result = decideFollowUpTask({
      supplierId: "sup_1",
      supplierName: "Paintbox Blooms",
      commId: "com_1",
      followUpAt: null,
      createdById: "user_1",
    });
    expect(result).toBeNull();
  });

  it("returns a task payload when followUpAt is set", () => {
    const due = new Date("2026-05-15T10:00:00Z");
    const result = decideFollowUpTask({
      supplierId: "sup_1",
      supplierName: "Paintbox Blooms",
      commId: "com_1",
      followUpAt: due,
      createdById: "user_1",
    });
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Follow up: Paintbox Blooms");
    expect(result!.type).toBe("TASK");
    expect(result!.status).toBe("OPEN");
    expect(result!.priority).toBe("MEDIUM");
    expect(result!.dueDate).toBe(due);
    expect(result!.assigneeId).toBe("user_1");
  });

  it("tags include the soft FK back to supplier and comm", () => {
    const result = decideFollowUpTask({
      supplierId: "sup_42",
      supplierName: "Slaters Suits",
      commId: "com_99",
      followUpAt: new Date("2026-06-01"),
      createdById: null,
    });
    expect(result!.tags).toEqual([
      "supplier-follow-up",
      "supplier:sup_42",
      "comm:com_99",
    ]);
  });

  it("propagates a null createdById (assignee can be unset)", () => {
    const result = decideFollowUpTask({
      supplierId: "sup_1",
      supplierName: "Anyone",
      commId: "com_1",
      followUpAt: new Date(),
      createdById: null,
    });
    expect(result!.assigneeId).toBeNull();
  });
});
