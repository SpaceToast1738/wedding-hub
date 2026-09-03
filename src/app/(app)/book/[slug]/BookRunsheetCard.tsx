"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { notify } from "@/lib/notify";
import { saveRunsheetCard, type RunsheetSavePayload } from "../actions";
import { runsheetRollups, sortRowsByTime } from "@/lib/book-cards";
import { CardChrome } from "./CardChrome";
import { FieldLabel, Label, newRowId } from "./bookCardUi";

// v2.16.0: RUNSHEET card — time-ordered rows {time, event, owner,
// notes, done} rendered as a vertical schedule. Phone-first: the
// wedding party reads this standing in a corridor, so view mode is a
// tight timeline with a big tick per row (tapping it saves at once —
// no Edit mode needed on the day). Editing rows is the usual single
// bulk save with reconcile, modelled on the SETUP / LODGING cards.
// Times are free text ("12:45", "1:35/1:45", "after speeches"); rows
// keep a manual order with a one-click "sort by time".

type Row = {
  id: string;
  time: string | null;
  event: string;
  owner: string | null;
  notes: string | null;
  done: boolean;
  order: number;
};

type CardData = {
  id: string;
  notes: string | null;
  rows: Row[];
};

type RunsheetCardProps = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  card: CardData;
};

function toPayload(notes: string | null, rows: Row[]): RunsheetSavePayload {
  return {
    notes: notes?.trim() || null,
    rows: rows.map((r) => ({
      id: r.id,
      time: r.time?.trim() || null,
      event: r.event.trim(),
      owner: r.owner?.trim() || null,
      notes: r.notes?.trim() || null,
      done: r.done,
    })),
  };
}

