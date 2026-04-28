"use client";

import { useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { removeUser, setPermission, setUserCouple } from "./actions";
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
  currentUserIsCouple,
  canEdit,
}: {
  users: User[];
  permissions: Perm[];
  currentUserId: string;
  currentUserIsCouple: boolean;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const permMap = new Map<string, "NONE" | "VIEW" | "EDIT">();
  for (const p of permissions) permMap.set(`${p.userId}|${p.section}`, p.level);

  // Belt-and-braces: only the couple can change permissions, grant
  // couple-tier, or remove users. The server actions also gate on
  // user.isCouple (see settings/actions.ts — A2 fix from v1.2.0), so
  // even a forged request fails. This UI flag just stops non-couple
  // users from seeing clickable controls that will only error on submit.
  const couplePrivileged = canEdit && currentUserIsCouple;

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

  function remove(user: User) {
    const label = user.name ?? user.email;
    const consequence = user.isCouple
      ? `\n\nThey have couple-tier access. If they were the only signed-in admin, the next person to sign in will be auto-promoted to replace them.`
      : "";
    if (!confirm(`Remove ${label} from the members list?\n\nThis deletes their account row, sessions, and per-section permissions. They can still sign in again if their email is in AUTH_ALLOWED_EMAILS.${consequence}`)) {
      return;
    }
    startTransition(async () => { await removeUser(user.id); });
  }

  return (
    <>
      {canEdit && !currentUserIsCouple && (
        <div className="mb-3 bg-canvas border border-border-soft text-ink-secondary rounded-md px-4 py-2.5 text-xs flex items-start gap-2">
          <span className="text-marigold-700 flex-shrink-0">🔒</span>
          <span>
            <strong>Read-only.</strong> You have edit access to Settings, but only the couple
            can change other members&apos; permissions, grant couple-tier access, or remove members.
          </span>
        </div>
      )}
    <div className="overflow-x-auto bg-surface border border-border-soft rounded-md shadow-sm">
      <table className="text-sm w-full">
        {/* Sticky thead so column labels stay visible while scrolling
            the page vertically — this list grows as members are added.
            The Member column's left-stickiness was already present;
            combining it with thead-sticky gives both axes a fixed
            anchor. z-20 on thead so it sits above the z-10 Member
            column cells when both stick simultaneously. */}
        <thead className="sticky top-0 z-20">
          <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
            <th className="px-4 py-2 text-left sticky left-0 bg-canvas z-30">Member</th>
            <th className="px-3 py-2 text-center bg-canvas">Couple</th>
            {SECTIONS.map((s) => (
              <th key={s} className="px-2 py-2 text-center font-bold whitespace-nowrap bg-canvas">{SECTION_LABELS[s]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border-soft last:border-b-0">
              <td className="px-4 py-2.5 sticky left-0 bg-surface z-10 min-w-[180px] group">
                <div className="flex items-center gap-2">
                  <Avatar name={u.name ?? u.email} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink-primary truncate">{u.name ?? u.email}{u.id === currentUserId && <span className="text-[10px] text-ink-tertiary ml-1">(you)</span>}</div>
                    <div className="text-[11px] text-ink-tertiary truncate">{u.role.replace("_", " ").toLowerCase()}</div>
                  </div>
                  {couplePrivileged && u.id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => remove(u)}
                      disabled={pending}
                      title={`Remove ${u.name ?? u.email}`}
                      aria-label={`Remove ${u.name ?? u.email}`}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex-shrink-0 w-6 h-6 rounded-sm text-ink-tertiary hover:bg-danger-bg hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      ×
                    </button>
                  )}
                </div>
              </td>
              <td className="px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={u.isCouple}
                  disabled={!couplePrivileged || pending || u.id === currentUserId}
                  onChange={(e) => toggleCouple(u.id, e.target.checked)}
                  title={
                    !currentUserIsCouple
                      ? "Only the couple can change couple-tier membership"
                      : u.id === currentUserId
                        ? "You can't change your own couple flag"
                        : undefined
                  }
                />
              </td>
              {SECTIONS.map((s) => {
                const isCoupleOnly = COUPLE_ONLY_SECTIONS.includes(s);
                const effective: "NONE" | "VIEW" | "EDIT" =
                  u.isCouple ? "EDIT" : (isCoupleOnly ? "NONE" : permMap.get(`${u.id}|${s}`) ?? "NONE");
                const editable = couplePrivileged && !u.isCouple && !isCoupleOnly;
                return (
                  <td key={s} className="px-2 py-2.5 text-center">
                    <select
                      value={effective}
                      disabled={!editable || pending}
                      onChange={(e) => changeLevel(u.id, s, e.target.value)}
                      title={
                        !currentUserIsCouple
                          ? "Only the couple can change permissions"
                          : u.isCouple
                            ? "Couple-tier members have edit access on every section"
                            : isCoupleOnly
                              ? "Couple-only section — non-couple members can't be granted access"
                              : undefined
                      }
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
    </>
  );
}
