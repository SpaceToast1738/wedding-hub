"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import {
  clearAllUserOverrides,
  clearPermission,
  removeUser,
  setPermission,
  setUserCouple,
  setUserRole,
} from "./actions";
import { togglePermissionGroupMember } from "./permission-group-actions";
import { COUPLE_ONLY_SECTIONS, SECTIONS, type Section } from "@/lib/permissions";
import { useConfirm } from "@/components/ui/ConfirmDialog";

// v1.45.0: per-user editor — replaces the dense table-style
// PermissionMatrix from v1.44.0. One card per user; click to expand
// and edit:
//   • Group memberships  — toggle the user in/out of every custom
//     PermissionGroup. Built-in groups are listed as read-only chips
//     (membership is computed from User.role / isCouple).
//   • Per-section overrides  — checkbox-driven; default = inherit
//     from groups; tick to override with VIEW or EDIT. Same semantics
//     as v1.44.0 — NONE is dropped from the dropdown because
//     max(group, NONE) = group.
//   • Bulk-clear button  — wipe every per-user override for the user
//     so they resolve to pure group inheritance.
//   • Couple toggle + remove user — the existing controls from the
//     old matrix; preserved here as the natural per-user home.
//
// Default state of every override is OFF: the matrix only writes a
// per-user Permission row when the couple explicitly ticks the
// checkbox. Existing rows from older versions render ticked, so the
// "Clear all" button is the migration path back to inheritance.
//
// v1.59.0 (C2): each group toggle now shows the group's permission
// summary inline ("EDIT: tasks, songs · VIEW: schedule") so the
// couple can see what ticking the box will grant without bouncing
// up to the Permission groups panel. Built-in chip row gets the
// same treatment via the `builtinDetailsByUser` prop.

const SECTION_LABELS: Record<Section, string> = {
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
  money: "Money values",
  settings: "Settings",
  ai_chat: "AI chat",
  ai_write: "AI proposals",
};

type Level = "NONE" | "VIEW" | "EDIT";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isCouple: boolean;
};

type PermRow = { section: string; level: Level };

type GroupRow = {
  id: string;
  slug: string;
  name: string;
  /** v1.59.0 (C2): perms granted by membership in this group, so the
   *  toggle row can render an inline summary of what ticking the
   *  checkbox will grant. */
  permissions: PermRow[];
};

type BuiltinDetail = {
  /** Display name, e.g. "Wedding party". */
  name: string;
  /** Slug for the `builtin:<slug>` group key, e.g. "wedding-party-role". */
  slug: string;
  permissions: PermRow[];
};

