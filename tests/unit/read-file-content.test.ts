// v2.8.0: read_file_content tool — the file-CONTENT read that
// read_files deliberately never offered. Covers the guardrail ladder
// (permission gate → probe-safe lookup → size caps → MIME allowlist)
// and the extraction paths (text decode + null-strip, truncation
// marker, PDF extraction through the unpdf seam).
//
// v2.8.2: PDF extraction moved from pdf-parse to unpdf (canvas-free
// serverless pdfjs — pdf-parse's pdfjs threw "DOMMatrix is not defined"
// in the headless alpine standalone). The extractor is mocked here so
// the handler's PDF branch (success → content, empty → "no extractable
// text", throw → "corrupt") is driven deterministically without
// depending on the pdfjs bundle resolving in the test env.
//
// UPLOADS_DIR is computed at MODULE LOAD in src/lib/uploads.ts, so the
// env override below must be in place before the tool module is
// evaluated — hence the top-level dynamic import instead of a static
// one (vi.mock calls hoist above everything either way).

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ToolContext } from "@/lib/ai/tools/types";

const uploadsDir = mkdtempSync(path.join(os.tmpdir(), "wh-read-file-content-"));
process.env.UPLOADS_DIR = uploadsDir;

type FileRow = {
  id: string;
  name: string;
  folder: string | null;
  mimeType: string;
  sizeBytes: number;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  storedPath: string;
  createdAt: Date;
};

let fileRows: Record<string, FileRow> = {};
let permissionRows: Array<{ section: string; level: string }> = [];

vi.mock("@/lib/db", () => ({
  db: {
    file: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => fileRows[args.where.id] ?? null),
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

// Stub the unpdf extractor. Each PDF test stages what the stub returns
// (its `text`) or makes it throw, so the handler's PDF branch is driven
// deterministically without loading the real pdfjs bundle. getDocumentProxy
// is the parse step that rejects on a malformed PDF → the "corrupt" branch.
const pdfMock = vi.hoisted(() => ({ text: "" as string, throws: false }));
vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn(async (data: Uint8Array) => {
    if (pdfMock.throws) throw new Error("Invalid PDF structure");
    return { _pdfInfo: {}, data };
  }),
  extractText: vi.fn(async () => {
    if (pdfMock.throws) throw new Error("Invalid PDF structure");
    return { totalPages: 1, text: pdfMock.text };
  }),
}));

const { readFileContent } = await import("@/lib/ai/tools/read-file-content");

const NUL = String.fromCharCode(0);

function ctxFor(user: { id: string; isCouple: boolean }): ToolContext {
  return {
    user: {
      id: user.id,
      email: `${user.id}@example.com`,
      name: null,
      isCouple: user.isCouple,
      role: user.isCouple ? "COUPLE" : "VIEWER",
    },
    canWrite: false,
  };
}
const coupleCtx = ctxFor({ id: "u_couple", isCouple: true });
const memberCtx = ctxFor({ id: "u_member", isCouple: false });

let fileCounter = 0;

/** Register a File row and (unless bytes === null) write its stored
 *  bytes into the temp uploads dir. */
function addFile(opts: {
  name: string;
  mimeType: string;
  bytes: Buffer | string | null;
  visibility?: "EVERYONE" | "COUPLE_ONLY";
  sizeBytes?: number;
}): string {
  fileCounter += 1;
  const id = `file_${fileCounter}`;
  const ext = opts.name.split(".").pop() ?? "bin";
  const storedPath = `stored_${fileCounter}.${ext}`;
  const bytes =
    opts.bytes === null ? null : typeof opts.bytes === "string" ? Buffer.from(opts.bytes) : opts.bytes;
  if (bytes !== null) {
    writeFileSync(path.join(uploadsDir, storedPath), bytes);
  }
  fileRows[id] = {
    id,
    name: opts.name,
    folder: null,
    mimeType: opts.mimeType,
    sizeBytes: opts.sizeBytes ?? bytes?.length ?? 0,
    visibility: opts.visibility ?? "EVERYONE",
    storedPath,
    createdAt: new Date("2026-07-01T12:00:00Z"),
  };
  return id;
}

beforeEach(() => {
  fileRows = {};
  permissionRows = [];
  pdfMock.text = "";
  pdfMock.throws = false;
});

afterAll(() => {
  rmSync(uploadsDir, { recursive: true, force: true });
});

