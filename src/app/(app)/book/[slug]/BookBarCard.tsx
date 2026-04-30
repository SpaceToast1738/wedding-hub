"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { saveBarCard, type BarSavePayload } from "../actions";
import { barRollups, type BarRollups } from "@/lib/book-cards";
import { CardChrome } from "./CardChrome";
import {
  formatGBPFromPence,
  newRowId,
  penceToPoundsString,
  poundsStringToPence,
} from "./bookCardUi";

// v1.32.0: BAR card editor — drinks plan with per-category items.
// View/Edit flow mirrors BUILD + MENU. Per-head sanity check uses
// the parent confirmedAdults prop computed server-side.

const BAR_TYPE_OPTIONS = ["Open bar", "Drinks tab", "Cash bar", "Wine + toast only"];
const PRESET_CATEGORIES = ["Reception drink", "Wine", "Beer", "Spirits", "Soft", "Coffee/Tea"];

type Item = {
  id: string;
  category: string;
  name: string;
  quantityPlanned: number | null;
  unit: string | null;
  supplier: string | null;
  costPence: number | null;
  notes: string | null;
  order: number;
};

type CardData = {
  id: string;
  barType: string | null;
  tabLimitPence: number | null;
  toastDrink: string | null;
  corkagePence: number | null;
  notes: string | null;
  items: Item[];
};

type BarCardProps = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  card: CardData;
  /** Confirmed adult count from /guests — null if not available. */
  confirmedAdults: number | null;
};

