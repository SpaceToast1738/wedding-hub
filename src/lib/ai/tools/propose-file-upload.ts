import { z } from "zod";
import { db } from "@/lib/db";
import { fileUploadSchema, FILE_VISIBILITIES } from "@/lib/ai/proposals/schemas";
import { ALLOWED_MIME_TYPES } from "@/lib/uploads";
import {
  MAX_AI_UPLOAD_BYTES,
  decodeBase64Content,
  stageUpload,
} from "@/lib/ai/uploads-staging";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// v2.9.0: proposal-gated upload into the Files module. The decoded
// bytes are staged on disk immediately (src/lib/ai/uploads-staging.ts)
// — NOT embedded in the proposal row, which stores only a reference —
// and become a real File row when a human (or a canApply token)
// applies the proposal. Dismissing deletes the staged file; abandoned
// stages are swept after 7 days.
//
// Cap is 10 MB (MAX_AI_UPLOAD_BYTES) — deliberately below the app's
// human 25 MB budget. Base64 inflates ~4/3, so the schema's string cap
// leaves headroom over 10 MB of decoded bytes without admitting
// grossly oversized payloads. The MCP transport caps (Caddy :8090 +
// the route's body cap) are sized to admit this.
const MAX_BASE64_CHARS = Math.ceil((MAX_AI_UPLOAD_BYTES * 4) / 3) + 1024;

const inputSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(200)
    .describe("Display name for the file, e.g. 'florist-quote.pdf'."),
  mimeType: z
    .string()
    .min(1)
    .max(150)
    .describe("The file's MIME type, e.g. 'application/pdf'. Must be on the app's allowlist."),
  contentBase64: z
    .string()
    .min(1)
    .max(MAX_BASE64_CHARS)
    .describe("The file's bytes, base64-encoded. Max 10 MB decoded."),
  folder: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .describe("Optional folder label, e.g. 'contracts', 'quotes', 'inspiration'."),
  visibility: z
    .enum(FILE_VISIBILITIES)
    .optional()
    .describe("EVERYONE (default) or COUPLE_ONLY."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining why this file belongs in the app. Shown to the couple."),
});

export const proposeFileUpload: AiTool<typeof inputSchema> = {
  name: "propose_file_upload",
  description:
    "Propose uploading a file (max 10 MB, base64-encoded) into the app's Files module — e.g. a quote PDF the user shared, a CSV export, an inspiration image. Writes a proposal — the file does NOT appear in Files until the couple Applies it (Dismiss deletes the staged bytes). Allowed types: PDF, images (PNG/JPG/WEBP/GIF/HEIC), text/CSV, Word, Excel, PowerPoint, zip. Pick a sensible folder label and use COUPLE_ONLY visibility for anything the wedding party shouldn't see.",
  inputSchema,
  progressLabel: "Staging file upload…",
  definition: {
    name: "propose_file_upload",
    description:
      "Propose uploading a base64-encoded file (max 10 MB) into the Files module. Writes a proposal — the file is staged and only becomes visible when applied; dismissing deletes it. MIME type must be on the app allowlist (PDF, images, text/CSV, Office, zip).",
    input_schema: {
      type: "object",
      properties: {
        filename: { type: "string", description: "Display name, e.g. 'florist-quote.pdf'." },
        mimeType: {
          type: "string",
          description: "MIME type, e.g. 'application/pdf', 'image/png', 'text/csv'.",
        },
        contentBase64: { type: "string", description: "Base64-encoded bytes. Max 10 MB decoded." },
        folder: {
          type: ["string", "null"],
          description: "Optional folder label, e.g. 'contracts'.",
        },
        visibility: {
          type: "string",
          enum: [...FILE_VISIBILITIES],
          description: "EVERYONE (default) or COUPLE_ONLY.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why. Shown to the couple.",
        },
      },
      required: ["filename", "mimeType", "contentBase64", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    // MIME allowlist first — cheapest check, clearest message.
    if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
      return {
        ok: false,
        error: `File type "${input.mimeType}" isn't allowed. Try PDF, image (PNG/JPG/WEBP), text/CSV, Word, Excel, PowerPoint, or zip.`,
      };
    }

    const bytes = decodeBase64Content(input.contentBase64);
    if (!bytes || bytes.length === 0) {
      return { ok: false, error: "contentBase64 isn't valid base64 (or decodes to zero bytes)." };
    }
    if (bytes.length > MAX_AI_UPLOAD_BYTES) {
      return {
        ok: false,
        error: `File is too large for an AI upload (${(bytes.length / (1024 * 1024)).toFixed(1)} MB — max 10 MB). Ask the user to upload it on the Files page instead (25 MB limit there).`,
      };
    }

    // Stage the bytes on disk (also TTL-sweeps abandoned stages). If
    // the proposal insert below fails, the orphaned stage is caught by
    // the same sweep within 7 days.
    const { stagedName } = await stageUpload(bytes, input.mimeType, input.filename);

    const payloadResult = fileUploadSchema.safeParse({
      stagedName,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: bytes.length,
      folder: input.folder ?? null,
      visibility: input.visibility ?? "EVERYONE",
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "file.upload",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const sizeLabel =
      bytes.length >= 1024 * 1024
        ? `${(bytes.length / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(bytes.length / 1024))} KB`;
    const detailBits = [input.mimeType, sizeLabel];
    if (input.folder) detailBits.push(`folder "${input.folder}"`);
    if ((input.visibility ?? "EVERYONE") === "COUPLE_ONLY") detailBits.push("couple-only");

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "file.upload",
        title: `Upload "${input.filename}"`,
        detail: detailBits.join(" · "),
        message:
          "File staged and proposal queued — it appears in Files only when applied; dismissing deletes the staged file.",
      },
    };
  },
};
