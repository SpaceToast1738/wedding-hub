"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Users, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  addBookShot,
  deleteBookShot,
  toggleBookShotCaptured,
  updateBookShot,
} from "../actions";
import { shotListRollups } from "@/lib/book-cards";
import { CardChrome } from "./CardChrome";

// v1.26.0: SHOT_LIST card editor.
// v1.38.0 (P7b/B): adds category, estimatedMinutes, and a guest-list
// picker. Shots render grouped by category with a time-budget rollup
// in the card header. The form keeps the inline-add/edit shape — small
// enough that the §10a card-editor View / Edit toggle wasn't worth
// the refactor for this card.
//
// Design-pass fix: this was the one card kind that broke the
// otherwise-consistent interaction model — no card-level Edit toggle
// at all (per-row Edit/Delete + "+ Add shot" were visible any time
// `canEdit` was true), and the per-row controls were hover-gated with
// no mobile fallback. Added a proper Edit/Done toggle in the footer
// matching every other kind, gated the checkbox + per-row + add-shot
// affordances behind it (view mode now shows a read-only captured
// glyph instead of a disabled checkbox, mirroring the WEDDING_PARTY
// matrix's pills-in-view / dropdowns-in-edit pattern), and fixed the
// per-row hover pattern to the mobile-safe
// opacity-100 sm:opacity-0 sm:group-hover:opacity-100
// sm:focus-within:opacity-100 convention. Every field here already
// commits instantly (no drafts), so — same reasoning as the
// WEDDING_PARTY card — the footer button is "Done", not "Cancel/Save".

type GuestOpt = { id: string; name: string };

type Shot = {
  id: string;
  title: string;
  category: string | null;
  estimatedMinutes: number | null;
  withWhom: string[];
  guestIds: string[];
  location: string | null;
  notes: string | null;
  captured: boolean;
  capturedAt: Date | null;
  order: number;
};

