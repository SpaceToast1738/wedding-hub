"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { updateSeatingNotes } from "./actions";

// v1.23.0: plan-level seating notes. Collapsed by default — the
// canvas stays the focus; the notes are one click away. Auto-saves
// on Save (no debounce; the form is small enough that explicit save
// is fine).
export function PlanNotesPanel({
  initial,
  canEdit,
}: {
  initial: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      try {
        await updateSeatingNotes(value);
        notify("success", "Plan notes saved");
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  // Empty + read-only → don't render at all (avoids a useless
  // "(no notes)" line for viewers).
  if (!canEdit && initial === "") return null;

  return (
    <div className="px-6 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-ink-secondary hover:text-ink-primary inline-flex items-center gap-1.5 px-2 py-1 rounded-sm hover:bg-canvas/60 transition-colors"
        aria-expanded={open}
      >
        <span className="font-bold uppercase tracking-wider">
          Plan notes
        </span>
        {!open && initial !== "" && (
          <span className="text-ink-tertiary normal-case font-normal">
            · {initial.split("\n")[0]?.slice(0, 60)}
            {initial.length > 60 ? "…" : ""}
          </span>
        )}
        <span className="text-ink-tertiary">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-2 bg-surface border border-border-soft rounded-md shadow-sm p-3">
          {canEdit ? (
            <>
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={5}
                placeholder="Table-size policy (min 6, max 10), board-game allocation, day-of staffing reminders, layout constraints…"
                className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setValue(initial)}
                  disabled={pending || value === initial}
                >
                  Reset
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onSave}
                  disabled={pending || value === initial}
                >
                  Save
                </Button>
              </div>
            </>
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-ink-secondary font-sans">
              {initial}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
