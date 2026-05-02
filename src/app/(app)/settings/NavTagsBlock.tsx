"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { createNavTag, deleteNavTag, reorderNavTag, updateNavTag } from "./nav-tag-actions";

// v1.30.5: NavTag admin block. Couple-only — Settings page already
// gates its own visibility. Inline list with edit-in-place rows + an
// "Add tag" affordance. Linked-task count shown next to each row so
// the user can see at a glance which tags are in use.

type NavTagRow = {
  id: string;
  name: string;
  slug: string;
  route: string | null;
  order: number;
  linkedTaskCount: number;
};

export function NavTagsBlock({ tags }: { tags: NavTagRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  function onAdd(fd: FormData) {
    startTransition(async () => {
      try {
        await createNavTag(fd);
        notify("success", "Tag added");
        setAdding(false);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't add tag");
      }
    });
  }

  function onSave(id: string, fd: FormData) {
    startTransition(async () => {
      try {
        await updateNavTag(id, fd);
        notify("success", "Saved");
        setEditingId(null);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  async function onDelete(id: string, name: string, count: number) {
    if (!(await confirm({
      title: `Delete "${name}"?`,
      body: count > 0 ? `${count} task${count === 1 ? "" : "s"} will lose this tag. The task rows themselves stay.` : undefined,
      confirmLabel: "Delete",
      tone: "danger",
    }))) return;
    startTransition(async () => {
      try {
        await deleteNavTag(id);
        notify("success", "Deleted");
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't delete");
      }
    });
  }

  function onReorder(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const res = await reorderNavTag({ id, direction });
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-primary">Navigation tags</h2>
          <p className="text-xs text-ink-tertiary mt-0.5">
            Tags that tasks, questions, and decisions can be filed under
            (Music, Ceremony, Reception…). Couple-configurable.
          </p>
        </div>
        {!adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)} disabled={pending}>
            + Add tag
          </Button>
        )}
      </header>
      <ul className="divide-y divide-border-soft">
        {tags.map((t, idx) =>
          editingId === t.id ? (
            <li key={t.id} className="px-4 py-3">
              <NavTagEditForm
                tag={t}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSubmit={(fd) => onSave(t.id, fd)}
              />
            </li>
          ) : (
            <li key={t.id} className="px-4 py-2.5 flex items-baseline gap-3">
              {/* v1.54.0 (C3): reorder buttons. */}
              <span className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onReorder(t.id, "up")}
                  disabled={pending || idx === 0}
                  aria-label="Move up"
                  title="Move up"
                  className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-0.5"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => onReorder(t.id, "down")}
                  disabled={pending || idx === tags.length - 1}
                  aria-label="Move down"
                  title="Move down"
                  className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-0.5"
                >
                  ▼
                </button>
              </span>
              <span className="text-sm font-medium text-ink-primary flex-1 min-w-0 truncate">
                {t.name}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-ink-tertiary font-mono">
                {t.slug}
              </span>
              {t.route && (
                <span className="text-[10px] text-info truncate max-w-[160px]">
                  → {t.route}
                </span>
              )}
              <span className="text-[10px] text-ink-tertiary tabular-nums w-14 text-right">
                {t.linkedTaskCount} {t.linkedTaskCount === 1 ? "task" : "tasks"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setEditingId(t.id)} disabled={pending}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(t.id, t.name, t.linkedTaskCount)}
                disabled={pending}
              >
                ×
              </Button>
            </li>
          ),
        )}
        {tags.length === 0 && !adding && (
          <li className="px-4 py-3 text-sm text-ink-tertiary italic">
            No nav tags yet. Add one to start filing tasks under it.
          </li>
        )}
        {adding && (
          <li className="px-4 py-3 bg-canvas/30">
            <NavTagEditForm
              tag={null}
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

function NavTagEditForm({
  tag,
  pending,
  onCancel,
  onSubmit,
}: {
  tag: NavTagRow | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form
      action={onSubmit}
      className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end"
    >
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Name
        </label>
        <input
          name="name"
          defaultValue={tag?.name ?? ""}
          required
          autoFocus
          placeholder="e.g. Honeymoon"
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Slug
        </label>
        <input
          name="slug"
          defaultValue={tag?.slug ?? ""}
          placeholder="auto from name if empty"
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500 font-mono"
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Route (optional)
        </label>
        <input
          name="route"
          defaultValue={tag?.route ?? ""}
          placeholder="/songs"
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500 font-mono"
        />
      </div>
      <div className="sm:col-span-3 flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {tag ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