export function BookShotListCard({
  subsectionId,
  slug,
  title,
  shotListId,
  shots,
  guests,
  visibility,
  canEdit,
  isCouple,
}: {
  subsectionId: string;
  slug: string;
  title: string;
  shotListId: string;
  shots: Shot[];
  /** Global guest list, surfaced in the per-shot multi-select. */
  guests: GuestOpt[];
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const r = shotListRollups(shots);

  // Group shots by category for rendering. Shots with null/empty
  // category bucket under the empty string and render last.
  const grouped = useMemo(() => {
    const map = new Map<string, Shot[]>();
    for (const s of shots) {
      const k = (s.category ?? "").trim();
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    }
    const entries = [...map.entries()].sort((a, b) => {
      // Empty bucket sorts last.
      if (a[0] === "" && b[0] !== "") return 1;
      if (b[0] === "" && a[0] !== "") return -1;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [shots]);

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Shot list"
      hideHousekeeping={editing}
      actions={
        canEdit ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditing((v) => !v);
              if (editing) setAdding(false);
            }}
          >
            {editing ? "Done" : "Edit"}
          </Button>
        ) : undefined
      }
    >
      {shots.length > 0 && (
        <div className="text-[11px] text-ink-tertiary tabular-nums mb-3 flex items-baseline gap-3 flex-wrap">
          <span>
            {r.capturedCount} / {r.shotCount} captured ({r.percentCaptured}%)
          </span>
          {r.estimatedMinutesTotal != null && (
            <span>
              · est. {formatMinutes(r.estimatedMinutesTotal)}
            </span>
          )}
        </div>
      )}
      {shots.length === 0 && !editing ? (
        <p className="text-xs text-ink-tertiary italic">No shots yet.</p>
      ) : (
        <div className="space-y-3">
          {grouped.map(([category, groupShots]) => {
            const groupCaptured = groupShots.filter((s) => s.captured).length;
            const groupMins = groupShots.reduce(
              (sum, s) => sum + (s.estimatedMinutes ?? 0),
              0,
            );
            return (
              <section key={category || "__none__"}>
                <header className="flex items-baseline gap-2 mb-1.5">
                  <strong className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
                    {category || "Uncategorised"}
                  </strong>
                  <span className="text-[10px] text-ink-tertiary tabular-nums">
                    {groupCaptured} / {groupShots.length}
                    {groupMins > 0 && ` · ${formatMinutes(groupMins)}`}
                  </span>
                </header>
                <ul className="divide-y divide-border-soft border border-border-soft rounded-md">
                  {groupShots.map((shot) => (
                    <ShotRow key={shot.id} shot={shot} guests={guests} cardEditing={editing} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {editing && (
        <div className="mt-3">
          {adding ? (
            <ShotForm
              shotListId={shotListId}
              guests={guests}
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

function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return mins === 0 ? `${h}h` : `${h}h ${mins}m`;
}

function ShotRow({
  shot,
  guests,
  cardEditing,
}: {
  shot: Shot;
  guests: GuestOpt[];
  /** Whether the parent card's Edit/Done toggle is on. Named
   *  distinctly from the row's own `editing` state below (whether
   *  THIS row is showing its inline edit form) to avoid confusing the
   *  two — the card-level toggle gates whether editing is possible at
   *  all, the row-level state is which row (if any) is mid-edit. */
  cardEditing: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  // v2.5.2 (review fix): the card's Edit/Done toggle already resets
  // its own "adding a new shot" state on exit, but had no equivalent
  // for a row's own edit state — clicking Done could leave this row's
  // full ShotForm open even though the card had visually returned to
  // read-only view mode.
  useEffect(() => {
    if (!cardEditing) setEditing(false);
  }, [cardEditing]);

  const guestById = new Map(guests.map((g) => [g.id, g]));
  const linkedGuestNames = shot.guestIds
    .map((id) => guestById.get(id)?.name)
    .filter((n): n is string => Boolean(n));

  function toggle() {
    startTransition(async () => {
      const res = await toggleBookShotCaptured(shot.id, !shot.captured);
      if (!res.ok) notify("error", res.error);
    });
  }

  async function onDelete() {
    if (!(await confirm({ title: `Delete shot "${shot.title}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      const res = await deleteBookShot(shot.id);
      if (!res.ok) notify("error", res.error);
    });
  }

  if (editing) {
    return (
      <li className="px-3 py-3 bg-canvas/30">
        <ShotForm
          shotId={shot.id}
          initial={shot}
          guests={guests}
          onClose={() => setEditing(false)}
          submitLabel="Save"
        />
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 px-3 py-2 group">
      {/* Design-pass fix: mutating `captured` used to stay live even
          in view mode (a disabled-when-!canEdit checkbox for non-
          editors, but always interactive for editors regardless of
          the card's own Edit toggle). Matches the WEDDING_PARTY
          matrix's pills-in-view / interactive-in-edit split now —
          view mode shows a static glyph, edit mode a real checkbox. */}
      {cardEditing ? (
        <input
          type="checkbox"
          checked={shot.captured}
          onChange={toggle}
          disabled={pending}
          className="accent-moss-500 mt-1 flex-shrink-0"
        />
      ) : (
        <span
          aria-hidden
          className={[
            "mt-1 flex-shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center text-[10px] leading-none",
            shot.captured
              ? "bg-moss-50 border-moss-300 text-moss-700"
              : "border-border-soft text-transparent",
          ].join(" ")}
        >
          ✓
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className={[
              "text-sm",
              shot.captured ? "line-through text-ink-tertiary" : "text-ink-primary",
            ].join(" ")}
          >
            {shot.title}
          </span>
          {shot.estimatedMinutes != null && shot.estimatedMinutes > 0 && (
            <span className="text-[10px] uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-canvas border border-border-soft text-ink-tertiary">
              {formatMinutes(shot.estimatedMinutes)}
            </span>
          )}
        </div>
        {/* Design-pass fix: this metadata row is real content
            (guests / location / notes), not a label — bumped from
            11px ink-tertiary to 12px ink-secondary. */}
        <div className="text-xs text-ink-secondary mt-0.5 flex flex-wrap gap-x-2">
          {linkedGuestNames.length > 0 && (
            <span title={`Linked guests: ${linkedGuestNames.join(", ")}`}>
              <Users aria-hidden className="w-3.5 h-3.5 inline-block align-text-bottom" /> {linkedGuestNames.join(", ")}
            </span>
          )}
          {shot.withWhom.length > 0 && (
            <span title={`Free-text names: ${shot.withWhom.join(", ")}`}>
              + {shot.withWhom.join(", ")}
            </span>
          )}
          {shot.location && (
            <span>
              <MapPin aria-hidden className="w-3.5 h-3.5 inline-block align-text-bottom" /> {shot.location}
            </span>
          )}
          {shot.notes && <span className="italic">{shot.notes}</span>}
        </div>
      </div>
      {cardEditing && (
        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity flex-shrink-0">
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
  guests,
  onClose,
  submitLabel,
}: {
  shotId?: string;
  shotListId?: string;
  initial?: Shot;
  guests: GuestOpt[];
  onClose: () => void;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    initial?.estimatedMinutes != null ? String(initial.estimatedMinutes) : "",
  );
  const [withWhom, setWithWhom] = useState(initial?.withWhom.join(", ") ?? "");
  const [guestIds, setGuestIds] = useState<string[]>(initial?.guestIds ?? []);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, startTransition] = useTransition();

  function toggleGuest(id: string) {
    setGuestIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  function submit() {
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("title", title);
    fd.set("category", category);
    fd.set("estimatedMinutes", estimatedMinutes);
    fd.set("withWhom", withWhom);
    fd.set("location", location);
    fd.set("notes", notes);
    for (const id of guestIds) fd.append("guestIds", id);
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
      <div className="grid sm:grid-cols-3 gap-2">
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (e.g. Pre-ceremony)"
          maxLength={60}
          disabled={pending}
          className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
        <input
          type="number"
          value={estimatedMinutes}
          onChange={(e) => setEstimatedMinutes(e.target.value)}
          placeholder="Est. minutes"
          min={0}
          max={600}
          disabled={pending}
          className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500 tabular-nums"
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
      {/* Linked guests — multi-select picker */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ink-secondary font-bold mb-1">
          Linked guests ({guestIds.length})
        </div>
        {guests.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">No guests yet — add them on /guests first.</p>
        ) : (
          <ul className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 border border-border-soft rounded-sm bg-surface">
            {guests.map((g) => {
              const on = guestIds.includes(g.id);
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => toggleGuest(g.id)}
                    disabled={pending}
                    className={[
                      "text-[11px] rounded-full px-2 py-0.5 border",
                      on
                        ? "bg-moss-50 border-moss-300 text-moss-700"
                        : "bg-canvas border-border-soft text-ink-tertiary hover:text-ink-primary",
                    ].join(" ")}
                  >
                    {g.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <input
        type="text"
        value={withWhom}
        onChange={(e) => setWithWhom(e.target.value)}
        placeholder="Other names (free-text, comma-separated — e.g. vendor, partner-of-cousin)"
        disabled={pending}
        className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
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

