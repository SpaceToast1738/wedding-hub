"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  attachFileToLegalItem,
  detachFileFromLegalItem,
  saveLegalCard,
  type LegalSavePayload,
} from "../actions";
import { legalRollups } from "@/lib/book-cards";
import { CardChrome } from "./CardChrome";
import { FieldLabel, Label, newRowId } from "./bookCardUi";

// v1.34.0: LEGAL card editor — document checklist with deadlines +
// optional file attachments. View / Edit toggle (per §10a). Header
// shows regulator, due date with days-remaining countdown, % obtained,
// expiry-before-wedding count. Items table has obtained checkbox +
// optional file picker (uses the existing /api/files/[id] download
// flow).

const REQUIRED_FOR_OPTIONS = ["Bride", "Groom", "Both", "Witness", "Officiant", "Other"];

type Item = {
  id: string;
  label: string;
  requiredFor: string | null;
  obtained: boolean;
  obtainedAt: Date | null;
  expiresAt: Date | null;
  fileId: string | null;
  file: { id: string; name: string } | null;
  notes: string | null;
  order: number;
};

type CardData = {
  id: string;
  regulator: string | null;
  regulatorContact: string | null;
  dueByDate: Date | null;
  notes: string | null;
  items: Item[];
};

type LegalCardProps = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  card: CardData;
  /** Wedding date for the expiry-before-wedding flag. Null if not set. */
  weddingDate: Date | null;
  /** All Files in the system, surfaced in the per-item file picker. */
  files: Array<{ id: string; name: string; mimeType: string }>;
};

function isoDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function BookLegalCard({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  isCouple,
  card,
  weddingDate,
  files,
}: LegalCardProps) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => buildDraft(card));
  // v1.98.1: gated on !editing — see BookOutfitCard for the bug
  // context (router.refresh during edit mode wipes the draft).
  useEffect(() => {
    if (!editing) setDraft(buildDraft(card));
  }, [card, editing]);

  function cancel() {
    setDraft(buildDraft(card));
    setEditing(false);
  }

  function save() {
    for (let i = 0; i < draft.items.length; i++) {
      if (!draft.items[i]!.label.trim()) {
        notify("error", `Item #${i + 1} needs a label.`);
        return;
      }
    }
    const payload: LegalSavePayload = {
      regulator: draft.regulator || null,
      regulatorContact: draft.regulatorContact || null,
      dueByDate: draft.dueByDate || null,
      notes: draft.notes || null,
      items: draft.items.map((i) => ({
        id: i.id,
        label: i.label.trim(),
        requiredFor: i.requiredFor || null,
        obtained: i.obtained,
        obtainedAt: isoDate(i.obtainedAt) || null,
        expiresAt: isoDate(i.expiresAt) || null,
        notes: i.notes || null,
      })),
    };
    startTransition(async () => {
      const res = await saveLegalCard(subsectionId, payload);
      if (res.ok) {
        notify("success", "Saved");
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  // Rollups computed from the saved card (file picker still works
  // mid-edit even when draft items haven't been saved).
  const r = legalRollups(
    {
      dueByDate: card.dueByDate,
      items: card.items.map((i) => ({ obtained: i.obtained, expiresAt: i.expiresAt })),
    },
    weddingDate,
  );

  function attach(itemId: string, fileId: string) {
    startTransition(async () => {
      const res = await attachFileToLegalItem(itemId, fileId);
      if (res.ok) notify("success", "File attached");
      else notify("error", res.error);
    });
  }
  async function detach(itemId: string) {
    if (!(await confirm({
      title: "Detach the file from this item?",
      body: "The file stays on /files.",
      confirmLabel: "Detach",
    }))) return;
    startTransition(async () => {
      const res = await detachFileFromLegalItem(itemId);
      if (res.ok) notify("success", "File detached");
      else notify("error", res.error);
    });
  }

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Legal"
    >
      {/* Banners */}
      {r.isOverdue && (
        <div className="mb-4 px-3 py-2 bg-danger/10 border border-danger/30 rounded-md text-xs text-danger flex items-baseline gap-2">
          <span aria-hidden>⚠</span>
          <span>
            Card deadline passed — {Math.abs(r.daysToDue ?? 0)} day{Math.abs(r.daysToDue ?? 0) === 1 ? "" : "s"} ago, and not every item is obtained.
          </span>
        </div>
      )}
      {r.expiringBeforeWedding > 0 && (
        <div className="mb-4 px-3 py-2 bg-marigold-100 border border-marigold-700/30 rounded-md text-xs text-marigold-700 flex items-baseline gap-2">
          <span aria-hidden>⚠</span>
          <span>
            {r.expiringBeforeWedding} item{r.expiringBeforeWedding === 1 ? "" : "s"} expire before the wedding.
          </span>
        </div>
      )}

      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat label="Regulator" value={card.regulator ?? "—"} />
        <Stat
          label="Due"
          value={
            card.dueByDate
              ? `${card.dueByDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${
                  r.daysToDue !== null
                    ? ` (${r.daysToDue >= 0 ? `${r.daysToDue}d` : `${-r.daysToDue}d ago`})`
                    : ""
                }`
              : "—"
          }
        />
        <Stat
          label="Obtained"
          value={r.itemCount === 0 ? "—" : `${r.obtainedCount} / ${r.itemCount} (${r.percentObtained}%)`}
        />
        <Stat
          label="Expiring"
          value={r.expiringBeforeWedding === 0 ? "0" : `${r.expiringBeforeWedding} pre-wed`}
        />
      </div>

      {editing ? (
        <EditBody draft={draft} setDraft={setDraft} pending={pending} />
      ) : (
        <ViewBody card={card} onAttach={attach} onDetach={detach} canEdit={canEdit} pending={pending} files={files} />
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

// ── View body ────────────────────────────────────────────────────

function ViewBody({
  card,
  onAttach,
  onDetach,
  canEdit,
  pending,
  files,
}: {
  card: CardData;
  onAttach: (itemId: string, fileId: string) => void;
  onDetach: (itemId: string) => void;
  canEdit: boolean;
  pending: boolean;
  files: Array<{ id: string; name: string; mimeType: string }>;
}) {
  if (card.items.length === 0) {
    return <p className="text-xs text-ink-tertiary italic">No items yet.</p>;
  }
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border-soft border border-border-soft rounded-md">
        {card.items.map((item) => (
          <li key={item.id} className="px-3 py-2 flex items-baseline gap-2 text-sm">
            <span
              aria-label={item.obtained ? "obtained" : "not obtained"}
              className={item.obtained ? "text-moss-700" : "text-ink-tertiary/40"}
            >
              {item.obtained ? "●" : "○"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={item.obtained ? "text-ink-secondary line-through" : "text-ink-primary"}>
                  {item.label}
                </span>
                {item.requiredFor && (
                  <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-canvas border border-border-soft text-ink-tertiary">
                    {item.requiredFor}
                  </span>
                )}
                {item.expiresAt && (
                  <span className="text-[10px] text-ink-tertiary">
                    expires {item.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
              {item.notes && <p className="text-xs text-ink-tertiary mt-0.5">{item.notes}</p>}
            </div>
            <FileSlot
              item={item}
              files={files}
              canEdit={canEdit}
              pending={pending}
              onAttach={(fileId) => onAttach(item.id, fileId)}
              onDetach={() => onDetach(item.id)}
            />
          </li>
        ))}
      </ul>
      {card.notes && (
        <div className="pt-2">
          <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
            Notes
          </strong>
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">{card.notes}</p>
        </div>
      )}
    </div>
  );
}

function FileSlot({
  item,
  files,
  canEdit,
  pending,
  onAttach,
  onDetach,
}: {
  item: Item;
  files: Array<{ id: string; name: string; mimeType: string }>;
  canEdit: boolean;
  pending: boolean;
  onAttach: (fileId: string) => void;
  onDetach: () => void;
}) {
  const [picking, setPicking] = useState(false);
  if (item.file) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] flex-shrink-0">
        <Link
          href={`/api/files/${item.file.id}`}
          className="text-info hover:underline truncate max-w-[160px]"
          title={item.file.name}
        >
          📎 {item.file.name}
        </Link>
        {canEdit && (
          <button
            type="button"
            onClick={onDetach}
            disabled={pending}
            className="text-ink-tertiary hover:text-danger px-1"
            aria-label="Detach file"
          >
            ×
          </button>
        )}
      </div>
    );
  }
  if (!canEdit) {
    return <span className="text-[11px] text-ink-tertiary italic flex-shrink-0">No file</span>;
  }
  if (!picking) {
    return (
      <button
        type="button"
        onClick={() => setPicking(true)}
        disabled={pending}
        className="text-[11px] text-info hover:underline flex-shrink-0"
      >
        + Attach
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <select
        defaultValue=""
        disabled={pending}
        onChange={(e) => {
          if (e.target.value) {
            onAttach(e.target.value);
            setPicking(false);
          }
        }}
        className="text-[11px] bg-surface border border-border-soft rounded-sm px-1.5 py-0.5 text-ink-primary outline-none focus:border-moss-500 max-w-[180px]"
      >
        <option value="">— choose a file —</option>
        {files.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setPicking(false)}
        disabled={pending}
        className="text-[10px] text-ink-tertiary hover:text-ink-primary px-1"
      >
        cancel
      </button>
    </div>
  );
}

// ── Edit body ────────────────────────────────────────────────────

type Draft = {
  regulator: string;
  regulatorContact: string;
  dueByDate: string;
  notes: string;
  items: Item[];
};

function buildDraft(card: CardData): Draft {
  return {
    regulator: card.regulator ?? "",
    regulatorContact: card.regulatorContact ?? "",
    dueByDate: isoDate(card.dueByDate),
    notes: card.notes ?? "",
    items: card.items.map((i) => ({ ...i })),
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
  function patchItem(idx: number, p: Partial<Item>) {
    const next = [...draft.items];
    next[idx] = { ...next[idx]!, ...p };
    setDraft({ ...draft, items: next });
  }
  function addItem() {
    setDraft({
      ...draft,
      items: [
        ...draft.items,
        {
          id: newRowId(),
          label: "",
          requiredFor: null,
          obtained: false,
          obtainedAt: null,
          expiresAt: null,
          fileId: null,
          file: null,
          notes: null,
          order: draft.items.length,
        },
      ],
    });
  }
  function removeItem(idx: number) {
    setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) });
  }
  function moveItem(idx: number, delta: -1 | 1) {
    const j = idx + delta;
    if (j < 0 || j >= draft.items.length) return;
    const next = [...draft.items];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    setDraft({ ...draft, items: next });
  }

  return (
    <div className="space-y-4">
      {/* Header — 2 grid rows per §10a */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-6">
          <Label>Regulator</Label>
          <input
            value={draft.regulator}
            onChange={(e) => patch({ regulator: e.target.value })}
            disabled={pending}
            placeholder="e.g. Warwickshire Registrar"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-6">
          <Label>Contact</Label>
          <input
            value={draft.regulatorContact}
            onChange={(e) => patch({ regulatorContact: e.target.value })}
            disabled={pending}
            placeholder="phone, email, address"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-4">
          <Label>Due by</Label>
          <input
            type="date"
            value={draft.dueByDate}
            onChange={(e) => patch({ dueByDate: e.target.value })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
      </div>

      {/* Items */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <strong className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
            Documents ({draft.items.length})
          </strong>
          <Button variant="ghost" size="sm" onClick={addItem} disabled={pending}>
            + Add document
          </Button>
        </div>
        {draft.items.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">
            Add the documents you need (Notice of Marriage, ID, marriage certificate, etc.).
          </p>
        ) : (
          <ul className="divide-y divide-border-soft border border-border-soft rounded-md">
            {draft.items.map((item, idx) => (
              <ItemEditRow
                key={item.id}
                item={item}
                isFirst={idx === 0}
                isLast={idx === draft.items.length - 1}
                pending={pending}
                onChange={(p) => patchItem(idx, p)}
                onRemove={() => removeItem(idx)}
                onMoveUp={() => moveItem(idx, -1)}
                onMoveDown={() => moveItem(idx, 1)}
              />
            ))}
          </ul>
        )}
      </div>

      <FieldLabel>
        <Label>Notes</Label>
        <MentionableTextarea
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          disabled={pending}
          rows={3}
          placeholder="Anything the registrar / witnesses should know."
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
        />
      </FieldLabel>
    </div>
  );
}

function ItemEditRow({
  item,
  isFirst,
  isLast,
  pending,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: Item;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  onChange: (p: Partial<Item>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <li className="px-3 py-3 bg-canvas/30 space-y-2">
      {/* Row 1 — what + who: label | required for */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-9">
          <Label>Document</Label>
          <input
            value={item.label}
            onChange={(e) => onChange({ label: e.target.value })}
            disabled={pending}
            placeholder="e.g. Notice of Marriage — Jamie"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-3">
          <Label>Required for</Label>
          <select
            value={item.requiredFor ?? ""}
            onChange={(e) => onChange({ requiredFor: e.target.value || null })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          >
            <option value="">—</option>
            {REQUIRED_FOR_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </FieldLabel>
      </div>
      {/* Row 2 — when: obtained-at | expires-at */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-6">
          <Label>Obtained on</Label>
          <input
            type="date"
            value={isoDate(item.obtainedAt)}
            onChange={(e) =>
              onChange({ obtainedAt: e.target.value ? new Date(e.target.value) : null })
            }
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-6">
          <Label>Expires on</Label>
          <input
            type="date"
            value={isoDate(item.expiresAt)}
            onChange={(e) =>
              onChange({ expiresAt: e.target.value ? new Date(e.target.value) : null })
            }
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
      </div>
      {/* Row 3 — flags + reorder */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={item.obtained}
            onChange={(e) => onChange({ obtained: e.target.checked })}
            disabled={pending}
          />
          <span className="text-ink-secondary">Obtained</span>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas/40 border border-border-soft rounded-md px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
        {label}
      </div>
      <div className="text-sm text-ink-primary tabular-nums truncate font-medium">
        {value || "—"}
      </div>
    </div>
  );
}