describe("read_file_content — gates", () => {
  it("refuses a caller without files visibility", async () => {
    const id = addFile({ name: "notes.txt", mimeType: "text/plain", bytes: "hello" });
    const result = await readFileContent.handler({ fileId: id }, memberCtx);
    expect(result).toEqual({ ok: false, error: "Files aren't visible to this user." });
  });

  it("allows a non-couple caller with files VIEW", async () => {
    permissionRows = [{ section: "files", level: "VIEW" }];
    const id = addFile({ name: "notes.txt", mimeType: "text/plain", bytes: "hello" });
    const result = await readFileContent.handler({ fileId: id }, memberCtx);
    expect(result.ok).toBe(true);
  });

  it("returns the same error for an unknown id and a couple-only file (probe defence)", async () => {
    permissionRows = [{ section: "files", level: "VIEW" }];
    const hiddenId = addFile({
      name: "contract.txt",
      mimeType: "text/plain",
      bytes: "secret",
      visibility: "COUPLE_ONLY",
    });
    const missing = await readFileContent.handler({ fileId: "file_nope" }, memberCtx);
    const hidden = await readFileContent.handler({ fileId: hiddenId }, memberCtx);
    expect(missing.ok).toBe(false);
    expect(hidden).toEqual(missing);
  });

  it("lets the couple read a couple-only file", async () => {
    const id = addFile({
      name: "contract.txt",
      mimeType: "text/plain",
      bytes: "secret terms",
      visibility: "COUPLE_ONLY",
    });
    const result = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as { content: string }).content).toBe("secret terms");
    }
  });
});

describe("read_file_content — size + MIME guards", () => {
  it("refuses a file whose DB row exceeds the 10 MB cap without touching disk", async () => {
    const id = addFile({
      name: "huge.csv",
      mimeType: "text/csv",
      bytes: null, // nothing on disk — proves the refusal is DB-only
      sizeBytes: 11 * 1024 * 1024,
    });
    const result = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("too large");
  });

  it("refuses when the ON-DISK size exceeds the cap even if the row lies", async () => {
    const id = addFile({
      name: "sneaky.txt",
      mimeType: "text/plain",
      bytes: Buffer.alloc(10 * 1024 * 1024 + 1, 97), // "a" × (10MB + 1)
      sizeBytes: 100, // corrupt row claiming tiny
    });
    const result = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("too large");
  });

  it("refuses a non-extractable MIME by name", async () => {
    const id = addFile({ name: "venue.png", mimeType: "image/png", bytes: "not-really-a-png" });
    const result = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("image/png");
      expect(result.error).toContain("venue.png");
    }
  });

  it("reports a row whose bytes are gone from disk", async () => {
    const id = addFile({ name: "ghost.txt", mimeType: "text/plain", bytes: null });
    const result = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(result).toEqual({ ok: false, error: '"ghost.txt" is missing on disk.' });
  });
});

describe("read_file_content — text extraction", () => {
  it("reads a plain-text file verbatim with its metadata", async () => {
    const id = addFile({
      name: "checklist.txt",
      mimeType: "text/plain",
      bytes: "book the florist\nconfirm the band",
    });
    const result = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as Record<string, unknown>;
      expect(data.content).toBe("book the florist\nconfirm the band");
      expect(data.name).toBe("checklist.txt");
      expect(data.mimeType).toBe("text/plain");
      expect(data.createdAt).toBe("2026-07-01");
      expect(data.truncated).toBeUndefined();
      // Never leak the disk path.
      expect(JSON.stringify(data)).not.toContain("stored_");
    }
  });

  it("reads JSON and CSV MIME types", async () => {
    const jsonId = addFile({ name: "data.json", mimeType: "application/json", bytes: '{"a":1}' });
    const csvId = addFile({ name: "guests.csv", mimeType: "text/csv", bytes: "name,rsvp\nJo,YES" });
    const jsonResult = await readFileContent.handler({ fileId: jsonId }, coupleCtx);
    const csvResult = await readFileContent.handler({ fileId: csvId }, coupleCtx);
    expect(jsonResult.ok).toBe(true);
    expect(csvResult.ok).toBe(true);
  });

  it("strips embedded null bytes from text content", async () => {
    const id = addFile({
      name: "export.csv",
      mimeType: "text/csv",
      bytes: `na${NUL}me,rsvp${NUL}`,
    });
    const result = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as { content: string }).content).toBe("name,rsvp");
    }
  });

  it("truncates long content at 16000 chars with the marker", async () => {
    const id = addFile({
      name: "novel.txt",
      mimeType: "text/plain",
      bytes: "x".repeat(25_000),
    });
    const result = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { content: string; truncated?: boolean; totalChars?: number };
      expect(data.content).toContain("[truncated at 16000 chars");
      expect(data.content.length).toBeLessThan(20_100);
      expect(data.truncated).toBe(true);
      expect(data.totalChars).toBe(25_000);
    }
  });
});