export function BookBarCard({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  isCouple,
  card,
  confirmedAdults,
}: BarCardProps) {
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
      const item = draft.items[i]!;
      if (!item.name.trim()) {
        notify("error", `Item #${i + 1} needs a name.`);
        return;
      }
      if (!item.category.trim()) {
        notify("error", `Item "${item.name}" needs a category.`);
        return;
      }
    }
    const payload: BarSavePayload = {
      barType: draft.barType || null,
      tabLimitPence: draft.tabLimitPence,
      toastDrink: draft.toastDrink || null,
      corkagePence: draft.corkagePence,
      notes: draft.notes || null,
      items: draft.items.map((i) => ({
        id: i.id,
        category: i.category.trim(),
        name: i.name.trim(),
        quantityPlanned: i.quantityPlanned,
        unit: i.unit || null,
        supplier: i.supplier || null,
        costPence: i.costPence,
        notes: i.notes || null,
      })),
    };
    startTransition(async () => {
      const res = await saveBarCard(subsectionId, payload);
      if (res.ok) {
        notify("success", "Saved");
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  const r: BarRollups = barRollups(
    {
      items: editing ? draft.items : card.items,
    },
    confirmedAdults,
  );

  // Categories ordered: presets first (in their preset order), then any
  // custom categories the user has added, alphabetically.
  const usedCategories = Array.from(
    new Set((editing ? draft.items : card.items).map((i) => i.category || "Uncategorised")),
  );
  const orderedCategories = [
    ...PRESET_CATEGORIES.filter((c) => usedCategories.includes(c)),
    ...usedCategories.filter((c) => !PRESET_CATEGORIES.includes(c)).sort(),
  ];

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Bar"
    >
      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat label="Bar type" value={card.barType ?? "—"} />
        <Stat
          label="Tab / corkage"
          value={
            card.tabLimitPence != null
              ? formatGBPFromPence(card.tabLimitPence)
              : card.corkagePence != null
                ? `${formatGBPFromPence(card.corkagePence)} corkage`
                : "—"
          }
        />
        <Stat label="Total cost" value={formatGBPFromPence(r.totalCostPence)} />
        <Stat
          label="Bottles / adult"
          value={
            r.perHeadFlag === "unknown"
              ? "—"
              : `${(r.bottlesPerAdult ?? 0).toFixed(2)}`
          }
        />
      </div>

      {/* Per-head flag banner */}
      {r.perHeadFlag === "low" && (
        <div className="mb-4 px-3 py-2 bg-marigold-100 border border-marigold-700/30 rounded-md text-xs text-marigold-700">
          ⚠ Below 0.5 bottles per adult — typically tight for a wedding crowd.
        </div>
      )}
      {r.perHeadFlag === "high" && (
        <div className="mb-4 px-3 py-2 bg-info/10 border border-info/30 rounded-md text-xs text-info">
          ℹ Above 1.5 bottles per adult — generous; double-check the order.
        </div>
      )}

      {editing ? (
        <EditBody draft={draft} setDraft={setDraft} pending={pending} />
      ) : (
        <ViewBody card={card} orderedCategories={orderedCategories} rollups={r} />
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
  orderedCategories,
  rollups,
}: {
  card: CardData;
  orderedCategories: string[];
  rollups: BarRollups;
}) {
  if (card.items.length === 0) {
    return <p className="text-xs text-ink-tertiary italic">No items yet.</p>;
  }
  return (
    <div className="space-y-4">
      {orderedCategories.map((cat) => {
        const items = card.items.filter((i) => (i.category || "Uncategorised") === cat);
        if (items.length === 0) return null;
        const stats = rollups.perCategory[cat];
        return (
          <div key={cat}>
            <div className="flex items-baseline gap-2 mb-1.5">
              <strong className="text-sm font-semibold text-ink-primary">{cat}</strong>
              {stats && (
                <span className="text-[10px] text-ink-tertiary tabular-nums">
                  {items.length} item{items.length === 1 ? "" : "s"} · {formatGBPFromPence(stats.totalCostPence)}
                </span>
              )}
            </div>
            <ul className="divide-y divide-border-soft border border-border-soft rounded-md text-sm">
              {items.map((item) => (
                <li key={item.id} className="px-3 py-1.5 flex items-baseline gap-2">
                  <span className="flex-1 text-ink-primary">
                    {item.name}
                    {item.quantityPlanned != null && (
                      <>
                        {" · "}
                        <span className="text-ink-secondary">
                          {item.quantityPlanned}
                          {item.unit ? ` ${item.unit}` : ""}
                        </span>
                      </>
                    )}
                    {item.supplier && (
                      <span className="text-ink-tertiary"> · {item.supplier}</span>
                    )}
                  </span>
                  <span className="text-ink-secondary tabular-nums w-20 text-right">
                    {formatGBPFromPence(item.costPence)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
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

// ── Edit body ────────────────────────────────────────────────────

type Draft = {
  barType: string;
  tabLimitPence: number | null;
  toastDrink: string;
  corkagePence: number | null;
  notes: string;
  items: Item[];
};

function buildDraft(card: CardData): Draft {
  return {
    barType: card.barType ?? "",
    tabLimitPence: card.tabLimitPence,
    toastDrink: card.toastDrink ?? "",
    corkagePence: card.corkagePence,
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
          category: "Wine",
          name: "",
          quantityPlanned: null,
          unit: "bottles",
          supplier: null,
          costPence: null,
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

  const [tabStr, setTabStr] = useState(penceToPoundsString(draft.tabLimitPence));
  const [corkStr, setCorkStr] = useState(penceToPoundsString(draft.corkagePence));

  return (
    <div className="space-y-4">
      {/* Header fields */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Field label="Bar type" hint="Open bar, drinks tab, cash bar, wine + toast only…">
          <select
            value={draft.barType}
            onChange={(e) => patch({ barType: e.target.value })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          >
            <option value="">— pick —</option>
            {BAR_TYPE_OPTIONS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Tab limit" hint="Cap on a drinks tab (if any).">
          <PoundsInput
            value={tabStr}
            onChange={setTabStr}
            onCommit={() => patch({ tabLimitPence: poundsStringToPence(tabStr) })}
            placeholder="0.00"
            disabled={pending}
          />
        </Field>
        <Field label="Toast drink" hint="What gets handed out for the speeches.">
          <input
            type="text"
            value={draft.toastDrink}
            onChange={(e) => patch({ toastDrink: e.target.value })}
            disabled={pending}
            placeholder="e.g. Prosecco"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </Field>
        <Field label="Corkage" hint="Per-bottle fee if you're bringing wine in.">
          <PoundsInput
            value={corkStr}
            onChange={setCorkStr}
            onCommit={() => patch({ corkagePence: poundsStringToPence(corkStr) })}
            placeholder="0.00"
            disabled={pending}
          />
        </Field>
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
            Add the things you&apos;ll be serving — wines, beers, soft drinks, the toast bubbles.
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

      <Field label="Notes" hint="Any caveats — alcohol-free options, kids' drinks, glass count.">
        <textarea
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          disabled={pending}
          rows={3}
          placeholder="e.g. Alcohol-free option for 4 guests. Glassware from the venue."
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
        />
      </Field>
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
  const [costStr, setCostStr] = useState(penceToPoundsString(item.costPence));
  useEffect(() => {
    setCostStr(penceToPoundsString(item.costPence));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  return (
    <li className="px-3 py-2.5 bg-canvas/30">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <div className="sm:col-span-3">
          <input
            value={item.category}
            onChange={(e) => onChange({ category: e.target.value })}
            disabled={pending}
            list={`bar-cats-${item.id}`}
            placeholder="Category"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
          />
          <datalist id={`bar-cats-${item.id}`}>
            {PRESET_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <input
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          disabled={pending}
          placeholder="Name (e.g. Pinot grigio)"
          className="sm:col-span-3 text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
        <input
          type="number"
          step="any"
          min={0}
          value={item.quantityPlanned ?? ""}
          onChange={(e) =>
            onChange({ quantityPlanned: e.target.value === "" ? null : Number(e.target.value) })
          }
          disabled={pending}
          placeholder="Qty"
          className="sm:col-span-1 text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500 tabular-nums"
        />
        <input
          value={item.unit ?? ""}
          onChange={(e) => onChange({ unit: e.target.value })}
          disabled={pending}
          placeholder="Unit (bottles, L)"
          className="sm:col-span-2 text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
        <input
          value={item.supplier ?? ""}
          onChange={(e) => onChange({ supplier: e.target.value })}
          disabled={pending}
          placeholder="Supplier"
          className="sm:col-span-2 text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
        <div className="sm:col-span-1 relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-tertiary text-sm pointer-events-none">£</span>
          <input
            type="text"
            inputMode="decimal"
            value={costStr}
            onChange={(e) => setCostStr(e.target.value)}
            onBlur={() => onChange({ costPence: poundsStringToPence(costStr) })}
            disabled={pending}
            placeholder="0.00"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm pl-5 pr-2 py-1 text-ink-primary outline-none focus:border-moss-500 tabular-nums text-right"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 mt-2">
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

// ── Shared layout helpers ────────────────────────────────────────

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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-tertiary">{hint}</p>}
    </div>
  );
}

function PoundsInput({
  value,
  onChange,
  onCommit,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (s: string) => void;
  onCommit: () => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-tertiary text-sm pointer-events-none">£</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full text-sm bg-surface border border-border-soft rounded-sm pl-5 pr-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 tabular-nums text-right"
      />
    </div>
  );
}
