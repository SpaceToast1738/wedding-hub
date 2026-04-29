"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import {
  addBookShot,
  deleteBookShot,
  toggleBookShotCaptured,
  updateBookShot,
} from "../actions";
import { CardChrome } from "./CardChrome";

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

// v1.26.0: SHOT_LIST card editor. UX ported from the existing
// /book/photography ShotsClient — checkboxes, inline add/edit forms,
// hover-only delete. Same shape as the bespoke photography page so
// users familiar with that surface have zero re-learn cost.

export function BookShotListCard({
  subsectionId,
  slug,
  title,
  shotListId,
  shots,
  visibility,
  canEdit,
  isCouple,
}: {
  subsectionId: string;
  slug: string;
  title: string;
  shotListId: string;
  shots: Shot[];
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const captured = shots.filter((s) => s.captured).length;

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Shot list"
    >
      {shots.length > 0 && (
        <div className="text-[11px] text-ink-tertiary tabular-nums mb-2">
          {captured} / {shots.length} captured
        </div>
      )}
      {shots.length === 0 && !canEdit ? (
        <p className="text-xs text-ink-tertiary italic">No shots yet.</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {shots.map((shot) => (
            <ShotRow key={shot.id} shot={shot} canEdit={canEdit} />
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-3">
          {adding ? (
            <ShotForm
              shotListId={shotListId}
              onClose={() => setAdding(false)}
              submitLabel="Add shot"
            />
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
              + Add shot
            </Button>
          )}
        </div>
      )}
    </CardChrome>
  );
}

function ShotRow({ shot, canEdit }: { shot: Shot; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = await toggleBookShotCaptured(shot.id, !shot.captured);
      if (!res.ok) notify("error", res.error);
    });
  }

  function onDelete() {
    if (!confirm(`Delete shot "${shot.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteBookShot(shot.id);
      if (!res.ok) notify("error", res.error);
    });
  }

  if (editing) {
    return (
      <li className="py-2">
        <ShotForm
          shotId={shot.id}
          initial={shot}
          onClose={() => setEditing(false)}
          submitLabel="Save"
        />
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 py-2 group">
      <input
        type="checkbox"
        checked={shot.captured}
        onChange={toggle}
        disabled={!canEdit || pending}
        className="accent-moss-500 mt-1 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div
          className={[
            "text-sm",
            shot.captured ? "line-through text-ink-tertiary" : "text-ink-primary",
          ].join(" ")}
        >
          {shot.title}
        </div>
        <div className="text-[11px] text-ink-tertiary mt-0.5 flex flex-wrap gap-x-2">
          {shot.withWhom.length > 0 && <span>👥 {shot.withWhom.join(", ")}</span>}
          {shot.location && <span>📍 {shot.location}</span>}
          {shot.notes && <span className="italic">{shot.notes}</span>}
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
            Delete
          </Button>
        </div>
      )}
    </li>
  );
}

function ShotForm({
  shotId,
  shotListId,
  initial,
  onClose,
  submitLabel,
}: {
  shotId?: string;
  shotListId?: string;
  initial?: Shot;
  onClose: () => void;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [withWhom, setWithWhom] = useState(initial?.withWhom.join(", ") ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("title", title);
    fd.set("withWhom", withWhom);
    fd.set("location", location);
    fd.set("notes", notes);
    startTransition(async () => {
      const res = shotId
        ? await updateBookShot(shotId, fd)
        : shotListId
          ? await addBookShot(shotListId, fd)
          : { ok: false as const, error: "No shot list" };
      if (res.ok) onClose();
      else notify("error", res.error);
    });
  }

  return (
    <div className="bg-canvas/40 border border-border-soft rounded-md p-3 space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Shot title (e.g. Couple by altar)"
        maxLength={200}
        disabled={pending}
        className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <div className="grid sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={withWhom}
          onChange={(e) => setWithWhom(e.target.value)}
          placeholder="With whom (comma-separated)"
          disabled={pending}
          className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          maxLength={200}
          disabled={pending}
          className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
      </div>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        maxLength={2000}
        disabled={pending}
        className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={submit}
          disabled={pending || !title.trim()}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