export function MemberOverridesBlock({
  users,
  permissions,
  groupInherited,
  builtinDetailsByUser,
  customGroups,
  customGroupMembershipByUser,
  currentUserId,
  currentUserIsCouple,
  canEdit,
}: {
  users: UserRow[];
  permissions: { userId: string; section: string; level: Level }[];
  /** `groupInherited[userId][section]` = effective group level. */
  groupInherited: Record<string, Record<string, Level>>;
  /** v1.59.0 (C2): per-user list of built-in groups they qualify for,
   *  with each group's permissions attached, so the chip row can
   *  show the perm summary inline next to the group name. Replaces
   *  the v1.45.0 `builtinKeysByUser` (label-only) prop. */
  builtinDetailsByUser: Record<string, BuiltinDetail[]>;
  /** All custom permission groups (slug + name + id + perms) for the toggle list. */
  customGroups: GroupRow[];
  /** Set of customGroup ids each user is currently a member of. */
  customGroupMembershipByUser: Record<string, Set<string>>;
  currentUserId: string;
  currentUserIsCouple: boolean;
  canEdit: boolean;
}) {
  // v1.45.1: lock the last couple-tier user — server enforces it
  // too, but disabling the controls in the UI prevents the failed
  // request + error toast loop.
  const coupleCount = users.filter((u) => u.isCouple).length;
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const overrideMap = new Map<string, Level>();
  for (const p of permissions) overrideMap.set(`${p.userId}|${p.section}`, p.level);
  const couplePrivileged = canEdit && currentUserIsCouple;

  function inheritedLevel(userId: string, section: string): Level {
    return (groupInherited[userId]?.[section] ?? "NONE") as Level;
  }
  function levelLabel(l: Level): string {
    return l === "EDIT" ? "Edit" : l === "VIEW" ? "View" : "—";
  }

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

  async function clearAll(userId: string, name: string, count: number) {
    if (count === 0) {
      notify("info", "No overrides to clear");
      return;
    }
    if (!(await confirm({
      title: `Clear all ${count} per-user override${count === 1 ? "" : "s"} for ${name}?`,
      body: "They'll inherit from their groups instead.",
      confirmLabel: "Clear all",
    }))) return;
    startTransition(async () => {
      const res = await clearAllUserOverrides(userId);
      if (res.ok) notify("success", res.cleared > 0 ? `Cleared ${res.cleared} override${res.cleared === 1 ? "" : "s"}` : "Already had none");
      else notify("error", res.error);
    });
  }

  async function toggleCouple(userId: string, isCouple: boolean) {
    if (!(await confirm({
      title: `${isCouple ? "Grant" : "Revoke"} couple-tier access?`,
      confirmLabel: isCouple ? "Grant" : "Revoke",
      tone: isCouple ? "default" : "danger",
    }))) return;
    startTransition(async () => { await setUserCouple(userId, isCouple); });
  }

  function changeRole(userId: string, role: "WEDDING_PARTY" | "PLANNER" | "VIEWER") {
    startTransition(async () => {
      try {
        await setUserRole(userId, role);
        notify("success", `Role updated to ${role.replace("_", " ").toLowerCase()}`);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't change role");
      }
    });
  }

  async function remove(u: UserRow) {
    const label = u.name ?? u.email;
    const bodyParts: string[] = [
      "This deletes their account row, sessions, and per-section permissions. They can sign in again if you re-invite them.",
    ];
    if (u.isCouple) {
      bodyParts.push(
        "They have couple-tier access. If they were the only signed-in admin, the next person to sign in will be auto-promoted to replace them.",
      );
    }
    if (!(await confirm({
      title: `Remove ${label} from the members list?`,
      body: bodyParts.join("\n\n"),
      confirmLabel: "Remove",
      tone: "danger",
    }))) return;
    startTransition(async () => { await removeUser(u.id); });
  }

  function toggleGroupMembership(groupId: string, userId: string, on: boolean) {
    startTransition(async () => {
      const res = await togglePermissionGroupMember({ groupId, userId, on });
      if (!res.ok) notify("error", res.error);
    });
  }

  function overrideCount(userId: string): number {
    let n = 0;
    for (const s of SECTIONS) if (overrideMap.has(`${userId}|${s}`)) n++;
    return n;
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft">
        <h2 className="text-sm font-semibold text-ink-primary">Members &amp; per-user overrides</h2>
        <p className="text-xs text-ink-tertiary mt-0.5">
          One card per app user. Expand to edit their group memberships
          or set per-section overrides. Overrides default off — the user
          inherits from their groups; tick a section to override.
        </p>
      </header>

      {canEdit && !currentUserIsCouple && (
        <div className="mx-4 mt-3 bg-canvas border border-border-soft text-ink-secondary rounded-md px-4 py-2.5 text-xs flex items-start gap-2">
          <span className="text-marigold-700 flex-shrink-0">🔒</span>
          <span>
            <strong>Read-only.</strong> You have edit access to Settings, but only the couple
            can change other members&apos; permissions, grant couple-tier access, or remove members.
          </span>
        </div>
      )}

      <ul className="divide-y divide-border-soft">
        {users.map((u) => {
          const isOpen = openUserId === u.id;
          const overrides = overrideCount(u.id);
          const memberOf = customGroupMembershipByUser[u.id] ?? new Set();
          // Last-couple lock: this user is the only remaining
          // couple-tier admin, so revoking their flag or removing
          // them would leave the running session with zero admins.
          const isLastCouple = u.isCouple && coupleCount <= 1;
          return (
            <li key={u.id} className="px-4 py-2.5 group">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpenUserId(isOpen ? null : u.id)}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left hover:text-moss-700"
                  title="Click to expand"
                >
                  <span className="text-ink-tertiary text-xs w-3">{isOpen ? "▾" : "▸"}</span>
                  <Avatar name={u.name ?? u.email} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink-primary truncate">
                      {u.name ?? u.email}
                      {u.id === currentUserId && (
                        <span className="text-[10px] text-ink-tertiary ml-1">(you)</span>
                      )}
                      {u.isCouple && (
                        <span
                          className="ml-2 text-[10px] uppercase tracking-wider text-moss-700 font-semibold"
                          title={isLastCouple ? "Locked — only remaining couple-tier admin" : "Couple-tier admin"}
                        >
                          Couple{isLastCouple && <span className="ml-0.5" aria-label="locked">🔒</span>}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-tertiary truncate">
                      {u.isCouple ? "couple" : u.role.replace("_", " ").toLowerCase()} · {u.email}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10px] text-ink-tertiary tabular-nums">
                    {memberOf.size} {memberOf.size === 1 ? "group" : "groups"}
                  </span>
                  <span
                    className={`text-[10px] tabular-nums ${overrides > 0 ? "text-marigold-700 font-semibold" : "text-ink-tertiary"}`}
                    title={overrides > 0 ? "Has per-user overrides — usually you want pure group inheritance" : "No overrides — pure group inheritance"}
                  >
                    {overrides} {overrides === 1 ? "override" : "overrides"}
                  </span>
                  {couplePrivileged && u.id !== currentUserId && !isLastCouple && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${u.name ?? u.email}`}
                      onClick={() => remove(u)}
                      disabled={pending}
                    >
                      ×
                    </Button>
                  )}
                  {isLastCouple && couplePrivileged && (
                    <span
                      className="text-[10px] text-ink-tertiary"
                      title="Can't remove the only remaining couple-tier admin. Promote another user first."
                      aria-label="Locked — only remaining couple-tier admin"
                    >
                      🔒
                    </span>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 ml-5 pl-3 border-l border-border-soft space-y-4">
                  {/* Couple toggle — same gates as the old matrix had. */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`couple-${u.id}`}
                      checked={u.isCouple}
                      disabled={!couplePrivileged || pending || u.id === currentUserId || isLastCouple}
                      onChange={(e) => toggleCouple(u.id, e.target.checked)}
                      className="accent-moss-500"
                    />
                    <label
                      htmlFor={`couple-${u.id}`}
                      className="text-sm text-ink-primary cursor-pointer"
                      title={
                        u.id === currentUserId
                          ? "You can't change your own couple flag"
                          : isLastCouple
                            ? "Locked — last couple-tier admin. Promote another user first."
                            : !currentUserIsCouple
                              ? "Only the couple can change couple-tier membership"
                              : undefined
                      }
                    >
                      Couple-tier access (implicit edit on every section)
                      {isLastCouple && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wider text-marigold-700 font-semibold">
                          🔒 locked — last admin
                        </span>
                      )}
                    </label>
                  </div>

                  {/* v1.45.2: role select — drives membership in the
                      "Wedding party (by role)" / "Planners (by role)"
                      built-in groups. Excludes COUPLE because that's
                      managed via the checkbox above (kept in sync at
                      bootstrap, manually thereafter). */}
                  <div className="flex items-center gap-2">
                    <label htmlFor={`role-${u.id}`} className="text-sm text-ink-primary">
                      Role
                    </label>
                    <select
                      id={`role-${u.id}`}
                      value={u.role === "COUPLE" ? "VIEWER" : u.role}
                      disabled={!couplePrivileged || pending || u.isCouple}
                      onChange={(e) => changeRole(u.id, e.target.value as "WEDDING_PARTY" | "PLANNER" | "VIEWER")}
                      title={
                        u.isCouple
                          ? "Couple-tier users keep their role implicitly. Revoke couple-tier first to edit role."
                          : !currentUserIsCouple
                            ? "Only the couple can change user roles"
                            : "Drives membership in the role-based built-in groups"
                      }
                      className="text-[12px] bg-canvas border border-border-soft rounded-sm px-1.5 py-0.5 text-ink-secondary outline-none disabled:opacity-50"
                    >
                      <option value="WEDDING_PARTY">Wedding party</option>
                      <option value="PLANNER">Planner</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <span className="text-[11px] text-ink-tertiary">
                      {u.isCouple ? "couple-tier bypasses role groups" : `drives the “${u.role === "WEDDING_PARTY" ? "Wedding party" : u.role === "PLANNER" ? "Planners" : "Everyone"}” built-in group`}
                    </span>
                  </div>

                  {/* Group memberships */}
                  <div>
                    <h3 className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
                      Group memberships
                    </h3>
                    {/* v1.59.0 (C2): built-in chips render their own
                        permission summary line each, not just a
                        comma-separated label list. Read-only — the
                        membership is computed from User.role /
                        isCouple, but the perms are interesting. */}
                    {(builtinDetailsByUser[u.id] ?? []).length > 0 && (
                      <div className="mb-2 space-y-0.5">
                        <p className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
                          Built-in (computed from role)
                        </p>
                        <ul className="space-y-0.5">
                          {(builtinDetailsByUser[u.id] ?? []).map((b) => (
                            <li key={b.slug} className="text-[12px] text-ink-secondary flex items-baseline gap-2">
                              <span className="italic flex-shrink-0">{b.name}</span>
                              <PermsLine perms={b.permissions} muted />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {customGroups.length === 0 ? (
                      <p className="text-xs text-ink-tertiary italic">
                        No custom groups exist yet — add one in the Permission groups panel above.
                      </p>
                    ) : (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {customGroups.map((g) => {
                          const on = memberOf.has(g.id);
                          return (
                            <li key={g.id} className="flex flex-col gap-0.5">
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={on}
                                  disabled={!couplePrivileged || pending}
                                  onChange={(e) => toggleGroupMembership(g.id, u.id, e.target.checked)}
                                  className="accent-moss-500"
                                />
                                {/* v2.5.0 (design pass #10): the raw
                                    `group:<slug>` identifier moved to a
                                    title tooltip — it has no value to
                                    a user browsing the list. */}
                                <span
                                  className={on ? "text-ink-primary" : "text-ink-tertiary"}
                                  title={`group:${g.slug}`}
                                >
                                  {g.name}
                                </span>
                              </label>
                              <div className="ml-6">
                                <PermsLine perms={g.permissions} muted />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Per-section overrides */}
                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <h3 className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
                        Per-section overrides
                      </h3>
                      {overrides > 0 && couplePrivileged && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearAll(u.id, u.name ?? u.email, overrides)}
                          disabled={pending}
                        >
                          Clear all overrides
                        </Button>
                      )}
                    </div>
                    {u.isCouple ? (
                      <p className="text-xs text-ink-tertiary italic">
                        Couple-tier — implicit edit on every section. Per-user overrides are ignored.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 bg-canvas/40 border border-border-soft rounded-sm px-3 py-2">
                        {SECTIONS.map((s) => {
                          const isCoupleOnly = COUPLE_ONLY_SECTIONS.includes(s);
                          const overrideLevel = overrideMap.get(`${u.id}|${s}`);
                          const hasOverride = overrideLevel !== undefined;
                          const inherited = inheritedLevel(u.id, s);
                          const editable = couplePrivileged && !isCoupleOnly;
                          return (
                            <div
                              key={s}
                              className="flex items-center gap-2 text-[12px]"
                              title={isCoupleOnly ? "Couple-only section — overrides ignored for non-couple members" : undefined}
                            >
                              <input
                                type="checkbox"
                                checked={hasOverride}
                                disabled={!editable || pending}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const initial: Level = inherited === "EDIT" ? "EDIT" : inherited === "VIEW" ? "EDIT" : "VIEW";
                                    changeLevel(u.id, s, initial);
                                  } else {
                                    clearOverride(u.id, s);
                                  }
                                }}
                                className="accent-moss-500"
                              />
                              <span className={`flex-1 truncate ${isCoupleOnly ? "text-ink-tertiary italic" : "text-ink-secondary"}`}>
                                {SECTION_LABELS[s]}
                              </span>
                              {hasOverride ? (
                                <select
                                  value={overrideLevel ?? "VIEW"}
                                  disabled={!editable || pending}
                                  onChange={(e) => changeLevel(u.id, s, e.target.value as Level)}
                                  className="text-[11px] bg-canvas border border-border-soft rounded-sm px-1 py-0.5 text-ink-secondary outline-none disabled:opacity-50"
                                >
                                  <option value="VIEW">View</option>
                                  <option value="EDIT">Edit</option>
                                </select>
                              ) : (
                                <span
                                  className="text-[11px] text-ink-tertiary tabular-nums w-10 text-right"
                                  title={`Inherits from groups: ${levelLabel(inherited)}`}
                                >
                                  {levelLabel(inherited)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// v1.59.0 (C2): one-line permission summary —
//   "EDIT: tasks, songs · VIEW: schedule"
// Mirrors PermissionsSummary in PermissionGroupsBlock so the
// language matches across the two surfaces. Falls back to a muted
// "no perms granted" hint when the group is empty so the toggle
// row never looks broken.
function PermsLine({ perms, muted }: { perms: PermRow[]; muted?: boolean }) {
  const editLabels: string[] = [];
  const viewLabels: string[] = [];
  for (const p of perms) {
    const label = SECTION_LABELS[p.section as Section] ?? p.section;
    if (p.level === "EDIT") editLabels.push(label);
    else if (p.level === "VIEW") viewLabels.push(label);
  }
  if (editLabels.length === 0 && viewLabels.length === 0) {
    return (
      <span className={`text-[10px] italic ${muted ? "text-ink-tertiary" : "text-ink-secondary"}`}>
        no permissions granted
      </span>
    );
  }
  return (
    <span className={`text-[10px] ${muted ? "text-ink-tertiary" : "text-ink-secondary"}`}>
      {editLabels.length > 0 && (
        <>
          <span className="font-semibold text-moss-700">EDIT:</span> {editLabels.join(", ")}
        </>
      )}
      {editLabels.length > 0 && viewLabels.length > 0 && (
        <span className="mx-1.5 text-ink-tertiary">·</span>
      )}
      {viewLabels.length > 0 && (
        <>
          <span className="font-semibold">VIEW:</span> {viewLabels.join(", ")}
        </>
      )}
    </span>
  );
}
