// v2.9.0: staged uploads for the proposal-gated file.upload kind.
//
// The propose_file_upload tool must NOT embed file bytes in the
// AiProposal row (payloads are JSON snapshots reviewed on /ai, and a
// 10 MB base64 blob would bloat every read_proposals / review query).
// Instead the decoded bytes are staged on disk under UPLOADS_DIR with
// a `pending-` prefix, and the proposal payload carries only the
// staged name:
//
//   propose  → stageUpload() writes  pending-<32hex>.<ext>
//   Apply    → finaliseStage() renames to <32hex>.<ext> and the File
//              row is created pointing at the final name
//   Dismiss  → discardStage() unlinks the staged file
//   Abandon  → sweepStaleStages() (run on every new stage) unlinks
//              staged files older than STAGE_TTL_MS
//
// Staged files never appear anywhere in the app: the Files page and
// the download route only ever read File rows, and no row exists
// until Apply. The `pending-` prefix keeps them visually distinct in
// the volume for manual ops too.

import { randomBytes } from "node:crypto";
import { readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR, ensureUploadsDir, extensionFor } from "@/lib/uploads";

export const STAGED_PREFIX = "pending-";

/** 7 days — a proposal older than this has clearly been abandoned
 *  (the review queue is looked at far more often than weekly). */
export const STAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** AI uploads cap at 10 MB — deliberately below the app's 25 MB human
 *  cap (src/lib/uploads.ts MAX_UPLOAD_BYTES): agent-supplied files are
 *  reviewed sight-unseen from a summary line, so keep the blast radius
 *  (disk + review burden) smaller than the human path's. */
export const MAX_AI_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Exactly the names stageUpload() mints: prefix + 32 hex chars +
 *  a short alphanumeric extension. Anything else is rejected before
 *  it reaches the filesystem — no separators, no traversal. */
export const STAGED_NAME_RE = /^pending-[0-9a-f]{32}\.[a-z0-9]{1,8}$/;

export function isStagedName(name: string): boolean {
  return STAGED_NAME_RE.test(name);
}

/** Strict base64 decode. Returns null (never throws) when the string
 *  isn't valid base64 — Buffer.from silently skips invalid chars, so
 *  validate the charset/padding shape first. Whitespace (line-wrapped
 *  base64 from well-behaved encoders) is tolerated and stripped. */
export function decodeBase64Content(b64: string): Buffer | null {
  const compact = b64.replace(/\s+/g, "");
  if (compact.length === 0 || compact.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return null;
  return Buffer.from(compact, "base64");
}

/** Write bytes to a fresh staged file. Sweeps abandoned stages first
 *  (best-effort — a sweep failure must never block a new stage). */
export async function stageUpload(
  bytes: Buffer,
  mime: string,
  originalName: string,
): Promise<{ stagedName: string }> {
  await ensureUploadsDir();
  await sweepStaleStages().catch(() => undefined);
  const ext = extensionFor(mime, originalName);
  const stagedName = `${STAGED_PREFIX}${randomBytes(16).toString("hex")}.${ext}`;
  // Same mode as the human upload path (files/actions.ts).
  await writeFile(path.join(UPLOADS_DIR, stagedName), bytes, { mode: 0o640 });
  return { stagedName };
}

/** Unlink staged files older than the TTL. Returns how many were
 *  removed. Every error is swallowed per-file — a locked or already-
 *  gone file must not stop the rest of the sweep. */
export async function sweepStaleStages(now = Date.now()): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(UPLOADS_DIR);
  } catch {
    return 0; // Uploads dir missing — nothing staged, nothing to do.
  }
  let removed = 0;
  for (const name of entries) {
    if (!isStagedName(name)) continue;
    const full = path.join(UPLOADS_DIR, name);
    try {
      const s = await stat(full);
      if (now - s.mtimeMs > STAGE_TTL_MS) {
        await unlink(full);
        removed++;
      }
    } catch {
      // Raced away or unreadable — skip.
    }
  }
  return removed;
}

/** Promote a staged file to its final stored name (the staged name
 *  minus the prefix — same shape generateStoredName mints for human
 *  uploads). Throws a reviewer-readable error when the stage is gone
 *  (dismissed elsewhere, or TTL-swept). */
export async function finaliseStage(stagedName: string): Promise<{ storedName: string }> {
  if (!isStagedName(stagedName)) {
    throw new Error("Invalid staged file reference.");
  }
  const storedName = stagedName.slice(STAGED_PREFIX.length);
  try {
    await rename(path.join(UPLOADS_DIR, stagedName), path.join(UPLOADS_DIR, storedName));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "Staged file not found — it may have been cleaned up (stages expire after 7 days). Re-propose the upload.",
      );
    }
    throw err;
  }
  return { storedName };
}

/** Undo finaliseStage after a failed DB write so the proposal (rolled
 *  back to PENDING by the caller) still points at a live stage.
 *  Best-effort: never throws. */
export async function unfinaliseStage(stagedName: string): Promise<void> {
  if (!isStagedName(stagedName)) return;
  const storedName = stagedName.slice(STAGED_PREFIX.length);
  await rename(
    path.join(UPLOADS_DIR, storedName),
    path.join(UPLOADS_DIR, stagedName),
  ).catch(() => undefined);
}

/** Remove a staged file (Dismiss / supersede path). Best-effort:
 *  a missing file (already swept) is success, and cleanup must never
 *  fail the dismissal that triggered it. */
export async function discardStage(stagedName: string): Promise<void> {
  if (!isStagedName(stagedName)) return;
  await unlink(path.join(UPLOADS_DIR, stagedName)).catch(() => undefined);
}

/** Pull a validated staged name out of an unknown payload — the
 *  dismiss/supersede paths read it defensively (a tampered row must
 *  not steer a filesystem call). */
export function stagedNameFromPayload(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const v = (payload as Record<string, unknown>).stagedName;
  return typeof v === "string" && isStagedName(v) ? v : null;
}
