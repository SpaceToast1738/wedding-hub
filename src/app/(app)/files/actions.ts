"use server";

import { revalidatePath } from "next/cache";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { FileVisibility } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
import {
  UPLOADS_DIR,
  ensureUploadsDir,
  generateStoredName,
  resolveStoredPath,
  validateUpload,
} from "@/lib/uploads";

function parseVisibility(raw: FormDataEntryValue | null | undefined): FileVisibility {
  return raw === FileVisibility.COUPLE_ONLY ? FileVisibility.COUPLE_ONLY : FileVisibility.EVERYONE;
}

// Accepts either a single `file` (legacy) or a list of `files[]` from the
// multi-select input. Each accepted file goes through the same validate →
// write → DB-insert path. Errors short-circuit and all preceding writes for
// THIS call are kept (per-file granularity); the caller sees the first
// error and can retry.
export async function uploadFile(formData: FormData) {
  const user = await requireEdit("files");
  const folder = String(formData.get("folder") ?? "").trim() || null;
  const visibility = parseVisibility(formData.get("visibility"));

  const single = formData.get("file");
  const many = formData.getAll("files");
  const incoming: File[] = [];
  if (single instanceof File && single.size > 0) incoming.push(single);
  for (const item of many) {
    if (item instanceof File && item.size > 0) incoming.push(item);
  }
  if (incoming.length === 0) throw new Error("No file received.");

  await ensureUploadsDir();

  for (const f of incoming) {
    const validation = validateUpload(f);
    if (!validation.ok) throw new Error(`${f.name}: ${validation.error}`);

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
          visibility,
          mimeType: validation.mime,
          sizeBytes: f.size,
          uploadedById: user.id,
        },
      });
    } catch (err) {
      await unlink(fullPath).catch(() => undefined);
      throw err;
    }

    await audit(user, {
      action: "upload",
      entity: "File",
      entityId: created.id,
      metadata: { name: created.name, sizeBytes: created.sizeBytes, folder, visibility },
    });
  }

  revalidatePath("/files");
}

export async function updateFile(
  id: string,
  patch: { name?: string; folder?: string | null; visibility?: FileVisibility },
) {
  const user = await requireEdit("files");

  const data: { name?: string; folder?: string | null; visibility?: FileVisibility } = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error("Name can't be empty.");
    data.name = trimmed.slice(0, 200);
  }
  if (patch.folder !== undefined) {
    const trimmed = patch.folder?.trim() ?? "";
    data.folder = trimmed.length === 0 ? null : trimmed.slice(0, 100);
  }
  if (patch.visibility !== undefined) {
    // Visibility transitions touching COUPLE_ONLY are couple-only.
    // Without this gate a non-couple user with EDIT(files) could either
    // (a) flip a couple-only file to EVERYONE and read couple-only
    //     content via a normal download, or
    // (b) flip a public file to COUPLE_ONLY (low impact today since
    //     isCouple sees everything, but principled defence).
    const current = await db.file.findUnique({
      where: { id },
      select: { visibility: true },
    });
    if (!current) throw new Error("File not found");
    const isCoupleTouched =
      current.visibility === "COUPLE_ONLY" ||
      patch.visibility === "COUPLE_ONLY";
    if (isCoupleTouched && !user.isCouple) {
      await audit(user, {
        action: "files_denied",
        entity: "File",
        entityId: id,
        metadata: {
          reason: "not_couple",
          target_action: "updateFile.visibility",
          from: current.visibility,
          to: patch.visibility,
        },
      });
      throw new Error("Forbidden: only the couple can change couple-only file visibility");
    }
    data.visibility = patch.visibility;
  }
  if (Object.keys(data).length === 0) return;

  await db.file.update({ where: { id }, data });
  await audit(user, { action: "update", entity: "File", entityId: id, metadata: data });
  revalidatePath("/files");
}

export async function deleteFile(id: string) {
  const user = await requireEdit("files");

  const file = await db.file.findUnique({ where: { id } });
  if (!file) return;

  await db.file.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "File",
    entityId: id,
    metadata: {
      name: file.name,
      sizeBytes: file.sizeBytes,
      folder: file.folder,
      visibility: file.visibility,
    },
  });

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