export function BookRunsheetCard({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  isCouple,
  card,
}: RunsheetCardProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => buildDraft(card));
  // v1.98.1 pattern: gated on !editing so a router.refresh mid-edit
  // doesn't wipe the draft.
  useEffect(() => {
    if (!editing) setDraft(buildDraft(card));
  }, [card, editing]);

  function cancel() {
    setDraft(buildDraft(card));
    setEditing(false);
  }

  function save() {
    for (let i = 0; i < draft.rows.length; i++) {
      if (!draft.rows[i]!.event.trim()) {
        notify("error", `Row #${i + 1} needs an event.`);
        return;
      }
    }
    startTransition(async () => {
      const res = await saveRunsheetCard(subsectionId, toPayload(draft.notes, draft.rows));
      if (res.ok) {
        notify("success", "Saved");
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  // View-mode tick: one tap, saved immediately. Sends the whole row
  // list (the save is a bulk reconcile) with just this row's `done`
  // flipped — no draft, no Edit mode.
  function toggleDone(rowId: string) {
    const rows = card.rows.map((r) => (r.id === rowId ? { ...r, done: !r.done } : r));
    startTransition(async () => {
      const res = await saveRunsheetCard(subsectionId, toPayload(card.notes, rows));
      if (!res.ok) notify("error", res.error);
    });
  }

  const r = runsheetRollups({ rows: card.rows });
  const nextUp = card.rows.find((row) => !row.done);

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Runsheet"
    >
      {/* Header strip */}
      <div className="mb-4 flex items-baseline gap-2 flex-wrap">
        <span className="text-base font-semibold text-ink-primary">
          {r.doneCount}/{r.rowCount} done
        </span>
        {r.rowCount > 0 && (
          <span className="text-[11px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-canvas border border-border-soft text-ink-tertiary">
            {r.percentDone}%
          </span>
        )}
        {nextUp && !editing && (
          <span className="text-xs text-ink-secondary">
            Next up:{" "}
            <strong className="text-ink-primary">
              {nextUp.time ? `${nextUp.time} — ` : ""}
              {nextUp.event}
            </strong>
          </span>
        )}
      </div>

      {card.notes && !editing && (
        <p className="text-sm text-ink-secondary whitespace-pre-wrap mb-4">{card.notes}</p>
      )}

      {editing ? (
        <EditBody draft={draft} setDraft={setDraft} pending={pending} />
      ) : (
        <ViewBody card={card} canTick={canEdit} pending={pending} onToggle={toggleDone} />
      )}

      {canEdit && (
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border-soft">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={save} disabled={pending}>
                Save changes
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      )}
    </CardChrome>
  );
}

function ViewBody({
  card,
  canTick,
  pending,
  onToggle,
}: {
  card: CardData;
  canTick: boolean;
  pending: boolean;
  onToggle: (rowId: string) => void;
}) {
  if (card.rows.length === 0) {
    return <p className="text-xs text-ink-tertiary italic">No rows yet — add the schedule in Edit.</p>;
  }
  return (
    <ol className="divide-y divide-border-soft border border-border-soft rounded-md text-sm">
      {card.rows.map((row) => (
        <li
          key={row.id}
          className={`flex items-start gap-3 px-3 py-2.5 ${row.done ? "opacity-60" : ""}`}
        >
          {/* Time column — fixed width so the events line up like a
              printed order of service. */}
          <span
            className={`w-16 flex-shrink-0 font-mono text-xs tabular-nums pt-0.5 ${
              row.time ? "text-moss-700 font-semibold" : "text-ink-tertiary"
            }`}
          >
            {row.time ?? "—"}
          </span>
          <div className="flex-1 min-w-0">
            <div className={`text-ink-primary ${row.done ? "line-through" : ""}`}>{row.event}</div>
            {(row.owner || row.notes) && (
              <div className="text-xs text-ink-secondary mt-0.5 flex flex-wrap gap-x-2">
                {row.owner && (
                  <span className="text-[10px] uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-canvas border border-border-soft text-ink-tertiary">
                    {row.owner}
                  </span>
                )}
                {row.notes && <span className="whitespace-pre-wrap">{row.notes}</span>}
              </div>
            )}
          </div>
          {canTick ? (
            <button
              type="button"
              onClick={() => onToggle(row.id)}
              disabled={pending}
              aria-pressed={row.done}
              aria-label={row.done ? `Mark "${row.event}" not done` : `Mark "${row.event}" done`}
              // Touch floor: the whole day-of use case is thumbs.
              className={`flex-shrink-0 w-10 h-10 -my-1 rounded-md border text-base flex items-center justify-center transition-colors ${
                row.done
                  ? "bg-moss-500 border-moss-500 text-on-moss"
                  : "bg-surface border-border-soft text-ink-tertiary hover:border-moss-500"
              }`}
            >
              {row.done ? "✓" : ""}
            </button>
          ) : (
            row.done && <span className="text-moss-700 text-base flex-shrink-0">✓</span>
          )}
        </li>
      ))}
    </ol>
  );
}

type Draft = {
  notes: string;
  rows: Row[];
};

function buildDraft(card: CardData): Draft {
  return {
    notes: card.notes ?? "",
    rows: card.rows.map((r) => ({ ...r })),
  };
}

function EditBody({
  draft,
  setDraft,
  pending,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  pending: boolean;
}) {
  function patch(p: Partial<Draft>) {
    setDraft({ ...draft, ...p });
  }
  function patchRow(idx: number, p: Partial<Row>) {
    const next = [...draft.rows];
    next[idx] = { ...next[idx]!, ...p };
    setDraft({ ...draft, rows: next });
  }
  function addRow() {
    setDraft({
      ...draft,
      rows: [
        ...draft.rows,
        { id: newRowId(), time: null, event: "", owner: null, notes: null, done: false, order: draft.rows.length },
      ],
    });
  }
  function removeRow(idx: number) {
    setDraft({ ...draft, rows: draft.rows.filter((_, i) => i !== idx) });
  }
  function moveRow(idx: number, delta: -1 | 1) {
    const j = idx + delta;
    if (j < 0 || j >= draft.rows.length) return;
    const next = [...draft.rows];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    setDraft({ ...draft, rows: next });
  }
  function sortByTime() {
    setDraft({ ...draft, rows: sortRowsByTime(draft.rows) });
  }

  return (
    <div className="space-y-4">
      <FieldLabel>
        <Label>Notes (shown above the schedule)</Label>
        <MentionableTextarea
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          disabled={pending}
          rows={2}
          placeholder="e.g. Registrar interviews are in the Garden Room. Josh holds the rings from 1:35."
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
        />
      </FieldLabel>

      <div>
        <div className="flex items-baseline justify-between mb-1.5 gap-2">
          <strong className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
            Rows ({draft.rows.length})
          </strong>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={sortByTime}
              disabled={pending || draft.rows.length < 2}
              title="Reorder rows by their time — rows without a readable time keep their place at the end"
            >
              Sort by time
            </Button>
            <Button variant="ghost" size="sm" onClick={addRow} disabled={pending}>
              + Add row
            </Button>
          </div>
        </div>
        {draft.rows.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">
            Add the schedule one row at a time — time, what happens, who owns it.
          </p>
        ) : (
          <ul className="divide-y divide-border-soft border border-border-soft rounded-md">
            {draft.rows.map((row, idx) => (
              <RowEditRow
                key={row.id}
                row={row}
                isFirst={idx === 0}
                isLast={idx === draft.rows.length - 1}
                pending={pending}
                onChange={(p) => patchRow(idx, p)}
                onRemove={() => removeRow(idx)}
                onMoveUp={() => moveRow(idx, -1)}
                onMoveDown={() => moveRow(idx, 1)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const INPUT =
  "w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500";

function RowEditRow({
  row,
  isFirst,
  isLast,
  pending,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  row: Row;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  onChange: (p: Partial<Row>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <li className="px-3 py-3 bg-canvas/30 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-2">
          <Label>Time</Label>
          <input
            value={row.time ?? ""}
            onChange={(e) => onChange({ time: e.target.value || null })}
            disabled={pending}
            placeholder="12:45"
            className={`${INPUT} font-mono`}
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-7">
          <Label>Event</Label>
          <input
            value={row.event}
            onChange={(e) => onChange({ event: e.target.value })}
            disabled={pending}
            placeholder="e.g. Groomsmen chair sweep"
            className={INPUT}
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-3">
          <Label>Owner</Label>
          <input
            value={row.owner ?? ""}
            onChange={(e) => onChange({ owner: e.target.value || null })}
            disabled={pending}
            placeholder="e.g. Josh"
            className={INPUT}
          />
        </FieldLabel>
      </div>
      <FieldLabel>
        <Label>Notes</Label>
        <input
          value={row.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value || null })}
          disabled={pending}
          placeholder="e.g. wait for the coast-clear signal from Josh"
          className={INPUT}
        />
      </FieldLabel>
      <div className="flex items-center justify-between gap-1 pt-1">
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
          <input
            type="checkbox"
            checked={row.done}
            onChange={(e) => onChange({ done: e.target.checked })}
            disabled={pending}
          />
          Done
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={pending || isFirst}
            className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-1"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={pending || isLast}
            className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-1"
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="text-[10px] text-ink-tertiary hover:text-danger px-1"
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      </div>
    </li>
  );
}
