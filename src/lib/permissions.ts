import { cache } from "react";
import { db } from "@/lib/db";
import { PermissionLevel } from "@prisma/client";
import {
  BUILTIN_GROUPS,
  resolveBuiltinGroup,
  type UserShape,
} from "@/lib/group-members";

export const SECTIONS = [
  "tasks", "questions", "schedule", "suppliers",
  "guests", "seating", "songs", "files", "book",
  "budget", "payments", "settings",
] as const;

export type Section = (typeof SECTIONS)[number];

export const COUPLE_ONLY_SECTIONS: Section[] = ["budget", "payments"];

// ─── Pure-decision helpers (unit-testable) ───────────────────────────
//
// v1.43.0: permissions resolve in three layers, in increasing
// authority:
//   1. Group permissions  — `GroupPermission(groupKey, section, level)`
//      rows for every built-in / custom group the user belongs to.
//      Reduce by max-level across all groups.
//   2. Per-user overrides — legacy `Permission(userId, section, level)`
//      rows. Take the max(group, override) per section.
//   3. Couple bypass      — `user.isCouple === true` short-circuits
//      everything to EDIT.
// Couple-only sections (budget / payments) deny everyone except the
// couple regardless of the resolver output.

const LEVEL_RANK: Record<PermissionLevel, number> = {
  NONE: 0,
  VIEW: 1,
  EDIT: 2,
};

/** Return the "stronger" of two PermissionLevels. */
export function maxLevel(a: PermissionLevel, b: PermissionLevel): PermissionLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

/**
 * For a user, list the groupKeys ("builtin:<slug>" / "group:<slug>")
 * they belong to. Pure — takes the canonical user/group shapes from
 * the DB and walks the rules.
 */
export function groupKeysForUser(
  user: UserShape,
  customGroups: { slug: string; members: { id: string }[] }[],
): string[] {
  const keys: string[] = [];
  for (const g of BUILTIN_GROUPS) {
    if (resolveBuiltinGroup(g.slug, [user]).length > 0) {
      keys.push(`builtin:${g.slug}`);
    }
  }
  for (const cg of customGroups) {
    if (cg.members.some((m) => m.id === user.id)) {
      keys.push(`group:${cg.slug}`);
    }
  }
  return keys;
}

/**
 * Reduce a list of (groupKey, section, level) rows down to a per-section
 * max level for the supplied groupKeys. Pure.
 */
export function reduceGroupPermissions(
  groupKeys: string[],
  rows: { groupKey: string; section: string; level: PermissionLevel }[],
): Map<string, PermissionLevel> {
  const keep = new Set(groupKeys);
  const out = new Map<string, PermissionLevel>();
  for (const r of rows) {
    if (!keep.has(r.groupKey)) continue;
    const prev = out.get(r.section);
    out.set(r.section, prev ? maxLevel(prev, r.level) : r.level);
  }
  return out;
}

/**
 * Combine a group-derived permission map with per-user override rows.
 * Override wins only when its level is strictly stronger; same level
 * is a no-op. Pure.
 */
export function mergeOverrides(
  groupMap: Map<string, PermissionLevel>,
  overrides: { section: string; level: PermissionLevel }[],
): Map<string, PermissionLevel> {
  const out = new Map(groupMap);
  for (const o of overrides) {
    const prev = out.get(o.section);
    out.set(o.section, prev ? maxLevel(prev, o.level) : o.level);
  }
  return out;
}

// ─── DB-backed loaders (request-cached) ──────────────────────────────

const loadEffectivePermissions = cache(async (userId: string) => {
  // Hydrate the user (need role + isCouple + id) and all custom
  // groups (need slug + member-ids) so groupKeysForUser can run.
  const [user, customGroups] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isCouple: true, email: true, firstName: true, lastName: true, name: true },
    }),
    db.permissionGroup.findMany({
      select: { slug: true, members: { select: { id: true } } },
    }),
  ]);
  if (!user) return new Map<string, PermissionLevel>();

  const userShape: UserShape = {
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    isCouple: user.isCouple,
  };
  const keys = groupKeysForUser(userShape, customGroups);

  // One IN-list query for all the group permissions that apply.
  const [groupRows, overrides] = await Promise.all([
    keys.length > 0
      ? db.groupPermission.findMany({
          where: { groupKey: { in: keys } },
          select: { groupKey: true, section: true, level: true },
        })
      : Promise.resolve([]),
    db.permission.findMany({
      where: { userId },
      select: { section: true, level: true },
    }),
  ]);

  const groupMap = reduceGroupPermissions(keys, groupRows);
  return mergeOverrides(groupMap, overrides);
});

type SessionUser = { id: string; isCouple: boolean };

export async function canView(user: SessionUser, section: Section): Promise<boolean> {
  if (user.isCouple) return true;
  if (COUPLE_ONLY_SECTIONS.includes(section)) return false;
  const perms = await loadEffectivePermissions(user.id);
  const level = perms.get(section) ?? PermissionLevel.NONE;
  return level === PermissionLevel.VIEW || level === PermissionLevel.EDIT;
}

export async function canEdit(user: SessionUser, section: Section): Promise<boolean> {
  if (user.isCouple) return true;
  if (COUPLE_ONLY_SECTIONS.includes(section)) return false;
  const perms = await loadEffectivePermissions(user.id);
  return perms.get(section) === PermissionLevel.EDIT;
}
