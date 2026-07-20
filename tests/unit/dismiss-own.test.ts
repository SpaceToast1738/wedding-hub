// v2.9.0: dismiss_proposals with the narrower canDismissOwn token flag
// (src/lib/ai/tools/apply-proposals.ts). Contract: without canApply the
// handler pre-filters to rows the token's user created — foreign or
// missing ids get a non-leaking "Proposal not found." per-item error
// and never reach the engine; with canApply the v2.8.0 behaviour is
// unchanged (everything goes to runBulkCore). canApply defaults false
// everywhere — these tests pass the flags explicitly.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/actions";
import type { ToolContext } from "@/lib/ai/tools/types";

let ownRows: { id: string }[] = [];

const findMany = vi.fn(async (_args: unknown) => ownRows);
const runBulkCore = vi.fn(async (_user: unknown, ids: string[]) => ({
  results: ids.map((id) => ({ id, ok: true, entityId: null, error: null })),
}));

vi.mock("@/lib/db", () => ({
  db: { aiProposal: { findMany } },
}));
vi.mock("@/lib/ai/apply/execute", () => ({ runBulkCore }));

const { dismissProposals } = await import("@/lib/ai/tools/apply-proposals");

const user: SessionUser = {
  id: "u_1",
  email: "u@example.com",
  name: null,
  isCouple: true, // couple-tier ON PURPOSE: own-only must bind even them
  role: "COUPLE",
};

function ctx(flags: Partial<ToolContext>): ToolContext {
  return { user, canWrite: true, ...flags };
}

beforeEach(() => {
  ownRows = [];
  vi.clearAllMocks();
});

describe("dismiss_proposals gating", () => {
  it("refuses without canApply OR canDismissOwn", async () => {
    const result = await dismissProposals.handler({ ids: ["p1"] }, ctx({}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Can dismiss its own proposals");
    expect(runBulkCore).not.toHaveBeenCalled();
  });

  it("still requires ai_write even with canDismissOwn", async () => {
    const result = await dismissProposals.handler(
      { ids: ["p1"] },
      ctx({ canDismissOwn: true, canWrite: false }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("ai_write");
  });

  it("canApply path is unchanged — all ids go straight to the engine", async () => {
    const result = await dismissProposals.handler(
      { ids: ["p1", "p2"] },
      ctx({ canApply: true }),
    );
    expect(result.ok).toBe(true);
    expect(findMany).not.toHaveBeenCalled();
    expect(runBulkCore).toHaveBeenCalledWith(user, ["p1", "p2"], "dismiss");
  });
});

describe("dismiss_proposals own-only mode (canDismissOwn without canApply)", () => {
  it("dismisses own rows and refuses foreign/missing ones per-item, in input order", async () => {
    ownRows = [{ id: "own_1" }, { id: "own_2" }];
    const result = await dismissProposals.handler(
      { ids: ["own_1", "foreign_1", "own_2"] },
      ctx({ canDismissOwn: true }),
    );
    expect(result.ok).toBe(true);
    // The ownership filter is in the QUERY — createdById scoped.
    const where = (findMany.mock.calls[0]![0] as unknown as { where: Record<string, unknown> })
      .where;
    expect(where).toMatchObject({ createdById: "u_1" });
    // Only own ids reach the engine.
    expect(runBulkCore).toHaveBeenCalledWith(user, ["own_1", "own_2"], "dismiss");
    const data = (result as { ok: true; data: { dismissed: number; results: { id: string; ok: boolean; error: string | null }[] } }).data;
    expect(data.dismissed).toBe(2);
    expect(data.results.map((r) => r.id)).toEqual(["own_1", "foreign_1", "own_2"]);
    expect(data.results[1]).toMatchObject({ ok: false, error: "Proposal not found." });
  });

  it("all-foreign input never touches the engine", async () => {
    ownRows = [];
    const result = await dismissProposals.handler(
      { ids: ["foreign_1"] },
      ctx({ canDismissOwn: true }),
    );
    expect(result.ok).toBe(true);
    expect(runBulkCore).not.toHaveBeenCalled();
    const data = (result as { ok: true; data: { dismissed: number } }).data;
    expect(data.dismissed).toBe(0);
  });
});
