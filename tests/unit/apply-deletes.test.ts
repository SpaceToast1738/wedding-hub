// v2.8.0: apply handlers for the destructive proposal kinds
// (src/lib/ai/apply/deletes.ts). Focus: the refusal edges that keep
// implicit cascades unreachable — a non-empty budget category / book
// section must throw BEFORE any snapshot or delete happens — plus the
// snapshot-before-delete ordering contract and the guest hard-delete
// gates (couple-only, archived-only) that mirror hardDeleteGuest.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/actions";

// Recorded call order — the recovery contract is "snapshot FIRST,
// then delete", which a pass/fail on individual mocks can't prove.
let callOrder: string[] = [];

let budgetCategoryRow: Record<string, unknown> | null = null;
let bookSectionRow: Record<string, unknown> | null = null;
let guestRow: Record<string, unknown> | null = null;
let permissionRows: Array<{ section: string; level: string }> = [];

const aiProposalUpdate = vi.fn(async (args: unknown) => {
  callOrder.push("snapshot");
  return args;
});
const auditCreate = vi.fn(async (_args: unknown) => ({}));
const budgetCategoryDelete = vi.fn(async () => {
  callOrder.push("delete");
  return {};
});
const bookSectionDelete = vi.fn(async () => {
  callOrder.push("delete");
  return {};
});
const guestDelete = vi.fn(async () => {
  callOrder.push("delete");
  return {};
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: {
    aiProposal: { update: aiProposalUpdate },
    auditLog: { create: auditCreate, deleteMany: vi.fn(async () => ({ count: 0 })) },
    budgetCategory: {
      findUnique: vi.fn(async () => budgetCategoryRow),
      delete: budgetCategoryDelete,
    },
    bookSection: {
      findUnique: vi.fn(async () => bookSectionRow),
      delete: bookSectionDelete,
    },
    guest: {
      findUnique: vi.fn(async () => guestRow),
      delete: guestDelete,
    },
    // The permission resolver's surface (only exercised by non-couple
    // callers — couple short-circuits before any query).
    user: {
      findUnique: vi.fn(async (args: { where: { id: string } }) =>
        args.where.id === "u_member"
          ? {
              id: "u_member",
              role: "VIEWER",
              isCouple: false,
              email: "member@example.com",
              firstName: null,
              lastName: null,
              name: "Member",
            }
          : null,
      ),
    },
    permissionGroup: { findMany: vi.fn(async () => []) },
    groupPermission: { findMany: vi.fn(async () => []) },
    permission: { findMany: vi.fn(async () => permissionRows) },
  },
}));

// React.cache is a request-scoped memoiser; identity in tests so each
// call re-reads permissionRows (same shim as permissions.test.ts).
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: <T>(fn: T) => fn };
});

const { applyDeleteProposal } = await import("@/lib/ai/apply/deletes");

function userFor(id: string, isCouple: boolean): SessionUser {
  return {
    id,
    email: `${id}@example.com`,
    name: null,
    isCouple,
    role: isCouple ? "COUPLE" : "VIEWER",
  };
}
const couple = userFor("u_couple", true);
const member = userFor("u_member", false);

beforeEach(() => {
  callOrder = [];
  budgetCategoryRow = null;
  bookSectionRow = null;
  guestRow = null;
  permissionRows = [];
  vi.clearAllMocks();
});

describe("budget.category.delete", () => {
  it("refuses a non-empty category before any snapshot or delete", async () => {
    budgetCategoryRow = { id: "cat_1", name: "Venue", _count: { lines: 3 } };
    await expect(
      applyDeleteProposal(couple, "budget.category.delete", { categoryId: "cat_1" }, "prop_1"),
    ).rejects.toThrow('Can\'t delete "Venue" — 3 lines still in this category.');
    expect(aiProposalUpdate).not.toHaveBeenCalled();
    expect(budgetCategoryDelete).not.toHaveBeenCalled();
  });

  it("deletes an empty category, snapshotting to the proposal FIRST", async () => {
    budgetCategoryRow = { id: "cat_1", name: "Stationery", _count: { lines: 0 } };
    const result = await applyDeleteProposal(
      couple,
      "budget.category.delete",
      { categoryId: "cat_1" },
      "prop_1",
    );
    expect(result).toEqual({ id: "cat_1" });
    expect(callOrder).toEqual(["snapshot", "delete"]);
    const update = aiProposalUpdate.mock.calls[0]![0] as {
      where: { id: string };
      data: { metadata: { deletedSnapshot: unknown; deletedAt: string; cascadeSummary: string } };
    };
    expect(update.where).toEqual({ id: "prop_1" });
    expect(update.data.metadata.deletedSnapshot).toMatchObject({ name: "Stationery" });
    expect(typeof update.data.metadata.deletedAt).toBe("string");
    expect(update.data.metadata.cascadeSummary).toContain("no dependent rows");
    // Domain audit row, delete action, with the recovery pointer.
    const audit = auditCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(audit.data).toMatchObject({
      action: "delete",
      entity: "BudgetCategory",
      entityId: "cat_1",
      userId: "u_couple",
    });
    expect(audit.data.metadata).toMatchObject({ proposalId: "prop_1" });
  });

  it("denies a non-couple caller — budget is a couple-only section", async () => {
    permissionRows = [{ section: "budget", level: "EDIT" }]; // override can't unlock couple-only
    budgetCategoryRow = { id: "cat_1", name: "Stationery", _count: { lines: 0 } };
    await expect(
      applyDeleteProposal(member, "budget.category.delete", { categoryId: "cat_1" }, "prop_1"),
    ).rejects.toThrow("Forbidden: no edit access to budget");
    expect(aiProposalUpdate).not.toHaveBeenCalled();
    expect(budgetCategoryDelete).not.toHaveBeenCalled();
  });
});

