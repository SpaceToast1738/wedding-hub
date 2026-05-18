"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { notify } from "@/lib/notify";
import { saveLodgingCard, type LodgingSavePayload } from "../actions";
import { lodgingRollups } from "@/lib/book-cards";
import { CardChrome } from "./CardChrome";
import { FieldLabel, Label, newRowId } from "./bookCardUi";

// v1.36.0 (P6): LODGING_GUIDE card — recommended hotels for guests.
// Single bulk save with item reconcile. Read-mostly reference data —
// no obtained / paid / expired flags. Print stylesheet on view mode
// produces a single sheet to share when guests ask.

const PRICE_BAND_OPTIONS = ["£", "££", "£££"];

type Item = {
  id: string;
  name: string;
  distanceFromVenue: string | null;
  priceRangeLabel: string | null;
  phone: string | null;
  website: string | null;
  groupRateCode: string | null;
  notes: string | null;
  order: number;
};

type CardData = {
  id: string;
  notes: string | null;
  items: Item[];
};

type LodgingCardProps = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  card: CardData;
};

export function BookLodgingCard({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  isCouple,
  card,
}: LodgingCardProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
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
      if (!draft.items[i]!.name.trim()) {
        notify("error", `Hotel #${i + 1} needs a name.`);
        return;
      }
    }
    const payload: LodgingSavePayload = {
      notes: draft.notes.trim() || null,
      items: draft.items.map((i) => ({
        id: i.id,
        name: i.name.trim(),
        distanceFromVenue: i.distanceFromVenue?.trim() || null,
        priceRangeLabel: i.priceRangeLabel?.trim() || null,
        phone: i.phone?.trim() || null,
        website: i.website?.trim() || null,
        groupRateCode: i.groupRateCode?.trim() || null,
        notes: i.notes?.trim() || null,
      })),
    };
    startTransition(async () => {
      const res = await saveLodgingCard(subsectionId, payload);
      if (res.ok) {
        notify("success", "Saved");
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  const r = lodgingRollups({ items: card.items });
  const priceBands = Array.from(r.perPriceBand.entries())
    .filter(([k]) => k !== "")
    .sort((a, b) => a[0].length - b[0].length);

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Lodging guide"
    >
      {/* Header */}
      <div className="mb-4 flex items-baseline gap-2 flex-wrap">
        <span className="text-base font-semibold text-ink-primary">
          {r.itemCount} {r.itemCount === 1 ? "hotel" : "hotels"}
        </span>
        {priceBands.map(([k, v]) => (
          <span
            key={k}
            className="text-[11px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-canvas border border-border-soft text-ink-tertiary"
          >
            {v} × {k}
          </span>
        ))}
      </div>

      {card.notes && !editing && (
        <p className="text-sm text-ink-secondary whitespace-pre-wrap mb-4">
          {card.notes}
        </p>
      )}

      {editing ? (
        <EditBody draft={draft} setDraft={setDraft} pending={pending} />
      ) : (
        <ViewBody card={card} />
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

function ViewBody({ card }: { card: CardData }) {
  if (card.items.length === 0) {
    return <p className="text-xs text-ink-tertiary italic">No hotels yet.</p>;
  }
  return (
    <ul className="divide-y divide-border-soft border border-border-soft rounded-md text-sm">
      {card.items.map((item) => (
        <li key={item.id} className="px-3 py-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <strong className="font-medium text-ink-primary">{item.name}</strong>
            {item.priceRangeLabel && (
              <span className="text-[10px] uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-canvas border border-border-soft text-ink-tertiary">
                {item.priceRangeLabel}
              </span>
            )}
            {item.distanceFromVenue && (
              <span className="text-xs text-ink-secondary">{item.distanceFromVenue}</span>
            )}
          </div>
          {(item.phone || item.website || item.groupRateCode) && (
            <div className="text-xs text-ink-tertiary mt-0.5 flex flex-wrap gap-x-2">
              {item.phone && <span>📞 {item.phone}</span>}
              {item.website && (
                <a
                  href={item.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:underline truncate max-w-[260px]"
                >
                  🔗 {item.website}
                </a>
              )}
              {item.groupRateCode && (
                <span>
                  Group rate{" "}
                  <span className="font-mono text-ink-secondary">{item.groupRateCode}</span>
                </span>
              )}
            </div>
          )}
          {item.notes && (
            <p className="text-xs text-ink-secondary mt-0.5 whitespace-pre-wrap">
              {item.notes}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

type Draft = {
  notes: string;
  items: Item[];
};

function buildDraft(card: CardData): Draft {
  return {
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
          name: "",
          distanceFromVenue: null,
          priceRangeLabel: null,
          phone: null,
          website: null,
          groupRateCode: null,
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
      <FieldLabel>
        <Label>Card-level notes (intro text)</Label>
        <MentionableTextarea
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          disabled={pending}
          rows={2}
          placeholder="e.g. We've gathered a few options around Stratford-upon-Avon. Group rate codes where they apply."
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
        />
      </FieldLabel>

      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <strong className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
            Hotels ({draft.items.length})
          </strong>
          <Button variant="ghost" size="sm" onClick={addItem} disabled={pending}>
            + Add hotel
          </Button>
        </div>
        {draft.items.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">
            Add the hotels you&apos;d recommend — name, distance, price band, contact.
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
      {/* Row 1 — name + price band */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-9">
          <Label>Hotel name</Label>
          <input
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            disabled={pending}
            placeholder="e.g. Crowne Plaza Stratford-upon-Avon"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-3">
          <Label>Price band</Label>
          <select
            value={item.priceRangeLabel ?? ""}
            onChange={(e) => onChange({ priceRangeLabel: e.target.value || null })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          >
            <option value="">—</option>
            {PRICE_BAND_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
      {/* Row 2 — distance + phone */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-7">
          <Label>Distance from venue</Label>
          <input
            value={item.distanceFromVenue ?? ""}
            onChange={(e) => onChange({ distanceFromVenue: e.target.value || null })}
            disabled={pending}
            placeholder="e.g. 0.3 miles — 8 min walk"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-5">
          <Label>Phone</Label>
          <input
            value={item.phone ?? ""}
            onChange={(e) => onChange({ phone: e.target.value || null })}
            disabled={pending}
            placeholder="e.g. 01789 279988"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
      </div>
      {/* Row 3 — website + group rate code */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-8">
          <Label>Website</Label>
          <input
            value={item.website ?? ""}
            onChange={(e) => onChange({ website: e.target.value || null })}
            disabled={pending}
            placeholder="https://…"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-4">
          <Label>Group rate code</Label>
          <input
            value={item.groupRateCode ?? ""}
            onChange={(e) => onChange({ groupRateCode: e.target.value || null })}
            disabled={pending}
            placeholder="e.g. SPENCER2026"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
      </div>
      {/* Notes */}
      <FieldLabel>
        <Label>Notes</Label>
        <input
          value={item.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value || null })}
          disabled={pending}
          placeholder="e.g. Breakfast included; ask for the wedding block"
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
        />
      </FieldLabel>
      {/* Reorder/remove */}
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
