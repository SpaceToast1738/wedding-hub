// v2.9.0: apply handler for the file.upload proposal kind.
//
// The propose_file_upload tool stages decoded bytes on disk
// (src/lib/ai/uploads-staging.ts) and the proposal payload references
// the stage by name — no bytes ever live in the AiProposal row. Apply
// promotes the stage into a real upload: rename to the final stored
// name FIRST (atomic on the same volume), then create the File row —
// mirroring the human uploadFile action's write-bytes-then-insert
// order, audit shape ("upload" on entity File) and /files revalidate.
// A failed row insert renames the file back to its staged name so the
// claim-rollback leaves a retryable PENDING proposal pointing at a
// live stage.
//
// Contract with applyLoadedProposal: THROW on every failure — the
// caller rolls the status claim back and the proposal stays PENDING.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { canEdit } from "@/lib/permissions";
// Type-only import — erased at compile time, so this module never
// pulls the @/auth graph into the MCP route bundle (same convention
// as src/lib/core/*).
import type { SessionUser } from "@/lib/actions";
import { fileUploadSchema } from "@/lib/ai/proposals/schemas";
import { ALLOWED_MIME_TYPES } from "@/lib/uploads";
import {
  MAX_AI_UPLOAD_BYTES,
  finaliseStage,
  unfinaliseStage,
} from "@/lib/ai/uploads-staging";

export async function applyFileUpload(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = fileUploadSchema.parse(payload);

  // Session-free twin of requireEdit("files") — same gate the human
  // uploadFile action runs, same error text convention as the other
  // apply modules.
  if (!(await canEdit(user, "files"))) {
    throw new Error("Forbidden: no edit access to files");
  }

  // Tamper defence: the schema already fences the stagedName pattern
  // and the 10 MB sizeBytes cap; re-assert the MIME allowlist so a
  // hand-edited AiProposal row can't mint a File row with a type the
  // app would never accept from a human upload.
  if (!ALLOWED_MIME_TYPES.includes(parsed.mimeType)) {
    throw new Error(`File type "${parsed.mimeType}" isn't on the upload allowlist.`);
  }
  if (parsed.sizeBytes > MAX_AI_UPLOAD_BYTES) {
    throw new Error("File exceeds the 10 MB AI upload cap.");
  }

  // Promote the stage. Throws a reviewer-readable error when the stage
  // is gone (dismissed elsewhere or TTL-swept) — claim rolls back and
  // the proposal stays PENDING with a clear failure message.
  const { storedName } = await finaliseStage(parsed.stagedName);

  let created: { id: string };
  try {
    created = await db.file.create({
      data: {
        name: parsed.filename.slice(0, 200),
        storedPath: storedName,
        folder: parsed.folder ?? null,
        visibility: parsed.visibility,
        mimeType: parsed.mimeType,
        sizeBytes: parsed.sizeBytes,
        uploadedById: user.id,
      },
    });
  } catch (err) {
    // Put the bytes back under the staged name so the rolled-back
    // PENDING proposal still references a live stage (retryable).
    await unfinaliseStage(parsed.stagedName);
    throw err;
  }

  await logAudit({
    userId: user.id,
    action: "upload",
    entity: "File",
    entityId: created.id,
    metadata: {
      name: parsed.filename.slice(0, 200),
      sizeBytes: parsed.sizeBytes,
      folder: parsed.folder ?? null,
      visibility: parsed.visibility,
      proposalId,
    },
  });
  revalidatePath("/files");
  return { id: created.id };
}