describe("read_file_content — offset paging (v2.11.0)", () => {
  type Paged = {
    content: string;
    truncated?: boolean;
    totalChars: number;
    page: {
      offset: number;
      returnedChars: number;
      totalChars: number;
      nextOffset: number | null;
    };
  };

  // 21,139 chars is the real Alveston Manor contract that exposed this
  // gap — clauses 8+ sat past the 16k cap with no way to reach them.
  const LONG = "abcdefghij".repeat(2114) + "TAIL-CLAUSE-8.1";

  it("reports nextOffset on the first slice and returns the remainder from it", async () => {
    const id = addFile({ name: "contract.txt", mimeType: "text/plain", bytes: LONG });

    const first = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const p1 = first.data as Paged;
    expect(p1.page.offset).toBe(0);
    expect(p1.page.nextOffset).toBe(16_000);
    expect(p1.page.totalChars).toBe(LONG.length);
    expect(p1.truncated).toBe(true);

    const second = await readFileContent.handler(
      { fileId: id, offset: p1.page.nextOffset! },
      coupleCtx,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const p2 = second.data as Paged;
    // The tail that used to be unreachable.
    expect(p2.content).toContain("TAIL-CLAUSE-8.1");
    expect(p2.page.nextOffset).toBeNull();
    expect(p2.truncated).toBeUndefined();
    expect(p2.content).not.toContain("[truncated at");
  });

  it("reassembles the exact original text by following nextOffset", async () => {
    const id = addFile({ name: "contract.txt", mimeType: "text/plain", bytes: LONG });
    let offset: number | null = 0;
    let assembled = "";
    let calls = 0;
    while (offset !== null) {
      const r = await readFileContent.handler({ fileId: id, offset }, coupleCtx);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const p = r.data as Paged;
      assembled += p.content.slice(0, p.page.returnedChars);
      offset = p.page.nextOffset;
      if (++calls > 10) throw new Error("nextOffset failed to terminate");
    }
    expect(assembled).toBe(LONG);
    expect(calls).toBe(2);
  });

  it("excludes the truncation marker from returnedChars", async () => {
    const id = addFile({ name: "contract.txt", mimeType: "text/plain", bytes: LONG });
    const r = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.data as Paged;
    expect(p.page.returnedChars).toBe(16_000);
    expect(p.content.length).toBeGreaterThan(16_000); // marker is extra
  });

  it("rejects an offset past the end with the real length", async () => {
    const id = addFile({ name: "short.txt", mimeType: "text/plain", bytes: "tiny" });
    const r = await readFileContent.handler({ fileId: id, offset: 500 }, coupleCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("4 chars");
  });

  it("pages PDF-extracted text on the same character offsets", async () => {
    pdfMock.text = LONG;
    const id = addFile({ name: "contract.pdf", mimeType: "application/pdf", bytes: "%PDF-1.4" });
    const r = await readFileContent.handler({ fileId: id, offset: 16_000 }, coupleCtx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.data as Paged;
    expect(p.content).toContain("TAIL-CLAUSE-8.1");
    expect(p.page.nextOffset).toBeNull();
  });

  it("defaults to offset 0 when omitted (unchanged for short files)", async () => {
    const id = addFile({ name: "note.txt", mimeType: "text/plain", bytes: "book the florist" });
    const r = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.data as Paged;
    expect(p.content).toBe("book the florist");
    expect(p.page).toEqual({
      offset: 0,
      returnedChars: 16,
      totalChars: 16,
      nextOffset: null,
    });
  });
});

describe("read_file_content — PDF extraction (via unpdf)", () => {
  it("extracts text from a PDF via unpdf", async () => {
    pdfMock.text = "Hello Wedding";
    const id = addFile({
      name: "contract.pdf",
      mimeType: "application/pdf",
      bytes: "%PDF-1.4 has-text",
    });
    const result = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as { content: string }).content).toContain("Hello Wedding");
    }
  });

  it("strips NULs and truncates extracted PDF text at 16000 chars", async () => {
    // unpdf can surface embedded NULs; the handler null-strips then caps.
    const NUL = String.fromCharCode(0);
    pdfMock.text = `${NUL}${"y".repeat(25_000)}`;
    const id = addFile({
      name: "long-contract.pdf",
      mimeType: "application/pdf",
      bytes: "%PDF-1.4 long",
    });
    const result = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { content: string; truncated?: boolean; totalChars?: number };
      expect(data.content).not.toContain(NUL);
      expect(data.content).toContain("[truncated at 16000 chars");
      expect(data.truncated).toBe(true);
      expect(data.totalChars).toBe(25_000); // after NUL-strip, before cap
    }
  });

  it("reports a PDF with no extractable text", async () => {
    pdfMock.text = ""; // image-only/scanned PDF: unpdf returns empty text
    const id = addFile({
      name: "scan.pdf",
      mimeType: "application/pdf",
      bytes: "%PDF-1.4 image-only",
    });
    const result = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("no extractable text");
  });

  it("reports a corrupt PDF cleanly instead of throwing", async () => {
    pdfMock.throws = true; // unpdf rejects when it can't parse the PDF
    const id = addFile({
      name: "broken.pdf",
      mimeType: "application/pdf",
      bytes: "this is not a pdf at all",
    });
    const result = await readFileContent.handler({ fileId: id }, coupleCtx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("corrupt or password-protected");
  });
});
