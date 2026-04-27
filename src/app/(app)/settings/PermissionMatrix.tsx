"use client";

import { useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { setPermission, setUserCouple } from "./actions";
import { COUPLE_ONLY_SECTIONS, SECTIONS } from "@/lib/permissions";

const SECTION_LABELS: Record<string, string> = {
  tasks: "Tasks",
  questions: "Questions",
  schedule: "Schedule",
  suppliers: "Suppliers",
  guests: "Guests",
  seating: "Seating",
  songs: "Songs",
  files: "Files",
  book: "Wedding Book",
  budget: "Budget",
  payments: "Payments",
  settings: "Settings",
};

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isCouple: boolean;
};

type Perm = { userId: string; section: string; level: "NONE" | "VIEW" | "EDIT" };

export function PermissionMatrix({
  users,
  permissions,
  currentUserId,
  canEdit,
}: {
  users: User[];
  permissions: Perm[];
  currentUserId: string;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const permMap = new Map<string, "NONE" | "VIEW" | "EDIT">();
  for (const p of permissions) permMap.set(`${p.userId}|${p.section}`, p.level);

  function changeLevel(userId: string, section: string, level: string) {
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("section", section);
    fd.set("level", level);
    startTransition(async () => { await setPermission(fd); });
  }

  function toggleCouple(userId: string, isCouple: boolean) {
    if (!confirm(`${isCouple ? "Grant" : "Revoke"} couple-tier access?`)) return;
    startTransition(async () => { await setUserCouple(userId, isCouple); });
  }

  return (
    <div className="overflow-x-auto bg-surface border border-border-soft rounded-md shadow-sm">
      <table className="text-sm w-full">
        <thead>
          <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
            <th className="px-4 py-2 text-left sticky left-0 bg-canvas z-10">Member</th>
            <th className="px-3 py-2 text-center">Couple</th>
            {SECTIONS.map((s) => (
              <th key={s} className="px-2 py-2 text-center font-bold whitespace-nowrap">{SECTION_LABELS[s]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border-soft last:border-b-0">
              <td className="px-4 py-2.5 sticky left-0 bg-surface z-10 min-w-[180px]">
                <div className="flex items-center gap-2">
                  <Avatar name={u.name ?? u.email} size={24} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink-primary truncate">{u.name ?? u.email}{u.id === currentUserId && <span className="text-[10px] text-ink-tertiary ml-1">(you)</span>}</div>
                    <div className="text-[11px] text-ink-tertiary truncate">{u.role.replace("_", " ").toLowerCase()}</div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={u.isCouple}
                  disabled={!canEdit || pending || u.id === currentUserId}
                  onChange={(e) => toggleCouple(u.id, e.target.checked)}
                />
              </td>
              {SECTIONS.map((s) => {
                const isCoupleOnly = COUPLE_ONLY_SECTIONS.includes(s);
                const effective: "NONE" | "VIEW" | "EDIT" =
                  u.isCouple ? "EDIT" : (isCoupleOnly ? "NONE" : permMap.get(`${u.id}|${s}`) ?? "NONE");
                const editable = canEdit && !u.isCouple && !isCoupleOnly;
                return (
                  <td key={s} className="px-2 py-2.5 text-center">
                    <select
                      value={effective}
                      disabled={!editable || pending}
                      onChange={(e) => changeLevel(u.id, s, e.target.value)}
                      className="text-[11px] bg-canvas border border-border-soft rounded-sm px-1 py-0.5 text-ink-secondary outline-none disabled:opacity-50"
                    >
                      <option value="NONE">None</option>
                      <option value="VIEW">View</option>
                      <option value="EDIT">Edit</option>
                    </select>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
