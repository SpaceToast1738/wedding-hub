"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { updateTableChecklist, updateTableNotes } from "./actions";

// v1.23.0: per-table notes + day-of checklist. Used in two places:
// the canvas FocusPanel (right-hand side) and the list-view
// TableCard. Same UI shape both places — saved as a separate
// component to avoid duplicating ~80 lines.
//
// Notes save explicitly via the Save button; checklist toggles save
// optimistically (each tick re-sends the whole array). Auto-saving
// the notes textarea on every keystroke felt twitchy on a slow DB.

export type ChecklistItem = { id: string; label: string; done: boolean };

export function TableNotesAndChecklist({
  tableId,
  initialNotes,
  initialChecklist,
  canEdit,
}: {
  tableId: string;
  initialNotes: string | null;
  initialChecklist: ChecklistItem[] | null;
  canEdit: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? "");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist ?? []);
  const [newItem, setNewItem] = useState("");
  const [pending, startTransition] = useTransition();

  function onSaveNotes() {
    startTransition(async () => {
      try {
        await updateTableNotes(tableId, notes);
        setSavedNotes(notes);
        notify("success", "Note saved");
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  function persistChecklist(next: ChecklistItem[]) {
    // Optimistic — apply locally, persist in the background. If the
    // action fails we roll back via the catch. Faster than awaiting
    // every tick.
    const prev = checklist;
    setChecklist(next);
    startTransition(async () => {
      try {
        await updateTableChecklist(tableId, next);
      } catch (err) {
        setChecklist(prev);
        notify("error", err instanceof Error ? err.message : "Couldn't save checklist");
      }
    });
  }

  function toggleItem(id: string) {
    persistChecklist(
      checklist.map((it) => (it.id === id ? { ...it, done: !it.done } : it)),
    );
  }

  function removeItem(id: string) {
    persistChecklist(checklist.filter((it) => it.id !== id));
  }

  function addItem() {
    const label = newItem.trim();
    if (!label) return;
    const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    persistChecklist([...checklist, { id, label, done: false }]);
    setNewItem("");
  }

  // Read-only render for non-editors — show only what's filled in.
  if (!canEdit) {
    if (!savedNotes && checklist.length === 0) return null;
    return (
      <div className="px-4 py-3 border-t border-border-soft space-y-3">
        {savedNotes && (
          <div>
            <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
              Notes
            </strong>
            <pre className="whitespace-pre-wrap text-xs text-ink-secondary font-sans">
              {savedNotes}
            </pre>
          </div>
        )}
        {checklist.length > 0 && (
          <div>
            <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
              Day-of checklist
            </strong>
            <ul className="text-xs text-ink-secondary space-y-1">
              {checklist.map((it) => (
                <li
                  key={it.id}
                  className={it.done ? "line-through text-ink-tertiary" : ""}
                >
                  {it.done ? "☑" : "☐"} {it.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t border-border-soft space-y-3">
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Min/max guests, dietary cluster, board-game pairing, position cues…"
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
        />
        {notes !== savedNotes && (
          <div className="flex justify-end gap-2 mt-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNotes(savedNotes)}
              disabled={pending}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onSaveNotes}
              disabled={pending}
            >
              Save
            </Button>
          </div>
        )}
      </div>

      <div>
        <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
          Day-of checklist
        </strong>
        <ul className="space-y-1 mb-2">
          {checklist.map((it) => (
            <li key={it.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={it.done}
                onChange={() => toggleItem(it.id)}
                disabled={pending}
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
              <button
                type="button"
                onClick={() => removeItem(it.id)}
                disabled={pending}
                className="text-[10px] text-ink-tertiary hover:text-danger px-1"
                aria-label={`Remove "${it.label}"`}
                title="Remove"
              >
                ×
              </button>
            </li>
          ))}
          {checklist.length === 0 && (
            <li className="text-xs text-ink-tertiary italic">
              No items yet. Add place cards, menu cards, table number stand…
            </li>
          )}
        </ul>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
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
            onClick={addItem}
            disabled={pending || newItem.trim() === ""}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
