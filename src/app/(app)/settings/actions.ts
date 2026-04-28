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
  // Granting / revoking permissions is couple-only regardless of any other
  // EDIT-on-settings access. Without this, a non-couple user with
  // EDIT(settings) could grant arbitrary permissions to any user.
  if (!user.isCouple) {
    await audit(user, {
      action: "settings_denied",
      entity: "User",
      entityId: String(formData.get("userId") ?? ""),
      metadata: { reason: "not_couple", target_action: "setPermission" },
    });
    throw new Error("Forbidden: only the couple can change permissions");
  }
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
  // The self-elevation vector. Without this isCouple gate, a non-couple
  // user with EDIT(settings) could call setUserCouple(myOwnId, true)
  // and promote themselves to couple-tier. Audit-log denied attempts so
  // a future operator can spot intrusion attempts.
  if (!user.isCouple) {
    await audit(user, {
      action: "settings_denied",
      entity: "User",
      entityId: userId,
      metadata: { reason: "not_couple", target_action: "setUserCouple", target_isCouple: isCouple },
    });
    throw new Error("Forbidden: only the couple can change couple-tier membership");
  }
  await db.user.update({ where: { id: userId }, data: { isCouple } });
  await audit(user, { action: "set-couple", entity: "User", entityId: userId, metadata: { isCouple } });
  revalidatePath("/settings");
}

export async function removeUser(userId: string) {
  const user = await requireEdit("settings");
  // Removing a user is couple-only. Without this gate a non-couple user
  // with EDIT(settings) could remove the couple and lock everyone out.
  if (!user.isCouple) {
    await audit(user, {
      action: "settings_denied",
      entity: "User",
      entityId: userId,
      metadata: { reason: "not_couple", target_action: "removeUser" },
    });
    throw new Error("Forbidden: only the couple can remove users");
  }
  if (userId === user.id) {
    throw new Error("You can't remove yourself.");
  }

  // Capture identity for the audit log before the row vanishes.
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, isCouple: true, role: true },
  });
  if (!target) return;

  // Permission rows have no FK to User in the schema, so we have to clean
  // them up explicitly. Account + Session cascade via the FKs in
  // schema.prisma; AuditLog rows keep their history with userId set to NULL
  // (optional relation, default-on-delete is SetNull).
  await db.$transaction([
    db.permission.deleteMany({ where: { userId } }),
    db.user.delete({ where: { id: userId } }),
  ]);

  await audit(user, {
    action: "remove",
    entity: "User",
    entityId: target.id,
    metadata: { email: target.email, name: target.name, isCouple: target.isCouple, role: target.role },
  });
  revalidatePath("/settings");
}
