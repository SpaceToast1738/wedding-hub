// v2.9.0: book.section.update apply bridge (src/lib/ai/apply/book.ts)
// + updateBookSectionCore (src/lib/core/book.ts). The two invariants
// that matter: the SLUG IS NEVER WRITTEN (rename must not break
// /book/<slug> links or sectionSlug references), and the COUPLE_ONLY
// visibility wall binds non-couple ai_write holders — same wall as
// book.section.delete.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/actions";

let sectionRow: Record<string, unknown> | null = null;

const sectionFindUnique = vi.fn(async () => sectionRow);
const sectionUpdate = vi.fn(
  async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
    ...(sectionRow as Record<string, unknown>),
    ...args.data,
  }),
);
const auditCreate = vi.fn(async (_args: unknown) => ({}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    bookSection: { findUnique: sectionFindUnique, update: sectionUpdate },
    auditLog: { create: auditCreate, deleteMany: vi.fn(async () => ({ count: 0 })) },
  },
}));
// React.cache shim — permissions helpers ride the registry import graph.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

const { applyBookProposal } = await import("@/lib/ai/apply/book");

function userFor(isCouple: boolean): SessionUser {
  return {
    id: isCouple ? "u_couple" : "u_member",
    email: "u@example.com",
    name: null,
    isCouple,
    role: isCouple ? "COUPLE" : "VIEWER",
  };
}

beforeEach(() => {
  sectionRow = {
    id: "sec_1",
    slug: "food-drink",
    title: "Food & Drink",
    subtitle: "What we're serving",
    visibility: "EVERYONE",
  };
  vi.clearAllMocks();
});

describe("book.section.update apply", () => {
  it("renames title + subtitle without EVER writing the slug", async () => {
    const result = await applyBookProposal(userFor(true), "book.section.update", {
      sectionId: "sec_1",
      title: "Menus & Drinks",
      subtitle: null,
    });
    expect(result).toEqual({ id: "sec_1" });
    const update = sectionUpdate.mock.calls[0]![0] as unknown as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(update.where).toEqual({ id: "sec_1" });
    expect(update.data).toEqual({ title: "Menus & Drinks", subtitle: null });
    expect("slug" in update.data).toBe(false);
    // Audit records the change with the (unchanged) slug for context.
    const audit = auditCreate.mock.calls[0]![0] as unknown as { data: Record<string, unknown> };
    expect(audit.data).toMatchObject({ action: "update", entity: "BookSection" });
    expect(audit.data.metadata).toMatchObject({
      slug: "food-drink",
      changedFields: ["title", "subtitle"],
    });
  });

  it("keeps the current value for omitted fields (undefined = keep)", async () => {
    await applyBookProposal(userFor(true), "book.section.update", {
      sectionId: "sec_1",
      subtitle: "New strapline",
    });
    const update = sectionUpdate.mock.calls[0]![0] as unknown as {
      data: Record<string, unknown>;
    };
    // Title untouched by the payload → the live title is carried through.
    expect(update.data.title).toBe("Food & Drink");
    expect(update.data.subtitle).toBe("New strapline");
  });

  it("walls off COUPLE_ONLY sections from non-couple appliers", async () => {
    sectionRow = { ...sectionRow!, visibility: "COUPLE_ONLY" };
    await expect(
      applyBookProposal(userFor(false), "book.section.update", {
        sectionId: "sec_1",
        title: "Sneaky rename",
      }),
    ).rejects.toThrow("couple-only");
    expect(sectionUpdate).not.toHaveBeenCalled();
  });

  it("throws a clear not-found when the section is gone", async () => {
    sectionRow = null;
    await expect(
      applyBookProposal(userFor(true), "book.section.update", {
        sectionId: "sec_gone",
        title: "Whatever",
      }),
    ).rejects.toThrow("Book section not found");
  });

  it("refuses an empty patch at the schema fence", async () => {
    await expect(
      applyBookProposal(userFor(true), "book.section.update", { sectionId: "sec_1" }),
    ).rejects.toThrow();
    expect(sectionUpdate).not.toHaveBeenCalled();
  });
});
