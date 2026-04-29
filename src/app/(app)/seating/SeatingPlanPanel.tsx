"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { updateSeatingChecklist, updateSeatingNotes } from "./actions";

// v1.23.1: plan-level notes + day-of checklist, always visible at the
// top of /seating. Replaces v1.23.0's collapsible PlanNotesPanel and
// per-table TableNotesAndChecklist — the user wanted one shared list
// for the whole plan, not one per table, and always-on visibility so
// it's not buried behind a click.
//
// Layout: two-column on lg+ screens (notes left, checklist right);
// stacked on mobile. Notes save explicitly via Save button; checklist
// toggles save optimistically with rollback on action failure (same
// pattern v1.23.0's per-table version used).

export type ChecklistItem = { id: string; label: string; done: boolean };

export function SeatingPlanPanel({
  initialNotes,
  initialChecklist,
  canEdit,
}: {
  initialNotes: string;
  initialChecklist: ChecklistItem[];
  canEdit: boolean;
}) {
  // Read-only viewers with nothing filled in see no panel — saves
  // vertical space above the canvas. Editors always see it (so they
  // can populate).
  if (!canEdit && initialNotes === "" && initialChecklist.length === 0) return null;

  return (
    <div className="px-4 sm:px-6 pt-3 grid gap-3 lg:grid-cols-2">
      <NotesCard initial={initialNotes} canEdit={canEdit} />
      <ChecklistCard initial={initialChecklist} canEdit={canEdit} />
    </div>
  );
}

function NotesCard({ initial, canEdit }: { initial: string; canEdit: boolean }) {
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
    <section className="bg-surface border border-border-soft rounded-md shadow-sm p-3">
      <strong className="block text-[11px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
        Notes
      </strong>
      {canEdit ? (
        <>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            placeholder="Table-size policy (min 6, max 10), board-game allocation, day-of staffing reminders, layout constraints…"
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
    </section>
  );
}

function ChecklistCard({
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

  const doneCount = items.filter((i) => i.done).length;

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm p-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <strong className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
          Day-of checklist
        </strong>
        {items.length > 0 && (
          <span className="text-[11px] text-ink-tertiary tabular-nums">
            {doneCount} / {items.length}
          </span>
        )}
      </div>
      {!canEdit && items.length === 0 ? (
        <p className="text-xs text-ink-tertiary italic">No checklist yet.</p>
      ) : (
        <ul className="space-y-1 mb-2 max-h-44 overflow-y-auto">
          {items.length === 0 && canEdit && (
            <li className="text-xs text-ink-tertiary italic">
              Place cards · menu cards · table number stands · centrepieces · favours · seating chart…
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
    </section>
  );
}
