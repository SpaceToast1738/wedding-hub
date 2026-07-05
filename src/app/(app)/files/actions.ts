"use server";

import { revalidatePath } from "next/cache";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { FileVisibility } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit, requireUser } from "@/lib/actions";
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

// v2.5.0 (design pass #6): validate the WHOLE batch up front, before
// any bytes are written or any DB row is created. Previously a batch
// stopped at the first invalid file but kept whatever had already
// been written before it — a user who fixed the bad file and re-
// dropped the same batch had no idea which files had already landed,
// risking duplicate re-uploads. Now a batch either fully succeeds or
// fails as a single unit with one clear "which file, why" message,
// and nothing partial is left behind on disk or in the DB.
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

  // Validate every file before touching disk. Bail on the first bad
  // one — the caller gets a single clear error and nothing has been
  // written yet, so retrying the fixed batch can't duplicate anything.
  const validated: { file: File; mime: string }[] = [];
  for (const f of incoming) {
    const validation = validateUpload(f);
    if (!validation.ok) throw new Error(`${f.name}: ${validation.error}`);
    validated.push({ file: f, mime: validation.mime });
  }

  await ensureUploadsDir();

  // v2.5.1 (review fix): the disk-write loop and the DB-insert loop
  // are now separate phases so they can each be rolled back as a
  // unit. The earlier version wrote bytes AND created the DB row
  // per-file inside one loop — if file 3 of 5's db.file.create threw,
  // the catch unlinked ALL written paths including files 1-2, whose
  // File rows had ALREADY COMMITTED (Prisma has no cross-call
  // transaction here), leaving live DB rows pointing at deleted
  // bytes. Phase 1 only touches disk; Phase 2 creates every row in
  // ONE db.$transaction, so either all of them commit or none do —
  // matching "nothing partial is left behind on disk or in the DB"
  // for real this time.
  const writtenPaths: string[] = [];
  const pending: { fullPath: string; storedName: string; f: File; mime: string }[] = [];
  try {
    for (const { file: f, mime } of validated) {
      const storedName = generateStoredName(mime, f.name);
      const fullPath = path.join(UPLOADS_DIR, storedName);
      const bytes = Buffer.from(await f.arrayBuffer());
      await writeFile(fullPath, bytes, { mode: 0o640 });
      writtenPaths.push(fullPath);
      pending.push({ fullPath, storedName, f, mime });
    }

    const created = await db.$transaction(
      pending.map(({ storedName, f, mime }) =>
        db.file.create({
          data: {
            name: f.name.slice(0, 200),
            storedPath: storedName,
            folder,
            visibility,
            mimeType: mime,
            sizeBytes: f.size,
            uploadedById: user.id,
          },
        }),
      ),
    );

    // audit() swallows its own errors (never throws), so looping
    // these after the transaction can't reintroduce the same hazard.
    for (const row of created) {
      await audit(user, {
        action: "upload",
        entity: "File",
        entityId: row.id,
        metadata: { name: row.name, sizeBytes: row.sizeBytes, folder, visibility },
      });
    }
  } catch (err) {
    // Either the disk-write phase failed partway, or the DB
    // transaction rolled back entirely — either way, zero File rows
    // for this batch exist, so every written path is now an orphan.
    await Promise.all(writtenPaths.map((p) => unlink(p).catch(() => undefined)));
    throw err;
  }

  revalidatePath("/files");
}

// v2.5.0 (design pass #9): Files rows never showed who uploaded what,
// even though every row records `uploadedById` — there's no Prisma
// relation from File to User (a plain scalar column, no FK), so
// FilesClient fetches the names itself once mounted rather than
// adding a schema relation + migration for a display-only label.
// Read-only; any signed-in user can resolve names for files they can
// already see the raw uploadedById on.
export async function listUploaderNames(
  ids: string[],
): Promise<Record<string, { name: string | null; firstName: string | null }>> {
  await requireUser();
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (uniqueIds.length === 0) return {};
  const users = await db.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, firstName: true },
  });
  const out: Record<string, { name: string | null; firstName: string | null }> = {};
  for (const u of users) out[u.id] = { name: u.name, firstName: u.firstName };
  return out;
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
