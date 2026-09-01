// v2.13.2: book.card.create apply bridge (src/lib/ai/apply/book.ts) +
// the propose tool's input contract. The bug: a TEXT card proposed WITH
// a body applied as a blank card. Two halves — the body was posted to
// the create core's legacy plain `body` column, which the renderer /
// read_book_card / the replace_text staleness hash don't read first,
// and the propose tool silently stripped a body sent under the wrong
// key (`bodyText`, the name read_book_card returns it under). Now the
// body lands in `bodyHtml` via the same markdown renderer as
// replace_text, and an unknown key is an error that names the key.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/actions";

const sectionFindUnique = vi.fn(async () => ({ visibility: "EVERYONE" }));
const subFindFirst = vi.fn(async () => null);
const subCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
  id: "card_1",
  ...args.data,
}));
const subFindUnique = vi.fn(async () => ({
  title: "Escape Box Game",
  bodyHtml: null,
  body: null,
}));
const subUpdate = vi.fn(
  async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
    id: args.where.id,
    title: args.data.title,
    bodyHtml: args.data.bodyHtml ?? null,
    body: null,
    section: { id: "sec_1", slug: "guest-experience" },
  }),
);
const auditCreate = vi.fn(async () => ({}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    bookSection: { findUnique: sectionFindUnique },
    bookSubsection: {
      findFirst: subFindFirst,
      create: subCreate,
      findUnique: subFindUnique,
      update: subUpdate,
    },
    auditLog: { create: auditCreate, deleteMany: vi.fn(async () => ({ count: 0 })) },
  },
}));
// React.cache shim — permissions helpers ride the registry import graph.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

const { applyBookProposal } = await import("@/lib/ai/apply/book");
const { proposeBookCardCreate } = await import("@/lib/ai/tools/propose-book-card-create");

const COUPLE: SessionUser = {
  id: "u_couple",
  email: "u@example.com",
  name: null,
  isCouple: true,
  role: "COUPLE",
};

const BODY = [
  "### Escape Box Game",
  "",
  "A locked box on each table — solve the clues to open it.",
  "",
  "- clue one",
  "- clue two",
].join("\n");

beforeEach(() => vi.clearAllMocks());

describe("book.card.create apply — body lands in bodyHtml", () => {
  it("renders a TEXT body through the markdown subset into bodyHtml", async () => {
    const result = await applyBookProposal(COUPLE, "book.card.create", {
      sectionId: "sec_1",
      title: "Escape Box Game",
      kind: "TEXT",
      body: BODY,
    });
    expect(result).toEqual({ id: "card_1" });

    // The create itself no longer carries the body — the legacy column
    // is not where anything reads from.
    expect(subCreate).toHaveBeenCalledTimes(1);
    const createData = subCreate.mock.calls[0]![0].data;
    expect(createData.body ?? null).toBeNull();

    // The body arrives as rendered HTML on the created card.
    expect(subUpdate).toHaveBeenCalledTimes(1);
    const update = subUpdate.mock.calls[0]![0];
    expect(update.where).toEqual({ id: "card_1" });
    expect(update.data.title).toBe("Escape Box Game");
    const html = String(update.data.bodyHtml);
    expect(html).toContain("Escape Box Game");
    expect(html).toContain("clue one");
    expect(html).toContain("clue two");
    // Real formatting, not literal markdown symbols.
    expect(html).not.toContain("###");
    expect(html).toMatch(/<(h[1-6]|p|li)\b/);
  });

  it("skips the body write when no body was given", async () => {
    await applyBookProposal(COUPLE, "book.card.create", {
      sectionId: "sec_1",
      title: "Placeholder",
      kind: "TEXT",
      body: null,
    });
    expect(subCreate).toHaveBeenCalledTimes(1);
    expect(subUpdate).not.toHaveBeenCalled();
  });

  it("skips the body write for a whitespace-only body", async () => {
    await applyBookProposal(COUPLE, "book.card.create", {
      sectionId: "sec_1",
      title: "Placeholder",
      kind: "TEXT",
      body: "   \n  ",
    });
    expect(subUpdate).not.toHaveBeenCalled();
  });
});

describe("propose_book_card_create input — unknown keys are loud", () => {
  const base = { sectionId: "sec_1", title: "Escape Box Game", rationale: "Because." };

  it("accepts the documented shape", () => {
    const r = proposeBookCardCreate.inputSchema.safeParse({ ...base, kind: "TEXT", body: BODY });
    expect(r.success).toBe(true);
  });

  it("rejects a body sent as `bodyText` and names the key", () => {
    const r = proposeBookCardCreate.inputSchema.safeParse({ ...base, bodyText: BODY });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.message).toContain("bodyText");
  });

  it("rejects a body sent as `text` (replace_text's name) and names the key", () => {
    const r = proposeBookCardCreate.inputSchema.safeParse({ ...base, text: BODY });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.message).toContain("text");
  });
});
