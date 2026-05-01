"use client";

import { useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { clearPermission, removeUser, setPermission, setUserCouple } from "./actions";
import { COUPLE_ONLY_SECTIONS, SECTIONS } from "@/lib/permissions";

// v1.44.0: matrix is checkbox-driven now. Default state for any
// (user × section) cell is "inherit from group" — the cell renders
// the resolved group level in muted type. Ticking the checkbox
// **enables an override** with a level select (VIEW / EDIT only —
// NONE is meaningless because the resolver takes max(group, override),
// so an override of NONE never lowers the inherited level). Unticking
// deletes the per-user Permission row via clearPermission().
//
// Couple-tier users always render an unchecked, disabled cell with
// "EDIT" displayed — they have implicit edit access via the bypass.
// Couple-only sections (budget / payments) render disabled with the
// inherited level shown — non-couple members can't have those sections
// regardless of group permissions.

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

type Level = "NONE" | "VIEW" | "EDIT";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isCouple: boolean;
};

type Perm = { userId: string; section: string; level: Level };

// `groupInherited[userId][section]` = the level the user gets from
// their groups for that section (NONE if none of their groups grant
// access). Computed on the server so the matrix can render the
// "inherits from group" baseline without re-running the resolver.
type Inherited = Record<string, Record<string, Level>>;

export function PermissionMatrix({
  users,
  permissions,
  groupInherited,
  currentUserId,
  currentUserIsCouple,
  canEdit,
}: {
  users: User[];
  permissions: Perm[];
  groupInherited: Inherited;
  currentUserId: string;
  currentUserIsCouple: boolean;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  // Map (userId, section) → override level for fast lookup. An
  // entry's existence means "user has an override row"; absence
  // means "inherits from group".
  const overrideMap = new Map<string, Level>();
  for (const p of permissions) overrideMap.set(`${p.userId}|${p.section}`, p.level);

  // Belt-and-braces: only the couple can change permissions, grant
  // couple-tier, or remove users. The server actions also gate on
  // user.isCouple (see settings/actions.ts — A2 fix from v1.2.0), so
  // even a forged request fails. This UI flag just stops non-couple
  // users from seeing clickable controls that will only error on submit.
  const couplePrivileged = canEdit && currentUserIsCouple;

  function changeLevel(userId: string, section: string, level: Level) {
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("section", section);
    fd.set("level", level);
    startTransition(async () => { await setPermission(fd); });
  }

  function clearOverride(userId: string, section: string) {
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("section", section);
    startTransition(async () => { await clearPermission(fd); });
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

  function inheritedLevel(userId: string, section: string): Level {
    return (groupInherited[userId]?.[section] ?? "NONE") as Level;
  }

  function levelLabel(l: Level): string {
    return l === "EDIT" ? "Edit" : l === "VIEW" ? "View" : "—";
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
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr className="border-b border-border-soft text-[10px] font-bold text-ink-tertiary uppercase tracking-wider bg-canvas">
              <th className="px-4 py-2 text-left sticky left-0 bg-canvas z-10">Member</th>
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
                  const overrideLevel = overrideMap.get(`${u.id}|${s}`);
                  const hasOverride = overrideLevel !== undefined;
                  const inherited = inheritedLevel(u.id, s);
                  const editable = couplePrivileged && !u.isCouple && !isCoupleOnly;
                  return (
                    <td key={s} className="px-2 py-2.5 text-center align-middle">
                      <PermissionCell
                        userId={u.id}
                        section={s}
                        userIsCouple={u.isCouple}
                        isCoupleOnly={isCoupleOnly}
                        hasOverride={hasOverride}
                        overrideLevel={overrideLevel}
                        inherited={inherited}
                        editable={editable}
                        pending={pending}
                        onCheck={(checked) => {
                          if (checked) {
                            // Default the override to whichever level
                            // makes sense: if inherited is below VIEW
                            // start at VIEW (the meaningful "grant view"
                            // case); otherwise jump to EDIT (the
                            // meaningful "boost above group VIEW" case).
                            const initial: Level = inherited === "EDIT" ? "EDIT" : inherited === "VIEW" ? "EDIT" : "VIEW";
                            changeLevel(u.id, s, initial);
                          } else {
                            clearOverride(u.id, s);
                          }
                        }}
                        onLevelChange={(level) => changeLevel(u.id, s, level)}
                        levelLabel={levelLabel}
                      />
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

function PermissionCell({
  userIsCouple,
  isCoupleOnly,
  hasOverride,
  overrideLevel,
  inherited,
  editable,
  pending,
  onCheck,
  onLevelChange,
  levelLabel,
}: {
  userId: string;
  section: string;
  userIsCouple: boolean;
  isCoupleOnly: boolean;
  hasOverride: boolean;
  overrideLevel: Level | undefined;
  inherited: Level;
  editable: boolean;
  pending: boolean;
  onCheck: (checked: boolean) => void;
  onLevelChange: (level: Level) => void;
  levelLabel: (l: Level) => string;
}) {
  // Couple-tier users have implicit edit on everything; render
  // a static "EDIT" pip rather than an interactive cell.
  if (userIsCouple) {
    return (
      <span className="text-[11px] text-moss-700 font-medium" title="Couple-tier — implicit edit on every section">
        Edit
      </span>
    );
  }
  // Couple-only sections — non-couple members can never have access.
  if (isCoupleOnly) {
    return (
      <span className="text-[11px] text-ink-tertiary italic" title="Couple-only section">
        —
      </span>
    );
  }
  return (
    <div className="flex items-center justify-center gap-1.5">
      <input
        type="checkbox"
        checked={hasOverride}
        disabled={!editable || pending}
        onChange={(e) => onCheck(e.target.checked)}
        title={hasOverride ? "Override is active — untick to inherit from groups" : "Tick to override the inherited group level"}
        className="accent-moss-500"
      />
      {hasOverride ? (
        <select
          value={overrideLevel ?? "VIEW"}
          disabled={!editable || pending}
          onChange={(e) => onLevelChange(e.target.value as Level)}
          className="text-[11px] bg-canvas border border-border-soft rounded-sm px-1 py-0.5 text-ink-secondary outline-none disabled:opacity-50"
        >
          <option value="VIEW">View</option>
          <option value="EDIT">Edit</option>
        </select>
      ) : (
        <span
          className="text-[11px] text-ink-tertiary"
          title={`Inherits from groups: ${levelLabel(inherited)}`}
        >
          {levelLabel(inherited)}
        </span>
      )}
    </div>
  );
}
