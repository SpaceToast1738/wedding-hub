"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PermissionLevel, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
import { SECTIONS } from "@/lib/permissions";

// v1.54.0 (A7): validate `section` against the canonical SECTIONS
// enum rather than accepting any non-empty string. Pre-fix a couple-
// tier user (or a forged form by anyone with EDIT(settings)) could
// write `Permission(userId, "made-up-section", EDIT)` rows that
// pollute the table without ever resolving. setGroupPermission has
// always done this; per-user setPermission/clearPermission were
// inconsistent.
const setPermSchema = z.object({
  userId: z.string().min(1),
  section: z.enum(SECTIONS),
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
  // v1.54.0 (B3): capture priorLevel for the audit diff.
  const before = await db.permission.findUnique({
    where: { userId_section: { userId: parsed.userId, section: parsed.section } },
    select: { level: true },
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
    metadata: {
      section: parsed.section,
      level: parsed.level,
      priorLevel: before?.level ?? null,
    },
  });
  revalidatePath("/settings");
}

// v1.44.0: delete a per-user override for one (user, section). The
// resolver treats absent rows as "inherit from groups" — so clearing
// the override means the user resolves to whatever their group
// permissions say. Couple-only, audited.
const clearPermSchema = z.object({
  userId: z.string().min(1),
  section: z.enum(SECTIONS),
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
  // v1.54.0 (A8): atomic find-then-delete. Pre-fix a concurrent
  // setPermission landing between the read and the delete would
  // cause the audit row to under-report the cleared set. With ~5–10
  // admin users this is unlikely but the race exists and the fix
  // is one transaction.
  const before = await db.$transaction(async (tx) => {
    const rows = await tx.permission.findMany({ where: { userId } });
    if (rows.length > 0) {
      await tx.permission.deleteMany({ where: { userId } });
    }
    return rows;
  });
  if (before.length === 0) return { ok: true, cleared: 0 };
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

// v1.45.2: change a user's role (WEDDING_PARTY / PLANNER / VIEWER).
// Directly governs which built-in groups they appear in
// ("Wedding party (by role)" needs role = WEDDING_PARTY; "Planners
// (by role)" needs role = PLANNER). Couple-only.
//
// Excludes UserRole.COUPLE — that's set via the `isCouple` flag
// using `setUserCouple`, and the two are kept in sync at bootstrap
// (`src/auth.ts:91`). Forcing role = COUPLE here without flipping
// isCouple would create a confusing split state.
const setRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["WEDDING_PARTY", "PLANNER", "VIEWER"]),
});

export async function setUserRole(userId: string, role: "WEDDING_PARTY" | "PLANNER" | "VIEWER") {
  const user = await requireEdit("settings");
  if (!user.isCouple) {
    await audit(user, {
      action: "settings_denied",
      entity: "User",
      entityId: userId,
      metadata: { reason: "not_couple", target_action: "setUserRole", target_role: role },
    });
    throw new Error("Forbidden: only the couple can change user roles");
  }
  const parsed = setRoleSchema.parse({ userId, role });
  const before = await db.user.findUnique({
    where: { id: parsed.userId },
    select: { id: true, role: true, isCouple: true, name: true, email: true },
  });
  if (!before) throw new Error("User not found");
  // Last-couple lock: if the target is currently couple-tier and
  // we're moving them to a non-couple role, block when they're the
  // only remaining couple. Same protection as setUserCouple. Note:
  // we do NOT auto-clear isCouple here — that's an explicit action
  // via setUserCouple.
  if (before.isCouple) {
    const coupleCount = await db.user.count({ where: { isCouple: true } });
    if (coupleCount <= 1) {
      await audit(user, {
        action: "settings_denied",
        entity: "User",
        entityId: parsed.userId,
        metadata: {
          reason: "last_couple_locked",
          target_action: "setUserRole",
          target_role: parsed.role,
        },
      });
      throw new Error(
        "Can't change role of the only remaining couple-tier admin. Promote another user first.",
      );
    }
  }
  await db.user.update({
    where: { id: parsed.userId },
    data: { role: parsed.role as UserRole },
  });
  await audit(user, {
    action: "set-role",
    entity: "User",
    entityId: parsed.userId,
    metadata: {
      role: parsed.role,
      priorRole: before.role,
      name: before.name,
      email: before.email,
    },
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
  // v1.45.1: lock the last couple-tier user. Without this guard, two
  // couple admins could revoke each other's couple flag in quick
  // succession and leave the running session with zero admins until
  // the next sign-in's bootstrap auto-promote kicks in (which doesn't
  // help anyone who's already signed in). The lock is server-side so
  // a forged client request still fails — UI disabling alone isn't
  // enough.
  if (!isCouple) {
    const coupleCount = await db.user.count({ where: { isCouple: true } });
    if (coupleCount <= 1) {
      await audit(user, {
        action: "settings_denied",
        entity: "User",
        entityId: userId,
        metadata: {
          reason: "last_couple_locked",
          target_action: "setUserCouple",
          target_isCouple: isCouple,
        },
      });
      throw new Error(
        "Can't revoke couple-tier from the only remaining admin. Promote another user first.",
      );
    }
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

  // v1.45.1: same lock as setUserCouple — never let the running
  // session lose its last admin via removeUser. (Bootstrap auto-
  // promote on next sign-in is a fallback, not a substitute for
  // never letting it happen mid-session.)
  if (target.isCouple) {
    const coupleCount = await db.user.count({ where: { isCouple: true } });
    if (coupleCount <= 1) {
      await audit(user, {
        action: "settings_denied",
        entity: "User",
        entityId: userId,
        metadata: {
          reason: "last_couple_locked",
          target_action: "removeUser",
        },
      });
      throw new Error(
        "Can't remove the only remaining couple-tier admin. Promote another user first.",
      );
    }
  }

  // Permission rows have no FK to User in the schema, so we have to clean
  // them up explicitly. Cascading on User delete handled by Prisma:
  //   • Account, Session                  → cascade (the FKs in schema.prisma).
  //   • _PermissionGroupMembers           → cascade (implicit m2m row,
  //                                          v1.40.0 — User leaves every
  //                                          group automatically).
  //   • AuditLog                          → SetNull (keep the history
  //                                          but disambiguate the actor).
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
