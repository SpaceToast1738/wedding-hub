"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createShot,
  deleteShot,
  moveShot,
  toggleShotCaptured,
  updateShot,
} from "./actions";

type Shot = {
  id: string;
  title: string;
  withWhom: string[];
  location: string | null;
  notes: string | null;
  captured: boolean;
  capturedAt: Date | null;
  order: number;
};

export function ShotsClient({
  shots,
  canEdit,
}: {
  shots: Shot[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const captured = shots.filter((s) => s.captured).length;
  const total = shots.length;

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm overflow-hidden print-break-avoid">
      <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-ink-primary">Shot list</h2>
          <div className="text-[11px] text-ink-tertiary">
            {total === 0
              ? "No shots yet — add the must-have combinations."
              : `${captured} of ${total} captured`}
          </div>
        </div>
        {canEdit && !adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            + Add shot
          </Button>
        )}
      </header>

      {adding && (
        <div className="bg-moss-50/40 border-b border-border-soft">
          <ShotForm
            mode="create"
            onDone={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {shots.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-tertiary italic text-center">
          No shots yet.
        </p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {shots.map((shot, i) => (
            <ShotRow
              key={shot.id}
              shot={shot}
              canEdit={canEdit}
              isFirst={i === 0}
              isLast={i === shots.length - 1}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ShotRow({
  shot,
  canEdit,
  isFirst,
  isLast,
}: {
  shot: Shot;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleCaptured() {
    startTransition(async () => {
      await toggleShotCaptured(shot.id, !shot.captured);
    });
  }

  function onMove(delta: -1 | 1) {
    startTransition(async () => {
      await moveShot(shot.id, delta);
    });
  }

  function onDelete() {
    if (!confirm(`Delete shot "${shot.title}"?`)) return;
    startTransition(async () => {
      await deleteShot(shot.id);
    });
  }

  if (editing) {
    return (
      <li className="bg-moss-50/40">
        <ShotForm
          mode="update"
          shot={shot}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="px-4 py-3 grid grid-cols-[20px_1fr_auto] gap-3 items-start group">
      <input
        type="checkbox"
        checked={shot.captured}
        onChange={toggleCaptured}
        disabled={!canEdit || pending}
        className="mt-1 accent-moss-500 cursor-pointer disabled:cursor-not-allowed"
        title={shot.captured ? "Mark as not yet captured" : "Mark as captured"}
      />
      <div className="min-w-0">
        <div
          className={[
            "text-sm",
            shot.captured ? "text-ink-tertiary line-through" : "text-ink-primary",
          ].join(" ")}
        >
          {shot.title}
        </div>
        {shot.withWhom.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1">
            {shot.withWhom.map((name) => (
              <span
                key={name}
                className="text-[10px] text-moss-700 bg-moss-50 border border-moss-100 px-1.5 py-px rounded"
              >
                {name}
              </span>
            ))}
          </div>
        )}
        {(shot.location || shot.notes) && (
          <div className="text-[11px] text-ink-tertiary mt-1 italic space-y-0.5">
            {shot.location && <div>📍 {shot.location}</div>}
            {shot.notes && <div>{shot.notes}</div>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span
          className={[
            "text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1",
            shot.captured
              ? "text-moss-700 bg-moss-50 border border-moss-100"
              : "text-ink-tertiary bg-canvas border border-border-soft",
          ].join(" ")}
        >
          {shot.captured ? "Captured" : "Planned"}
        </span>
        {canEdit && (
          <div className="no-print flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={pending || isFirst}
              title="Move up"
              className="text-[10px] px-1 text-ink-tertiary hover:text-ink-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={pending || isLast}
              title="Move down"
              className="text-[10px] px-1 text-ink-tertiary hover:text-ink-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↓
            </button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
              ×
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function ShotForm({
  mode,
  shot,
  onDone,
  onCancel,
}: {
  mode: "create" | "update";
  shot?: Shot;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function action(fd: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "create") await createShot(fd);
        else if (shot) await updateShot(shot.id, fd);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form action={action} className="px-4 py-3 space-y-2.5">
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Shot title
        </label>
        <Input
          name="title"
          required
          defaultValue={shot?.title ?? ""}
          placeholder="e.g. Couple portraits"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
            With whom
          </label>
          <Input
            name="withWhom"
            defaultValue={shot?.withWhom.join(", ") ?? ""}
            placeholder="Comma-separated names"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
            Location
          </label>
          <Input
            name="location"
            defaultValue={shot?.location ?? ""}
            placeholder="e.g. Garden, Library"
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Notes
        </label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={shot?.notes ?? ""}
          placeholder="Anything the photographer should know"
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add" : "Save"}
        </Button>
      </div>
    </form>
  );
}
