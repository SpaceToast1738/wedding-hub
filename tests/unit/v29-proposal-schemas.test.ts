// v2.9.0: payload schemas + labels for the three new proposal kinds
// (src/lib/ai/proposals/schemas.ts). Focus: the nothing-to-change
// refinements, the fileUploadSchema tamper fences (staged-name
// pattern, 10 MB cap), and every new kind resolving through
// schemaForKind / humanLabel / summariseProposal so the /ai review
// list can render it.

import { describe, expect, it } from "vitest";
import {
  bookSectionUpdateSchema,
  fileUploadSchema,
  humanLabel,
  schemaForKind,
  summariseProposal,
  supplierContactUpdateSchema,
} from "@/lib/ai/proposals/schemas";

const STAGED = `pending-${"a".repeat(32)}.pdf`;

describe("supplierContactUpdateSchema", () => {
  it("requires at least one changed field beyond contactId", () => {
    expect(supplierContactUpdateSchema.safeParse({ contactId: "c1" }).success).toBe(false);
    expect(
      supplierContactUpdateSchema.safeParse({ contactId: "c1", phone: "07700 900123" }).success,
    ).toBe(true);
    // primary:false alone is a real change (unmark).
    expect(
      supplierContactUpdateSchema.safeParse({ contactId: "c1", primary: false }).success,
    ).toBe(true);
  });

  it("keeps null (clear) distinct from omitted (keep)", () => {
    const parsed = supplierContactUpdateSchema.parse({ contactId: "c1", role: null });
    expect(parsed.role).toBeNull();
    expect(parsed.email).toBeUndefined();
  });
});

describe("bookSectionUpdateSchema", () => {
  it("requires title and/or subtitle", () => {
    expect(bookSectionUpdateSchema.safeParse({ sectionId: "s1" }).success).toBe(false);
    expect(
      bookSectionUpdateSchema.safeParse({ sectionId: "s1", subtitle: null }).success,
    ).toBe(true);
    expect(
      bookSectionUpdateSchema.safeParse({ sectionId: "s1", title: "Honeymoon" }).success,
    ).toBe(true);
  });

  it("has no slug field — the slug can never ride a payload", () => {
    const parsed = bookSectionUpdateSchema.parse({
      sectionId: "s1",
      title: "New title",
      // Unknown keys are stripped by the non-strict schema.
      slug: "attacker-slug",
    } as Record<string, unknown>);
    expect("slug" in parsed).toBe(false);
  });
});

describe("fileUploadSchema", () => {
  const base = {
    stagedName: STAGED,
    filename: "quote.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1234,
    folder: null,
    visibility: "EVERYONE",
  };

  it("accepts a well-formed payload and defaults visibility", () => {
    const parsed = fileUploadSchema.parse({ ...base, visibility: undefined });
    expect(parsed.visibility).toBe("EVERYONE");
  });

  it("rejects traversal-shaped and non-minted staged names", () => {
    for (const bad of [
      "pending-../../etc/passwd",
      "pending-zzz.pdf",
      `${"a".repeat(32)}.pdf`,
      `pending-${"a".repeat(32)}`,
      "",
    ]) {
      expect(
        fileUploadSchema.safeParse({ ...base, stagedName: bad }).success,
        bad,
      ).toBe(false);
    }
  });

  it("caps sizeBytes at 10 MB", () => {
    expect(
      fileUploadSchema.safeParse({ ...base, sizeBytes: 10 * 1024 * 1024 }).success,
    ).toBe(true);
    expect(
      fileUploadSchema.safeParse({ ...base, sizeBytes: 10 * 1024 * 1024 + 1 }).success,
    ).toBe(false);
    expect(fileUploadSchema.safeParse({ ...base, sizeBytes: 0 }).success).toBe(false);
  });
});

describe("kind wiring", () => {
  const KINDS = ["supplier.contact.update", "book.section.update", "file.upload"] as const;

  it("every new kind resolves a schema and a label", () => {
    for (const kind of KINDS) {
      expect(schemaForKind(kind), kind).not.toBeNull();
      expect(humanLabel(kind), kind).toBeTruthy();
    }
  });

  it("summaries are non-empty and flag the risky bits", () => {
    expect(
      summariseProposal("supplier.contact.update", { contactId: "c1", primary: true }),
    ).toContain("PRIMARY");
    expect(
      summariseProposal("book.section.update", { sectionId: "s1", title: "Honeymoon" }),
    ).toContain("slug unchanged");
    const fileSummary = summariseProposal("file.upload", {
      stagedName: STAGED,
      filename: "quote.pdf",
      sizeBytes: 2 * 1024 * 1024,
      folder: "quotes",
      visibility: "COUPLE_ONLY",
    });
    expect(fileSummary).toContain("quote.pdf");
    expect(fileSummary).toContain("2.0 MB");
    expect(fileSummary).toContain("couple-only");
    // The internal staged name never leaks into the summary line.
    expect(fileSummary).not.toContain("pending-");
  });
});
