"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PermissionLevel } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

const setPermSchema = z.object({
  userId: z.string().min(1),
  section: z.string().min(1),
  level: z.nativeEnum(PermissionLevel),
});

export async function setPermission(formData: FormData) {
  const user = await requireEdit("settings");
  const parsed = setPermSchema.parse({
    userId: formData.get("userId"),
    section: formData.get("section"),
    level: formData.get("level"),
  });
  await db.permission.upsert({
    where: { userId_section: { userId: parsed.userId, section: parsed.section } },
    create: { userId: parsed.userId, section: parsed.section, level: parsed.level },
    update: { level: parsed.level },
  });
  await audit(user, {
    action: "permission",
    entity: "User",
    entityId: parsed.userId,
    metadata: { section: parsed.section, level: parsed.level },
  });
  revalidatePath("/settings");
}

export async function setUserCouple(userId: string, isCouple: boolean) {
  const user = await requireEdit("settings");
  await db.user.update({ where: { id: userId }, data: { isCouple } });
  await audit(user, { action: "set-couple", entity: "User", entityId: userId, metadata: { isCouple } });
  revalidatePath("/settings");
}