describe("book.section.delete", () => {
  it("refuses a section that still has cards before any snapshot or delete", async () => {
    bookSectionRow = {
      id: "sec_1",
      slug: "food-drink",
      title: "Food & Drink",
      visibility: "EVERYONE",
      _count: { subsections: 2 },
    };
    await expect(
      applyDeleteProposal(couple, "book.section.delete", { sectionId: "sec_1" }, "prop_2"),
    ).rejects.toThrow('Can\'t delete "Food & Drink" — 2 cards still in this section.');
    expect(aiProposalUpdate).not.toHaveBeenCalled();
    expect(bookSectionDelete).not.toHaveBeenCalled();
  });

  it("refuses a couple-only section for a non-couple caller with book EDIT", async () => {
    permissionRows = [{ section: "book", level: "EDIT" }];
    bookSectionRow = {
      id: "sec_1",
      slug: "surprises",
      title: "Surprises",
      visibility: "COUPLE_ONLY",
      _count: { subsections: 0 },
    };
    await expect(
      applyDeleteProposal(member, "book.section.delete", { sectionId: "sec_1" }, "prop_2"),
    ).rejects.toThrow("couple-only");
    expect(aiProposalUpdate).not.toHaveBeenCalled();
    expect(bookSectionDelete).not.toHaveBeenCalled();
  });

  it("deletes an empty section, snapshot first", async () => {
    bookSectionRow = {
      id: "sec_1",
      slug: "old-ideas",
      title: "Old ideas",
      visibility: "EVERYONE",
      _count: { subsections: 0 },
    };
    const result = await applyDeleteProposal(
      couple,
      "book.section.delete",
      { sectionId: "sec_1" },
      "prop_2",
    );
    expect(result).toEqual({ id: "sec_1" });
    expect(callOrder).toEqual(["snapshot", "delete"]);
  });
});

describe("guest.hard_delete", () => {
  const archivedGuest = {
    id: "g_1",
    firstName: "Typo",
    lastName: "Row",
    archived: true,
    household: { id: "h_1", name: "Row household" },
    plusOnes: [],
    songRequests: [],
    groups: [],
  };

  it("refuses an unarchived guest — archive first, same as hardDeleteGuest", async () => {
    guestRow = { ...archivedGuest, archived: false };
    await expect(
      applyDeleteProposal(couple, "guest.hard_delete", { guestId: "g_1" }, "prop_3"),
    ).rejects.toThrow("Archive the guest first");
    expect(aiProposalUpdate).not.toHaveBeenCalled();
    expect(guestDelete).not.toHaveBeenCalled();
  });

  it("refuses a non-couple caller even with guests EDIT, and audits the denial", async () => {
    permissionRows = [{ section: "guests", level: "EDIT" }];
    guestRow = archivedGuest;
    await expect(
      applyDeleteProposal(member, "guest.hard_delete", { guestId: "g_1" }, "prop_3"),
    ).rejects.toThrow("Forbidden: only the couple can permanently delete a guest");
    expect(guestDelete).not.toHaveBeenCalled();
    const audit = auditCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(audit.data).toMatchObject({ action: "guests_denied", entity: "Guest" });
  });

  it("hard-deletes an archived guest, snapshot first", async () => {
    guestRow = archivedGuest;
    const result = await applyDeleteProposal(
      couple,
      "guest.hard_delete",
      { guestId: "g_1" },
      "prop_3",
    );
    expect(result).toEqual({ id: "g_1" });
    expect(callOrder).toEqual(["snapshot", "delete"]);
    const audit = auditCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(audit.data).toMatchObject({ action: "hard_delete", entity: "Guest" });
  });
});

describe("dispatch", () => {
  it("throws on an unknown kind", async () => {
    await expect(
      applyDeleteProposal(couple, "guest.delete", { guestId: "g_1" }, "prop_4"),
    ).rejects.toThrow("Unknown delete proposal kind: guest.delete");
  });
});
