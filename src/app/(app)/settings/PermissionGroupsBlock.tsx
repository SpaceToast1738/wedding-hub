"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  createPermissionGroup,
  deletePermissionGroup,
  reorderPermissionGroup,
  setGroupPermission,
  togglePermissionGroupMember,
  updatePermissionGroup,
} from "./permission-group-actions";
import { COUPLE_ONLY_SECTIONS, SECTIONS, type Section } from "@/lib/permissions";
import type { PermissionLevel } from "@prisma/client";

// v1.40.0 (backlog #3): PermissionGroup admin panel. Couple-only —
// matches the rest of Settings. Shows DB-backed groups (custom)
// alongside the four virtual built-ins (computed from User.role /
// isCouple, not stored).
//
// v1.42.0: renamed from UserGroupsBlock. These manage **admin app
// users**. The parallel GuestGroupsBlock manages wedding-guest
// groups (different model, different consumers).
//
// v1.43.0: per-group permission matrix added. Built-ins are now
// editable for **permissions** (e.g. "give all wedding party VIEW on
// schedule") even though their **membership** is still computed from
// User.role. Each group row shows a one-line summary by default
// (EDIT: book · VIEW: songs · ...) with a "Permissions" toggle
// revealing the full 12-section matrix on demand.

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
  // v1.76.0: cross-cuts the other sections — controls visibility of
  // money values (£) inside BUILD/MENU/BAR/OUTFIT/STAY cards and on
  // the supplier detail page. Default NONE for non-couple.
  money: "Money values",
  settings: "Settings",
  ai_chat: "AI chat",
  ai_write: "AI proposals",
};

type UserRow = { id: string; name: string; email?: string };

type PermRow = { section: string; level: PermissionLevel };

type GroupRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  order: number;
  members: UserRow[];
  permissions: PermRow[];
};

type BuiltinRow = {
  slug: string;
  name: string;
  members: UserRow[];
  permissions: PermRow[];
};

