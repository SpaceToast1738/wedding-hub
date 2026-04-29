"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { updateSeatingChecklist, updateSeatingNotes } from "./actions";

// v1.23.2: notes + checklist content cards. v1.23.1 rendered them at
// the top of /seating wrapped in their own card chrome; this version
// moves them into the canvas sidebar wrapped in CollapsiblePanel. The
// cards themselves no longer own their card chrome (border / shadow /
// title) — that lives on the CollapsiblePanel wrapper now. Returning
// bare body markup keeps nesting clean and matches the visual rhythm
// of the rest of the sidebar.

export type ChecklistItem = { id: string; label: string; done: boolean };

export function NotesContent({
  initial,
  canEdit,
}: {
  initial: string;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      try {
        await updateSeatingNotes(value);
        setSaved(value);
        notify("success", "Notes saved");
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  return (
    <div className="p-3">
      {canEdit ? (
        <>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            placeholder="Table-size policy (min 6, max 10), board-game allocation, day-of staffing, layout constraints…"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
          />
          {value !== saved && (
            <div className="flex justify-end gap-2 mt-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setValue(saved)}
                disabled={pending}
              >
                Reset
              </Button>
              <Button variant="primary" size="sm" onClick={onSave} disabled={pending}>
                Save
              </Button>
            </div>
          )}
        </>
      ) : saved ? (
        <pre className="whitespace-pre-wrap text-sm text-ink-secondary font-sans">
          {saved}
        </pre>
      ) : (
        <p className="text-xs text-ink-tertiary italic">No notes yet.</p>
      )}
    </div>
  );
}

export function ChecklistContent({
  initial,
  canEdit,
}: {
  initial: ChecklistItem[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState<ChecklistItem[]>(initial);
  const [newItem, setNewItem] = useState("");
  const [pending, startTransition] = useTransition();

  function persist(next: ChecklistItem[]) {
    const prev = items;
    setItems(next);
    startTransition(async () => {
      try {
        await updateSeatingChecklist(next);
      } catch (err) {
        setItems(prev);
        notify("error", err instanceof Error ? err.message : "Couldn't save checklist");
      }
    });
  }

  function toggle(id: string) {
    persist(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  }

  function remove(id: string) {
    persist(items.filter((it) => it.id !== id));
  }

  function add() {
    const label = newItem.trim();
    if (!label) return;
    const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    persist([...items, { id, label, done: false }]);
    setNewItem("");
  }

  return (
    <div className="p-3">
      {!canEdit && items.length === 0 ? (
        <p className="text-xs text-ink-tertiary italic">No checklist yet.</p>
      ) : (
        <ul className="space-y-1 mb-2 max-h-56 overflow-y-auto">
          {items.length === 0 && canEdit && (
            <li className="text-xs text-ink-tertiary italic">
              Place cards · menu cards · table-number stands · centrepieces · favours…
            </li>
          )}
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={it.done}
                disabled={!canEdit || pending}
                onChange={() => canEdit && toggle(it.id)}
                className="accent-moss-500 flex-shrink-0"
              />
              <span
                className={[
                  "flex-1 truncate",
                  it.done ? "line-through text-ink-tertiary" : "text-ink-primary",
                ].join(" ")}
              >
                {it.label}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  disabled={pending}
                  className="text-[10px] text-ink-tertiary hover:text-danger px-1"
                  aria-label={`Remove "${it.label}"`}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="New item (Enter to add)"
            maxLength={200}
            disabled={pending}
            className="flex-1 text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={add}
            disabled={pending || newItem.trim() === ""}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper to expose the done/total badge for the CollapsiblePanel
// `rightSlot` — visible even when the panel is collapsed so the user
// always sees their day-of progress at a glance.
export function checklistRightSlot(items: ChecklistItem[]): React.ReactNode {
  if (items.length === 0) return null;
  const done = items.filter((i) => i.done).length;
  return (
    <span className="text-[10px] text-ink-tertiary tabular-nums">
      {done} / {items.length}
    </span>
  );
}
