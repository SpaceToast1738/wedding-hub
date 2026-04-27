import { cache } from "react";
import { db } from "@/lib/db";
import { PermissionLevel } from "@prisma/client";

export const SECTIONS = [
  "tasks", "questions", "schedule", "suppliers",
  "guests", "seating", "songs", "files", "book",
  "budget", "payments", "settings",
] as const;

export type Section = (typeof SECTIONS)[number];

export const COUPLE_ONLY_SECTIONS: Section[] = ["budget", "payments"];

const loadPermissions = cache(async (userId: string) => {
  const rows = await db.permission.findMany({ where: { userId } });
  const map = new Map<string, PermissionLevel>();
  for (const r of rows) map.set(r.section, r.level);
  return map;
});

type SessionUser = { id: string; isCouple: boolean };

export async function canView(user: SessionUser, section: Section): Promise<boolean> {
  if (user.isCouple) return true;
  if (COUPLE_ONLY_SECTIONS.includes(section)) return false;
  const perms = await loadPermissions(user.id);
  const level = perms.get(section) ?? PermissionLevel.NONE;
  return level === PermissionLevel.VIEW || level === PermissionLevel.EDIT;
}

export async function canEdit(user: SessionUser, section: Section): Promise<boolean> {
  if (user.isCouple) return true;
  if (COUPLE_ONLY_SECTIONS.includes(section)) return false;
  const perms = await loadPermissions(user.id);
  return perms.get(section) === PermissionLevel.EDIT;
}
