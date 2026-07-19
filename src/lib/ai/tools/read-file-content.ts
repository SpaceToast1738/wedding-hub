// v2.8.0: file CONTENT read — the one gap read_files deliberately
// left. Read-only forever (uploads need real bytes, deletes destroy
// disk data); this tool only ever streams stored bytes back out as
// text. Guardrails, in order:
//   - canView("files") gate + the same COUPLE_ONLY probe defence as
//     the download route (unknown id and hidden id are the SAME error,
//     so a non-couple caller can't confirm a couple-only file exists).
//   - 10 MB read cap — contracts and CSVs fit comfortably; a giant
//     photo dump can't be pulled through the context window.
//   - Extraction only for text/*, JSON, and PDF. Everything else
//     (images, Office docs, zips) is refused by name — no binary soup.
//   - Output capped at 16k chars with the registry-style truncation
//     marker (the registry's own 24k cap still backstops the
//     serialized result).
// Money caveat: unlike every other read tool, file text is returned
// VERBATIM — there is no field-level redaction to apply to a contract
// PDF. That's the agreed trade-off for file access (see the v2.8.0
// plan); the tool description warns the model that amounts may appear.

import { readFile } from "node:fs/promises";
import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import { resolveStoredPath } from "@/lib/uploads";
import type { AiTool } from "./types";

const inputSchema = z.object({
  fileId: z
    .string()
    .min(1)
    .max(100)
    .describe("File id — get this from read_files, never invent one."),
});

/** Hard cap on bytes pulled off disk. Well under MAX_UPLOAD_BYTES
 *  (25 MB) on purpose: anything bigger than this is a photo/scan, not
 *  a document worth text-extracting. */
const MAX_READ_BYTES = 10 * 1024 * 1024;

/** Cap on the extracted text handed back to the model. Below the
 *  registry's 24k serialized-result ceiling so the marker (not a blind
 *  mid-JSON chop) is what the model sees. */
// Sits deliberately below the registry's 24,000-char cap on the
// SERIALIZED tool result (registry.ts MAX_TOOL_RESULT_CHARS): once the
// content is JSON-escaped and wrapped, 20k of raw text could push the
// serialized form past 24k, and the registry would then re-truncate
// with a blind mid-string chop — burying this tool's own friendly
// marker. 16k leaves room for the JSON wrapper plus normal escaping.
const MAX_CONTENT_CHARS = 16_000;

function capContent(text: string): { content: string; truncated: boolean } {
  if (text.length <= MAX_CONTENT_CHARS) return { content: text, truncated: false };
  return {
    content:
      text.slice(0, MAX_CONTENT_CHARS) +
      `\n…[truncated at ${MAX_CONTENT_CHARS} chars — open the full file on /files]`,
    truncated: true,
  };
}

/** Null-byte strip. Uploaded "text" files occasionally arrive UTF-16
 *  or with embedded NULs (Excel CSV exports, Windows editors), and PDF
 *  extraction can surface them too — stripping U+0000 keeps the
 *  JSON-serialized tool result clean without pretending to be a full
 *  charset sniffer. */
function stripNulls(s: string): string {
  return s.replace(/\u0000/g, "");
}

function decodeText(bytes: Buffer): string {
  return stripNulls(bytes.toString("utf8"));
}

// Dynamic import on purpose: pdf-parse drags in pdfjs-dist (~1 MB of
// JS plus the native @napi-rs/canvas addon), which most calls — text
// and CSV reads — never need. It's also the failure isolation seam:
// if the native dep didn't install in some environment, the import
// rejects and the caller reports extraction as unsupported instead of
// the whole tool module failing to load (kept distinct from the
// corrupt-PDF error so a deploy problem doesn't masquerade as a bad
// file). Kept out of the webpack bundle via serverExternalPackages in
// next.config.ts.
async function loadPdfParser(): Promise<typeof import("pdf-parse").PDFParse | null> {
  try {
    return (await import("pdf-parse")).PDFParse;
  } catch {
    return null;
  }
}

async function extractPdfText(
  PDFParse: NonNullable<Awaited<ReturnType<typeof loadPdfParser>>>,
  bytes: Buffer,
): Promise<string> {
  // Copy: pdfjs takes ownership of (and may detach) the array it's given.
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const result = await parser.getText();
    // The default pageJoiner stamps "-- 1 of N --" markers into .text —
    // useful for citing a page, but they'd make an image-only scan look
    // non-empty. Judge emptiness on the per-page text instead.
    const hasText = result.pages.some((p) => p.text.trim().length > 0);
    return hasText ? result.text : "";
  } finally {
    await parser.destroy();
  }
}