export function PermissionGroupsBlock({
  groups,
  builtins,
  allUsers,
}: {
  groups: GroupRow[];
  builtins: BuiltinRow[];
  allUsers: UserRow[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [openPermsKey, setOpenPermsKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  function onAdd(fd: FormData) {
    startTransition(async () => {
      const res = await createPermissionGroup(fd);
      if (res.ok) {
        notify("success", "Group added");
        setAdding(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  function onSave(id: string, fd: FormData) {
    startTransition(async () => {
      const res = await updatePermissionGroup(id, fd);
      if (res.ok) {
        notify("success", "Saved");
        setEditingId(null);
      } else {
        notify("error", res.error);
      }
    });
  }

  async function onDelete(id: string, name: string, count: number) {
    if (!(await confirm({
      title: `Delete "${name}"?`,
      body: count > 0 ? `${count} member link${count === 1 ? "" : "s"} will be removed. The users themselves stay.` : undefined,
      confirmLabel: "Delete",
      tone: "danger",
    }))) return;
    startTransition(async () => {
      const res = await deletePermissionGroup(id);
      if (res.ok) notify("success", "Deleted");
      else notify("error", res.error);
    });
  }

  function onToggleMember(groupId: string, userId: string, on: boolean) {
    startTransition(async () => {
      const res = await togglePermissionGroupMember({ groupId, userId, on });
      if (!res.ok) notify("error", res.error);
    });
  }

  function onReorder(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const res = await reorderPermissionGroup({ id, direction });
      if (!res.ok) notify("error", res.error);
    });
  }

  function onSetPerm(groupKey: string, section: Section, level: PermissionLevel) {
    startTransition(async () => {
      const res = await setGroupPermission({ groupKey, section, level });
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-primary">Permission groups</h2>
          <p className="text-xs text-ink-tertiary mt-0.5">
            Assign per-section permissions to a group; members inherit the
            max across every group they belong to. Built-ins (Everyone /
            Couple / Wedding party / Planners) compute their members from
            each user&apos;s role.
          </p>
        </div>
        {!adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)} disabled={pending}>
            + Add group
          </Button>
        )}
      </header>
      <div className="px-4 py-3 border-b border-border-soft bg-canvas/40">
        <h3 className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
          Built-in (members computed from role)
        </h3>
        <ul className="space-y-1.5 text-sm">
          {builtins.map((b) => {
            const groupKey = `builtin:${b.slug}`;
            const permsOpen = openPermsKey === groupKey;
            const membersOpen = openGroupId === groupKey;
            return (
              <li key={b.slug}>
                <div className="flex items-baseline gap-2">
                  {/* v2.5.0 (design pass #10): the raw `builtin:<slug>`
                      identifier moved to a title tooltip — it has no
                      value to a user browsing the list. */}
                  <span
                    className="text-ink-primary font-medium flex-1 min-w-0 truncate"
                    title={groupKey}
                  >
                    {b.name}
                  </span>
                  <span className="text-[10px] text-ink-tertiary tabular-nums w-20 text-right">
                    {b.members.length} {b.members.length === 1 ? "member" : "members"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenGroupId(membersOpen ? null : groupKey)}
                    disabled={pending}
                    aria-expanded={membersOpen}
                  >
                    {membersOpen ? "Hide" : "Members"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenPermsKey(permsOpen ? null : groupKey)}
                    disabled={pending}
                    aria-expanded={permsOpen}
                  >
                    {permsOpen ? "Hide" : "Permissions"}
                  </Button>
                </div>
                <PermissionsSummary perms={b.permissions} />
                {permsOpen && (
                  <PermissionsMatrix
                    groupKey={groupKey}
                    perms={b.permissions}
                    pending={pending}
                    onSet={onSetPerm}
                  />
                )}
                {membersOpen && (
                  <div className="mt-1.5 ml-3 pl-3 border-l border-border-soft">
                    <p className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
                      Members ({b.members.length})
                    </p>
                    {/* v1.45.2: explain how to change membership for
                        each built-in. Each one is computed from a
                        different attribute, so the direction is
                        per-slug. */}
                    <p className="text-[11px] text-ink-tertiary mb-2 italic">
                      {b.slug === "everyone" &&
                        "Everyone with an account is automatically here. Use the Members & per-user overrides panel below to remove a user entirely."}
                      {b.slug === "couple" &&
                        "Members are users with couple-tier access. Toggle the Couple-tier checkbox on a user's card in the Members & per-user overrides panel below."}
                      {b.slug === "wedding-party-role" &&
                        "Members have role = Wedding party. Change a user's role in the Members & per-user overrides panel below."}
                      {b.slug === "planners-role" &&
                        "Members have role = Planner. Change a user's role in the Members & per-user overrides panel below."}
                    </p>
                    {b.members.length === 0 ? (
                      <p className="text-xs text-ink-tertiary italic">No matching users.</p>
                    ) : (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-0.5 text-sm">
                        {/* v1.45.1: surface email alongside name —
                            two users can share a display name (e.g.
                            "Jamie Spencer" appearing twice if there
                            are two accounts), and the couple needs
                            to tell them apart to decide which to
                            keep. Email is unique. */}
                        {b.members.map((m) => (
                          <li key={m.id} className="text-ink-secondary truncate">
                            {m.name}
                            {m.email && (
                              <span className="ml-1.5 text-[11px] text-ink-tertiary">
                                {m.email}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <ul className="divide-y divide-border-soft">
        {groups.map((g, idx) => {
          const groupKey = `group:${g.slug}`;
          const permsOpen = openPermsKey === groupKey;
          return editingId === g.id ? (
            <li key={g.id} className="px-4 py-3">
              <GroupEditForm
                group={g}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSubmit={(fd) => onSave(g.id, fd)}
              />
            </li>
          ) : (
            <li key={g.id} className="px-4 py-2.5">
              <div className="flex items-baseline gap-3">
                {/* v1.54.0 (C3): reorder buttons. Schema's `order`
                    column drives the displayed sequence; ▲▼ swap the
                    target's order with the adjacent row's. Disabled
                    at edges.
                    v2.5.0 (design pass #10): min-h/min-w-[40px] mobile
                    touch floor, reverting to the dense desktop size at
                    640px+ — matches the Button/Tag convention. These
                    were previously just px-0.5 with no vertical
                    padding, well under any usable tap target. */}
                <span className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onReorder(g.id, "up")}
                    disabled={pending || idx === 0}
                    aria-label={`Move ${g.name} up`}
                    title="Move up"
                    className="min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-0.5"
                  >
                    <ChevronUp aria-hidden className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReorder(g.id, "down")}
                    disabled={pending || idx === groups.length - 1}
                    aria-label={`Move ${g.name} down`}
                    title="Move down"
                    className="min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-0.5"
                  >
                    <ChevronDown aria-hidden className="w-3.5 h-3.5" />
                  </button>
                </span>
                {/* v2.5.0 (design pass #10): the raw `group:<slug>`
                    identifier moved to a title tooltip — it has no
                    value to a user browsing the list. */}
                <span
                  className="text-sm font-medium text-ink-primary flex-1 min-w-0 truncate"
                  title={groupKey}
                >
                  {g.name}
                </span>
                <span className="text-[10px] text-ink-tertiary tabular-nums w-20 text-right">
                  {g.members.length} {g.members.length === 1 ? "member" : "members"}
                </span>
                {/* v1.43.1: explicit Members + Permissions toggles.
                    Members used to live behind clicking the group
                    title — easy to miss. Now both surfaces are
                    visible buttons in the row. */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenGroupId(openGroupId === g.id ? null : g.id)}
                  disabled={pending}
                  aria-expanded={openGroupId === g.id}
                >
                  {openGroupId === g.id ? "Hide" : "Members"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenPermsKey(permsOpen ? null : groupKey)}
                  disabled={pending}
                  aria-expanded={permsOpen}
                >
                  {permsOpen ? "Hide" : "Permissions"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(g.id)} disabled={pending}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${g.name}`}
                  onClick={() => onDelete(g.id, g.name, g.members.length)}
                  disabled={pending}
                >
                  ×
                </Button>
              </div>
              <PermissionsSummary perms={g.permissions} />
              {permsOpen && (
                <PermissionsMatrix
                  groupKey={groupKey}
                  perms={g.permissions}
                  pending={pending}
                  onSet={onSetPerm}
                />
              )}
              {openGroupId === g.id && (
                <div className="mt-2 ml-5 pl-3 border-l border-border-soft">
                  {g.description && (
                    <p className="text-xs text-ink-tertiary mb-2 italic">{g.description}</p>
                  )}
                  <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
                    Members ({g.members.length} of {allUsers.length})
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {allUsers.map((u) => {
                      const on = g.members.some((m) => m.id === u.id);
                      return (
                        <li key={u.id}>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={(e) => onToggleMember(g.id, u.id, e.target.checked)}
                              disabled={pending}
                              className="accent-moss-500"
                            />
                            <span className={on ? "text-ink-primary" : "text-ink-tertiary"}>
                              {u.name}
                            </span>
                            {u.email && (
                              <span className="text-[11px] text-ink-tertiary truncate">
                                {u.email}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
        {groups.length === 0 && !adding && (
          <li className="px-4 py-3 text-sm text-ink-tertiary italic">
            No custom groups yet. Add one to bundle a subset of users together.
          </li>
        )}
        {adding && (
          <li className="px-4 py-3 bg-canvas/30">
            <GroupEditForm
              group={null}
              pending={pending}
              onCancel={() => setAdding(false)}
              onSubmit={onAdd}
            />
          </li>
        )}
      </ul>
    </section>
  );
}

// ─── One-line permission summary ────────────────────────────────────
//
// "EDIT: book, schedule · VIEW: songs · NONE: rest" — keeps the
// group rows scannable. Skips NONE explicitly (no point listing
// every section a group can't see). When the group has no
// permissions at all, prints a muted hint pointing at the
// Permissions toggle.

function PermissionsSummary({ perms }: { perms: PermRow[] }) {
  const byLevel = { EDIT: [] as string[], VIEW: [] as string[] };
  for (const p of perms) {
    if (p.level === "EDIT") byLevel.EDIT.push(SECTION_LABELS[p.section as Section] ?? p.section);
    else if (p.level === "VIEW") byLevel.VIEW.push(SECTION_LABELS[p.section as Section] ?? p.section);
  }
  if (byLevel.EDIT.length === 0 && byLevel.VIEW.length === 0) {
    return (
      <p className="text-[11px] text-ink-tertiary mt-0.5 ml-0 italic">
        No permissions yet — click <strong>Permissions</strong> to grant access.
      </p>
    );
  }
  return (
    <p className="text-[11px] text-ink-tertiary mt-0.5 ml-0">
      {byLevel.EDIT.length > 0 && (
        <>
          <span className="font-semibold text-moss-700">EDIT:</span>{" "}
          {byLevel.EDIT.join(", ")}
        </>
      )}
      {byLevel.EDIT.length > 0 && byLevel.VIEW.length > 0 && (
        <span className="mx-2 text-ink-tertiary">·</span>
      )}
      {byLevel.VIEW.length > 0 && (
        <>
          <span className="font-semibold">VIEW:</span> {byLevel.VIEW.join(", ")}
        </>
      )}
    </p>
  );
}

// ─── Full-grid permission editor ────────────────────────────────────
//
// 12-section grid of NONE / VIEW / EDIT segmented controls. Couple-
// only sections (budget / payments) render disabled — they always
// resolve to "couple-only" regardless of group level. Server action
// mirrors that gate; the UI only hides the noise.

function PermissionsMatrix({
  groupKey,
  perms,
  pending,
  onSet,
}: {
  groupKey: string;
  perms: PermRow[];
  pending: boolean;
  onSet: (groupKey: string, section: Section, level: PermissionLevel) => void;
}) {
  const map = new Map<string, PermissionLevel>();
  for (const p of perms) map.set(p.section, p.level);
  return (
    <div className="mt-2 mb-1 ml-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 bg-canvas/40 border border-border-soft rounded-sm px-3 py-2">
      {SECTIONS.map((s) => {
        const isCoupleOnly = COUPLE_ONLY_SECTIONS.includes(s);
        const level = map.get(s) ?? "NONE";
        return (
          <div key={s} className="flex items-center gap-2 text-[12px]">
            <span
              className={`flex-1 truncate ${isCoupleOnly ? "text-ink-tertiary italic" : "text-ink-secondary"}`}
              title={isCoupleOnly ? "Couple-only — non-couple members can't be granted access" : undefined}
            >
              {SECTION_LABELS[s]}
            </span>
            <select
              value={level}
              disabled={pending || isCoupleOnly}
              onChange={(e) => onSet(groupKey, s, e.target.value as PermissionLevel)}
              className="text-[11px] bg-canvas border border-border-soft rounded-sm px-1 py-0.5 text-ink-secondary outline-none disabled:opacity-50"
            >
              <option value="NONE">None</option>
              <option value="VIEW">View</option>
              <option value="EDIT">Edit</option>
            </select>
          </div>
        );
      })}
    </div>
  );
}

function GroupEditForm({
  group,
  pending,
  onCancel,
  onSubmit,
}: {
  group: GroupRow | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form action={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Name
        </label>
        <input
          name="name"
          defaultValue={group?.name ?? ""}
          required
          autoFocus
          maxLength={120}
          placeholder="e.g. After-party"
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Slug
        </label>
        <input
          name="slug"
          defaultValue={group?.slug ?? ""}
          maxLength={60}
          placeholder="auto from name if empty"
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500 font-mono"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Description (optional)
        </label>
        <input
          name="description"
          defaultValue={group?.description ?? ""}
          maxLength={2000}
          placeholder="What this group is for"
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
        />
      </div>
      <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {group ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
