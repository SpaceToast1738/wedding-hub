"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

const fileSchema = z.object({
  name: z.string().min(1).max(200),
  storedPath: z.string().min(1).max(500),
  folder: z.string().max(100).optional().nullable(),
  mimeType: z.string().max(100).default("application/octet-stream"),
  sizeBytes: z.string().optional().nullable(),
});

export async function registerFile(formData: FormData) {
  const user = await requireEdit("files");
  const parsed = fileSchema.parse({
    name: formData.get("name"),
    storedPath: formData.get("storedPath"),
    folder: formData.get("folder") || null,
    mimeType: formData.get("mimeType") || "application/octet-stream",
    sizeBytes: formData.get("sizeBytes") || null,
  });
  const sizeNum = parsed.sizeBytes ? Number(parsed.sizeBytes) : 0;
  const created = await db.file.create({
    data: {
      name: parsed.name,
      storedPath: parsed.storedPath,
      folder: parsed.folder ?? null,
      mimeType: parsed.mimeType,
      sizeBytes: isNaN(sizeNum) ? 0 : sizeNum,
      uploadedById: user.id,
    },
  });
  await audit(user, { action: "register", entity: "File", entityId: created.id });
  revalidatePath("/files");
}

export async function deleteFile(id: string) {
  const user = await requireEdit("files");
  await db.file.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "File", entityId: id });
  revalidatePath("/files");
}
