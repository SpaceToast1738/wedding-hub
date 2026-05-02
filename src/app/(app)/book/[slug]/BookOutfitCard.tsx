"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ImageGallery } from "@/components/ui/ImageGallery";
import {
  attachFileToOutfitCard,
  detachFileFromOutfitCard,
  uploadAndAttachOutfitFile,
  saveOutfitCard,
  type OutfitSavePayload,
} from "../actions";
import { outfitRollups } from "@/lib/book-cards";
import { CardChrome } from "./CardChrome";
import {
  FieldLabel,
  Label,
  formatGBPFromPence,
  newRowId,
  penceToPoundsString,
  poundsStringToPence,
} from "./bookCardUi";

// v1.35.0: OUTFIT card rewrite — one card per wedding-party member.
// Card-level fields hold person + fitting timeline + cost; items
// describe per-item composition (dress / shoes / etc.). View / Edit
// flow per §10a. File attach via attachFileToOutfitCard (kept
// separate from saveOutfitCard so a single file pick doesn't
// re-save the whole card).

const ROLE_OPTIONS = [
  "Bride",
  "Groom",
  "Best Man",
  "Maid of Honour",
  "Bridesmaid",
  "Groomsman",
  "Flower Girl",
  "Page Boy",
  "Officiant",
  "Other",
];

const STATUS_OPTIONS = ["Designed", "Ordered", "Fitted", "Collected"];

const STATUS_TONE: Record<string, string> = {
  Designed: "bg-canvas border-border-soft text-ink-secondary",
  Ordered: "bg-info/10 border-info/30 text-info",
  Fitted: "bg-marigold-100 border-marigold-700/30 text-marigold-700",
  Collected: "bg-moss-50 border-moss-300 text-moss-700",
};

const PAID_BY_OPTIONS = ["Self", "Couple", "Parents", "Other"];

type Item = {
  id: string;
  itemLabel: string;
  description: string | null;
  supplier: string | null;
  status: string | null;
  notes: string | null;
  order: number;
};

type CardData = {
  id: string;
  personName: string | null;
  role: string | null;
  fittingDate: Date | null;
  alterationsDueBy: Date | null;
  pickupDate: Date | null;
  costPence: number | null;
  paidBy: string | null;
  paid: boolean;
  notes: string | null;
  fileIds: string[];
  items: Item[];
};

type OutfitCardEditorProps = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  card: CardData;
  /** All Files in the system, surfaced in the card-level photos picker. */
  files: Array<{ id: string; name: string; mimeType: string }>;
};

function isoDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function BookOutfitCardEditor({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  isCouple,
  card,
  files,
}: OutfitCardEditorProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const confirm = useConfirm();
  const [draft, setDraft] = useState(() => buildDraft(card));
  useEffect(() => {
    setDraft(buildDraft(card));
  }, [card]);

  function cancel() {
    setDraft(buildDraft(card));
    setEditing(false);
  }

  function save() {
    for (let i = 0; i < draft.items.length; i++) {
      if (!draft.items[i]!.itemLabel.trim()) {
        notify("error", `Item #${i + 1} needs a label.`);
        return;
      }
    }
    const payload: OutfitSavePayload = {
      personName: draft.personName || null,
      role: draft.role || null,
      fittingDate: draft.fittingDate || null,
      alterationsDueBy: draft.alterationsDueBy || null,
      pickupDate: draft.pickupDate || null,
      costPence: draft.costPence,
      paidBy: draft.paidBy || null,
      paid: draft.paid,
      fileIds: card.fileIds, // file picker is on view-mode only; draft mirrors saved card
      notes: draft.notes || null,
      items: draft.items.map((i) => ({
        id: i.id,
        itemLabel: i.itemLabel.trim(),
        description: i.description?.trim() || null,
        supplier: i.supplier?.trim() || null,
        status: i.status || null,
        notes: i.notes?.trim() || null,
      })),
    };
    startTransition(async () => {
      const res = await saveOutfitCard(subsectionId, payload);
      if (res.ok) {
        notify("success", "Saved");
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  const r = outfitRollups({
    fittingDate: card.fittingDate,
    alterationsDueBy: card.alterationsDueBy,
    pickupDate: card.pickupDate,
    items: card.items.map((i) => ({ status: i.status })),
  });

  function attach(fileId: string) {
    startTransition(async () => {
      const res = await attachFileToOutfitCard(subsectionId, fileId);
      if (res.ok) notify("success", "Photo attached");
      else notify("error", res.error);
    });
  }
  async function detach(fileId: string) {
    if (!(await confirm({
      title: "Detach this photo from the card?",
      body: "The file stays on /files.",
      confirmLabel: "Detach",
    }))) return;
    startTransition(async () => {
      const res = await detachFileFromOutfitCard(subsectionId, fileId);
      if (res.ok) notify("success", "Photo detached");
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
      kindBadge="Outfit"
    >
      {/* Person header */}
      <div className="mb-4 flex items-baseline gap-2 flex-wrap">
        <span className="text-base font-semibold text-ink-primary">
          {card.personName || <span className="text-ink-tertiary italic">No name set</span>}
        </span>
        {card.role && (
          <span className="text-[11px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-canvas border border-border-soft text-ink-tertiary">
            {card.role}
          </span>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat
          label={r.nextMilestone ? r.nextMilestone.label : "Next milestone"}
          value={
            r.nextMilestone
              ? `${shortDate(r.nextMilestone.date)} (${
                  r.daysToNext != null
                    ? r.daysToNext >= 0
                      ? `${r.daysToNext}d`
                      : `${-r.daysToNext}d ago`
                    : "—"
                })`
              : "—"
          }
        />
        <Stat label="Cost" value={formatGBPFromPence(card.costPence)} />
        <Stat
          label="Paid"
          value={
            card.paid
              ? card.paidBy
                ? `Yes · ${card.paidBy}`
                : "Yes"
              : card.paidBy
                ? `No · ${card.paidBy}`
                : "No"
          }
        />
        <Stat
          label="Items"
          value={r.itemCount === 0 ? "—" : `${r.collectedCount} / ${r.itemCount} collected`}
        />
      </div>

      {/* Fitting timeline */}
      <div className="mb-4 flex items-center gap-1 text-[11px] flex-wrap">
        <TimelineStep
          label="Fitting"
          date={card.fittingDate}
          isNext={r.nextMilestone?.label === "Fitting"}
        />
        <span className="text-ink-tertiary/60">→</span>
        <TimelineStep
          label="Alterations"
          date={card.alterationsDueBy}
          isNext={r.nextMilestone?.label === "Alterations"}
        />
        <span className="text-ink-tertiary/60">→</span>
        <TimelineStep
          label="Pickup"
          date={card.pickupDate}
          isNext={r.nextMilestone?.label === "Pickup"}
        />
      </div>

      {editing ? (
        <EditBody draft={draft} setDraft={setDraft} pending={pending} />
      ) : (
        <ViewBody card={card} subsectionId={subsectionId} files={files} canEdit={canEdit} pending={pending} onAttach={attach} onDetach={detach} />
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

// ── Helpers ──────────────────────────────────────────────────────

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

function TimelineStep({
  label,
  date,
  isNext,
}: {
  label: string;
  date: Date | null;
  isNext: boolean;
}) {
  if (!date) {
    return (
      <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-canvas border border-dashed border-border-soft text-ink-tertiary">
        {label} —
      </span>
    );
  }
  return (
    <span
      className={[
        "text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border",
        isNext
          ? "bg-moss-50 border-moss-300 text-moss-700 font-semibold"
          : "bg-canvas border-border-soft text-ink-tertiary",
      ].join(" ")}
    >
      {label} · {shortDate(date)}
    </span>
  );
}

// ── View body ────────────────────────────────────────────────────

function ViewBody({
  card,
  subsectionId,
  files,
  canEdit,
  pending,
  onAttach,
  onDetach,
}: {
  card: CardData;
  /** v1.63.0: needed for the upload-and-attach action. */
  subsectionId: string;
  files: Array<{ id: string; name: string; mimeType: string }>;
  canEdit: boolean;
  pending: boolean;
  onAttach: (fileId: string) => void;
  onDetach: (fileId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Items */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <strong className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
            Items ({card.items.length})
          </strong>
        </div>
        {card.items.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">No items yet.</p>
        ) : (
          <ul className="divide-y divide-border-soft border border-border-soft rounded-md text-sm">
            {card.items.map((item) => (
              <li key={item.id} className="px-3 py-2 flex items-baseline gap-2">
                <span className="font-medium text-ink-primary">{item.itemLabel}</span>
                {item.description && (
                  <span className="text-xs text-ink-secondary truncate">{item.description}</span>
                )}
                {item.supplier && (
                  <span className="text-[10px] text-ink-tertiary"> · {item.supplier}</span>
                )}
                <span className="ml-auto flex-shrink-0">
                  {item.status ? (
                    <span
                      className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border ${STATUS_TONE[item.status] ?? STATUS_TONE.Designed}`}
                    >
                      {item.status}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Photos — v1.63.0: replaced the bespoke chip rendering with
          the shared <ImageGallery> component. Now actually shows the
          photos as photos (thumbnails) instead of "📎 dress-fitting.jpg"
          text links. + Upload button uploads-and-attaches in one
          step from a phone's camera roll. */}
      <div>
        <strong className="block text-[11px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
          Photos ({card.fileIds.length})
        </strong>
        <ImageGallery
          fileIds={card.fileIds}
          files={files}
          canEdit={canEdit}
          pending={pending}
          onUpload={async (file) => {
            const fd = new FormData();
            fd.set("file", file);
            const res = await uploadAndAttachOutfitFile(subsectionId, fd);
            if (res.ok) notify("success", "Photo uploaded");
            else notify("error", res.error);
          }}
          onAttach={onAttach}
          onDetach={onDetach}
        />
      </div>

      {card.notes && (
        <div>
          <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
            Notes
          </strong>
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">{card.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Edit body ────────────────────────────────────────────────────

type Draft = {
  personName: string;
  role: string;
  fittingDate: string;
  alterationsDueBy: string;
  pickupDate: string;
  costPence: number | null;
  paidBy: string;
  paid: boolean;
  notes: string;
  items: Item[];
};

function buildDraft(card: CardData): Draft {
  return {
    personName: card.personName ?? "",
    role: card.role ?? "",
    fittingDate: isoDate(card.fittingDate),
    alterationsDueBy: isoDate(card.alterationsDueBy),
    pickupDate: isoDate(card.pickupDate),
    costPence: card.costPence,
    paidBy: card.paidBy ?? "",
    paid: card.paid,
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
          itemLabel: "",
          description: null,
          supplier: null,
          status: null,
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

  const [costStr, setCostStr] = useState(penceToPoundsString(draft.costPence));
  function commitCost(s: string) {
    patch({ costPence: poundsStringToPence(s) });
  }

  return (
    <div className="space-y-4">
      {/* Header rows per §10a */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-7">
          <Label>Name</Label>
          <input
            value={draft.personName}
            onChange={(e) => patch({ personName: e.target.value })}
            disabled={pending}
            placeholder="e.g. Bryony"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-5">
          <Label>Role</Label>
          <select
            value={draft.role}
            onChange={(e) => patch({ role: e.target.value })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          >
            <option value="">— pick —</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-4">
          <Label>Fitting</Label>
          <input
            type="date"
            value={draft.fittingDate}
            onChange={(e) => patch({ fittingDate: e.target.value })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-4">
          <Label>Alterations due</Label>
          <input
            type="date"
            value={draft.alterationsDueBy}
            onChange={(e) => patch({ alterationsDueBy: e.target.value })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-4">
          <Label>Pickup</Label>
          <input
            type="date"
            value={draft.pickupDate}
            onChange={(e) => patch({ pickupDate: e.target.value })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-4">
          <Label>Cost</Label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-tertiary text-sm pointer-events-none">£</span>
            <input
              type="text"
              inputMode="decimal"
              value={costStr}
              onChange={(e) => setCostStr(e.target.value)}
              onBlur={() => commitCost(costStr)}
              disabled={pending}
              placeholder="0.00"
              className="w-full text-sm bg-surface border border-border-soft rounded-sm pl-5 pr-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 tabular-nums text-right"
            />
          </div>
        </FieldLabel>
        <FieldLabel className="sm:col-span-4">
          <Label>Paid by</Label>
          <select
            value={draft.paidBy}
            onChange={(e) => patch({ paidBy: e.target.value })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          >
            <option value="">— pick —</option>
            {PAID_BY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </FieldLabel>
        <div className="sm:col-span-4 flex items-end pb-1.5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.paid}
              onChange={(e) => patch({ paid: e.target.checked })}
              disabled={pending}
            />
            <span>Paid</span>
          </label>
        </div>
      </div>

      {/* Items */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <strong className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
            Items ({draft.items.length})
          </strong>
          <Button variant="ghost" size="sm" onClick={addItem} disabled={pending}>
            + Add item
          </Button>
        </div>
        {draft.items.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">
            Add the pieces of this outfit — dress, shoes, jewellery, etc.
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
        <textarea
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          disabled={pending}
          rows={3}
          placeholder="Anything worth remembering — measurements, tailoring chats, accessories on order."
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
      {/* Row 1 — what + status: itemLabel | status */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-8">
          <Label>Item</Label>
          <input
            value={item.itemLabel}
            onChange={(e) => onChange({ itemLabel: e.target.value })}
            disabled={pending}
            placeholder="e.g. Dress / Shoes / Tie"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-4">
          <Label>Status</Label>
          <select
            value={item.status ?? ""}
            onChange={(e) => onChange({ status: e.target.value || null })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          >
            <option value="">—</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
      {/* Row 2 — description | supplier */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-7">
          <Label>Description</Label>
          <input
            value={item.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value || null })}
            disabled={pending}
            placeholder="e.g. Ivory A-line silk"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-5">
          <Label>Supplier</Label>
          <input
            value={item.supplier ?? ""}
            onChange={(e) => onChange({ supplier: e.target.value || null })}
            disabled={pending}
            placeholder="e.g. Slaters"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
      </div>
      {/* Row 3 — reorder/remove */}
      <div className="flex items-center justify-end gap-1 pt-1">
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
    </li>
  );
}
