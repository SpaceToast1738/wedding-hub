"use server";

import { revalidatePath } from "next/cache";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
import {
  UPLOADS_DIR,
  ensureUploadsDir,
  generateStoredName,
  resolveStoredPath,
  validateUpload,
} from "@/lib/uploads";

export async function uploadFile(formData: FormData) {
  const user = await requireEdit("files");

  const file = formData.get("file") as File | null;
  const folder = String(formData.get("folder") ?? "").trim() || null;

  const validation = validateUpload(file);
  if (!validation.ok) throw new Error(validation.error);
  // Re-fetch with narrowed type
  const f = file as File;

  await ensureUploadsDir();
  const storedName = generateStoredName(validation.mime, f.name);
  const fullPath = path.join(UPLOADS_DIR, storedName);

  const bytes = Buffer.from(await f.arrayBuffer());
  await writeFile(fullPath, bytes, { mode: 0o640 });

  let created;
  try {
    created = await db.file.create({
      data: {
        name: f.name.slice(0, 200),
        storedPath: storedName,
        folder,
        mimeType: validation.mime,
        sizeBytes: f.size,
        uploadedById: user.id,
      },
    });
  } catch (err) {
    // Roll back the on-disk write if the DB insert failed.
    await unlink(fullPath).catch(() => undefined);
    throw err;
  }

  await audit(user, {
    action: "upload",
    entity: "File",
    entityId: created.id,
    metadata: { name: created.name, sizeBytes: created.sizeBytes, folder },
  });
  revalidatePath("/files");
}

export async function deleteFile(id: string) {
  const user = await requireEdit("files");

  const file = await db.file.findUnique({ where: { id } });
  if (!file) return;

  // Drop the DB row first so we don't end up with a broken ref if the
  // filesystem unlink fails. Unlink errors after that are best-effort —
  // log only, since the user-visible row is gone.
  await db.file.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "File", entityId: id });

  try {
    const fullPath = resolveStoredPath(file.storedPath);
    await unlink(fullPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`failed to remove ${file.storedPath}:`, err);
    }
  }

  revalidatePath("/files");
}
