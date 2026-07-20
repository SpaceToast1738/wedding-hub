// v2.9.0: proposal supersede (src/lib/ai/proposals/supersede.ts) —
// the MCP route's supersedesProposalId hook. Contract: only the
// creating user's own still-PENDING proposal is dismissed, with a
// "superseded by <id>" metadata note; foreign/missing rows report the
// same non-leaking "not found"; a superseded staged upload has its
// staged file discarded.

import { beforeEach, describe, expect, it, vi } from "vitest";

let proposalRow: Record<string, unknown> | null = null;
let claimCount = 1;

const findUnique = vi.fn(async (_args: unknown) => proposalRow);
const updateMany = vi.fn(async (_args: unknown) => ({ count: claimCount }));
const auditCreate = vi.fn(async (_args: unknown) => ({}));
const discardStage = vi.fn(async (_name: string) => undefined);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    aiProposal: { findUnique, updateMany },
    auditLog: { create: auditCreate, deleteMany: vi.fn(async () => ({ count: 0 })) },
  },
}));
vi.mock("@/lib/ai/uploads-staging", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/uploads-staging")>();
  return { ...actual, discardStage };
});

const { supersedeProposal } = await import("@/lib/ai/proposals/supersede");

const STAGED = `pending-${"a".repeat(32)}.pdf`;

beforeEach(() => {
  proposalRow = null;
  claimCount = 1;
  vi.clearAllMocks();
});

describe("supersedeProposal", () => {
  it("dismisses the user's own PENDING proposal with the superseded note", async () => {
    proposalRow = {
      id: "old_1",
      status: "PENDING",
      createdById: "u_1",
      kind: "task.create",
      payload: {},
    };
    const result = await supersedeProposal("u_1", "old_1", "new_1");
    expect(result).toEqual({ ok: true });
    const update = updateMany.mock.calls[0]![0] as unknown as {
      where: Record<string, unknown>;
      data: { status: string; metadata: Record<string, unknown> };
    };
    // The claim is conditioned on PENDING + ownership — race-safe.
    expect(update.where).toMatchObject({
      id: "old_1",
      status: "PENDING",
      createdById: "u_1",
    });
    expect(update.data.status).toBe("DISMISSED");
    expect(update.data.metadata).toEqual({
      note: "superseded by new_1",
      supersededById: "new_1",
    });
    const audit = auditCreate.mock.calls[0]![0] as unknown as { data: Record<string, unknown> };
    expect(audit.data).toMatchObject({
      action: "ai.proposal.superseded",
      entity: "AiProposal",
      entityId: "old_1",
      userId: "u_1",
    });
  });

  it("reports 'not found' for a foreign proposal — existence never leaks", async () => {
    proposalRow = {
      id: "old_1",
      status: "PENDING",
      createdById: "someone_else",
      kind: "task.create",
      payload: {},
    };
    const result = await supersedeProposal("u_1", "old_1", "new_1");
    expect(result).toEqual({ ok: false, reason: "Proposal not found." });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("reports 'not found' for a missing proposal", async () => {
    const result = await supersedeProposal("u_1", "nope", "new_1");
    expect(result).toEqual({ ok: false, reason: "Proposal not found." });
  });

  it("refuses a non-PENDING proposal", async () => {
    proposalRow = {
      id: "old_1",
      status: "APPLIED",
      createdById: "u_1",
      kind: "task.create",
      payload: {},
    };
    const result = await supersedeProposal("u_1", "old_1", "new_1");
    expect(result).toEqual({ ok: false, reason: "Proposal is already applied." });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("loses the claim race gracefully", async () => {
    proposalRow = {
      id: "old_1",
      status: "PENDING",
      createdById: "u_1",
      kind: "task.create",
      payload: {},
    };
    claimCount = 0;
    const result = await supersedeProposal("u_1", "old_1", "new_1");
    expect(result).toEqual({ ok: false, reason: "Proposal was already handled." });
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("discards the staged file when superseding a file.upload proposal", async () => {
    proposalRow = {
      id: "old_1",
      status: "PENDING",
      createdById: "u_1",
      kind: "file.upload",
      payload: { stagedName: STAGED },
    };
    const result = await supersedeProposal("u_1", "old_1", "new_1");
    expect(result).toEqual({ ok: true });
    expect(discardStage).toHaveBeenCalledWith(STAGED);
  });

  it("ignores a tampered stagedName on a file.upload payload", async () => {
    proposalRow = {
      id: "old_1",
      status: "PENDING",
      createdById: "u_1",
      kind: "file.upload",
      payload: { stagedName: "pending-../../etc/shadow" },
    };
    const result = await supersedeProposal("u_1", "old_1", "new_1");
    expect(result).toEqual({ ok: true });
    expect(discardStage).not.toHaveBeenCalled();
  });
});
