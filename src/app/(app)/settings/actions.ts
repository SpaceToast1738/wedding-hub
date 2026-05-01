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

// v1.44.0: delete a per-user override for one (user, section). The
// resolver treats absent rows as "inherit from groups" — so clearing
// the override means the user resolves to whatever their group
// permissions say. Couple-only, audited.
const clearPermSchema = z.object({
  userId: z.string().min(1),
  section: z.string().min(1),
});

export async function clearPermission(formData: FormData) {
  const user = await requireEdit("settings");
  if (!user.isCouple) {
    await audit(user, {
      action: "settings_denied",
      entity: "User",
      entityId: String(formData.get("userId") ?? ""),
      metadata: { reason: "not_couple", target_action: "clearPermission" },
    });
    throw new Error("Forbidden: only the couple can change permissions");
  }
  const parsed = clearPermSchema.parse({
    userId: formData.get("userId"),
    section: formData.get("section"),
  });
  // Capture the prior level for the audit row before deletion. Find-
  // before-delete instead of returning the deleted row so the audit
  // log records "what was the override before we cleared it".
  const before = await db.permission.findUnique({
    where: { userId_section: { userId: parsed.userId, section: parsed.section } },
  });
  if (!before) return; // already cleared; idempotent.
  await db.permission.delete({
    where: { userId_section: { userId: parsed.userId, section: parsed.section } },
  });
  await audit(user, {
    action: "permission-clear",
    entity: "User",
    entityId: parsed.userId,
    metadata: { section: parsed.section, priorLevel: before.level },
  });
  revalidatePath("/settings");
}

// v1.45.0: bulk-clear every per-user override for one user. The new
// MemberOverridesBlock surfaces a "Clear all overrides" button per
// user — for the case where a couple wants to reset someone back to
// pure group-inheritance without ticking through 12 sections.
// Couple-only, audited with the cleared-section count + the prior
// levels for forensic recoverability.
export async function clearAllUserOverrides(userId: string): Promise<{ ok: true; cleared: number } | { ok: false; error: string }> {
  const user = await requireEdit("settings");
  if (!user.isCouple) {
    await audit(user, {
      action: "settings_denied",
      entity: "User",
      entityId: userId,
      metadata: { reason: "not_couple", target_action: "clearAllUserOverrides" },
    });
    return { ok: false, error: "Forbidden: only the couple can change permissions" };
  }
  const before = await db.permission.findMany({ where: { userId } });
  if (before.length === 0) return { ok: true, cleared: 0 };
  await db.permission.deleteMany({ where: { userId } });
  await audit(user, {
    action: "permission-clear-all",
    entity: "User",
    entityId: userId,
    metadata: {
      cleared: before.length,
      sections: before.map((p) => `${p.section}=${p.level}`).join(", "),
    },
  });
  revalidatePath("/settings");
  return { ok: true, cleared: before.length };
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