export const readFileContent: AiTool<typeof inputSchema> = {
  name: "read_file_content",
  description:
    "Read the TEXT CONTENT of one uploaded file by id (get ids from read_files). Supported: plain text, CSV, JSON, and PDF (text extraction — scanned/image-only PDFs have no extractable text). Refused: images, Word/Excel/PowerPoint, zips, and anything over 10 MB. Content is returned verbatim and truncated at 16000 chars. NOTE: unlike other read tools there is no money redaction here — contract PDFs and similar files may contain real amounts; treat them with the same discretion as the rest of the couple's financial data. Never returns download paths.",
  inputSchema,
  progressLabel: "Reading file content…",
  definition: {
    name: "read_file_content",
    description:
      "Read one uploaded file's text content by id (from read_files). Text/CSV/JSON/PDF only, 10 MB cap, output truncated at 16000 chars. Contents are verbatim — contract amounts may be visible.",
    input_schema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File id from read_files." },
      },
      required: ["fileId"],
    },
  },
  async handler(input, ctx) {
    if (!(await canView(ctx.user, "files"))) {
      return { ok: false, error: "Files aren't visible to this user." };
    }

    const file = await db.file.findUnique({
      where: { id: input.fileId },
      select: {
        id: true,
        name: true,
        folder: true,
        mimeType: true,
        sizeBytes: true,
        visibility: true,
        storedPath: true,
        createdAt: true,
      },
    });
    if (!file) {
      return { ok: false, error: "No file matches that id." };
    }

    // Same probe defence as the download route: a hidden file and a
    // missing file are indistinguishable to a non-couple caller.
    if (file.visibility === "COUPLE_ONLY" && !ctx.user.isCouple) {
      return { ok: false, error: "No file matches that id." };
    }

    if (file.sizeBytes > MAX_READ_BYTES) {
      const mb = (file.sizeBytes / 1024 / 1024).toFixed(1);
      const capMb = (MAX_READ_BYTES / 1024 / 1024).toFixed(0);
      return {
        ok: false,
        error: `"${file.name}" is too large to read (${mb} MB — the read cap is ${capMb} MB).`,
      };
    }

    const mime = file.mimeType || "application/octet-stream";
    const isText = mime.startsWith("text/") || mime === "application/json";
    const isPdf = mime === "application/pdf";
    if (!isText && !isPdf) {
      return {
        ok: false,
        error: `"${file.name}" is ${mime} — not text-extractable. Only text, CSV, JSON, and PDF files can be read; ask the couple to check it on /files.`,
      };
    }

    let bytes: Buffer;
    try {
      bytes = await readFile(resolveStoredPath(file.storedPath));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        // Mirrors the download route's 410: the DB row outlived the bytes.
        return { ok: false, error: `"${file.name}" is missing on disk.` };
      }
      throw err;
    }
    // Belt-and-braces re-check on the REAL size — sizeBytes above is
    // whatever the upload action recorded, and the cap should hold even
    // against a stale/corrupt row.
    if (bytes.length > MAX_READ_BYTES) {
      const capMb = (MAX_READ_BYTES / 1024 / 1024).toFixed(0);
      return {
        ok: false,
        error: `"${file.name}" is too large to read (the read cap is ${capMb} MB).`,
      };
    }

    let text: string;
    if (isPdf) {
      const PDFParse = await loadPdfParser();
      if (!PDFParse) {
        return { ok: false, error: "PDF text extraction not supported in this deployment." };
      }
      try {
        text = stripNulls(await extractPdfText(PDFParse, bytes));
      } catch {
        return {
          ok: false,
          error: `Couldn't extract text from "${file.name}" — the PDF may be corrupt or password-protected.`,
        };
      }
      if (!text.trim()) {
        return {
          ok: false,
          error: `"${file.name}" has no extractable text — likely a scanned/image-only PDF.`,
        };
      }
    } else {
      text = decodeText(bytes);
    }

    const { content, truncated } = capContent(text);
    return {
      ok: true,
      data: {
        id: file.id,
        name: file.name,
        folder: file.folder,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        visibility: file.visibility,
        createdAt: file.createdAt.toISOString().slice(0, 10),
        content,
        ...(truncated ? { truncated: true, totalChars: text.length } : {}),
      },
    };
  },
};
