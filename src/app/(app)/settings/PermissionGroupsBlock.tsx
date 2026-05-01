"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import {
  createPermissionGroup,
  deletePermissionGroup,
  togglePermissionGroupMember,
  updatePermissionGroup,
} from "./permission-group-actions";

// v1.40.0 (backlog #3): PermissionGroup admin panel. Couple-only —
// matches the rest of Settings. Shows DB-backed groups (custom)
// alongside the four virtual built-ins (read-only — they're
// computed from User.role / isCouple, not stored). Each custom
// group has an inline member-toggle list.
//
// v1.42.0: renamed from UserGroupsBlock. These manage **admin app
// users**. The parallel GuestGroupsBlock manages wedding-guest
// groups (different model, different consumers).

type UserRow = { id: string; name: string };

type GroupRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  order: number;
  members: UserRow[];
};

type BuiltinRow = {
  slug: string;
  name: string;
  members: UserRow[];
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
  const [pending, startTransition] = useTransition();

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

  function onDelete(id: string, name: string, count: number) {
    const msg =
      count > 0
        ? `Delete "${name}"? ${count} member link${count === 1 ? "" : "s"} will be removed (the users themselves stay).`
        : `Delete "${name}"?`;
    if (!confirm(msg)) return;
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

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-primary">Permission groups</h2>
          <p className="text-xs text-ink-tertiary mt-0.5">
            Bundle <strong>app users</strong> (the people who log in) together for picking schedule attendees, sending reminders, and (in future) per-section permission inheritance. For organising <strong>wedding guests</strong>, see the next panel.
            Built-in groups (Everyone / Couple / Wedding party / Planners) are
            computed from each user&apos;s role — they always exist. Add custom
            groups for ad-hoc bundles like &quot;After-party&quot; or
            &quot;Bryony&apos;s family&quot;.
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
          Built-in (read-only)
        </h3>
        <ul className="space-y-1 text-sm">
          {builtins.map((b) => (
            <li key={b.slug} className="flex items-baseline gap-2">
              <span className="text-ink-primary font-medium flex-1 min-w-0 truncate">
                {b.name}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-ink-tertiary font-mono">
                builtin:{b.slug}
              </span>
              <span className="text-[10px] text-ink-tertiary tabular-nums w-20 text-right">
                {b.members.length} {b.members.length === 1 ? "member" : "members"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <ul className="divide-y divide-border-soft">
        {groups.map((g) =>
          editingId === g.id ? (
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
                <button
                  type="button"
                  onClick={() => setOpenGroupId(openGroupId === g.id ? null : g.id)}
                  className="text-sm font-medium text-ink-primary hover:text-moss-700 flex-1 min-w-0 truncate text-left"
                  title="Click to expand member list"
                >
                  {openGroupId === g.id ? "▾" : "▸"} {g.name}
                </button>
                <span className="text-[10px] uppercase tracking-wider text-ink-tertiary font-mono">
                  group:{g.slug}
                </span>
                <span className="text-[10px] text-ink-tertiary tabular-nums w-20 text-right">
                  {g.members.length} {g.members.length === 1 ? "member" : "members"}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(g.id)} disabled={pending}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(g.id, g.name, g.members.length)}
                  disabled={pending}
                >
                  ×
                </Button>
              </div>
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
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          ),
        )}
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
