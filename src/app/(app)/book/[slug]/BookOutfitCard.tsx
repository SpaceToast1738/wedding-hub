"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ImageGallery, type GalleryDisplay, type GallerySize } from "@/components/ui/ImageGallery";
import {
  attachFileToOutfitCard,
  detachFileFromOutfitCard,
  uploadAndAttachOutfitFile,
  saveOutfitCard,
  setBookSubsectionHeaderFileId,
  setBookSubsectionPhotoDisplay,
  setBookSubsectionPhotoSize,
  setBookSubsectionSlideshowAuto,
  type OutfitSavePayload,
} from "../actions";
import { outfitRollups } from "@/lib/book-cards";
import { CardChrome } from "./CardChrome";
import type { LinkedTaskRow } from "./CardLinkedTasksPanel";
import type { UserOpt } from "@/app/(app)/tasks/AddTaskToggle";
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

// v1.93.0: simplified lifecycle — Planned (default) → Purchased →
// Received → Already own. Replaces the v1.92.0 set and folds the
// alreadyOwned boolean into the status enum.
const STATUS_OPTIONS = ["Planned", "Purchased", "Received", "Already own"];

const STATUS_TONE: Record<string, string> = {
  Planned: "bg-canvas border-border-soft text-ink-secondary",
  Purchased: "bg-info/10 border-info/30 text-info",
  Received: "bg-moss-50 border-moss-300 text-moss-700",
  "Already own": "bg-marigold-100 border-marigold-700/30 text-marigold-700",
};

type Item = {
  id: string;
  itemLabel: string;
  description: string | null;
  supplier: string | null;
  website: string | null;
  status: string | null;
  notes: string | null;
  order: number;
  // v1.78.0: paid-on-card chip — sum of PAID payments linked to this
  // outfit-item via Payment.bookOutfitId. Optional so existing edit-mode
  // draft state (which doesn't carry payments) still type-checks.
  paidPence?: number;
  // v1.93.1: optional per-item cost in pence.
  costPence: number | null;
};

type CardData = {
  id: string;
  personName: string | null;
  role: string | null;
  costPence: number | null;
  notes: string | null;
  fileIds: string[];
  items: Item[];
  // v1.96.4: per-card photo gallery size. Persisted on
  // BookSubsection.photoSize; flows in via the page → CardRouter
  // → BookOutfitCard prop chain.
  photoSize: GallerySize;
  // v1.97.0: display mode + mode-specific knobs. All persisted on
  // BookSubsection; threading mirrors photoSize.
  photoDisplay: GalleryDisplay;
  headerFileId: string | null;
  slideshowAuto: boolean;
};

type OutfitCardEditorProps = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  /** v1.76.0: gates the card-level cost display + cost input in
   *  edit mode. Hidden values preserved via draft state. */
  showMoney?: boolean;
  card: CardData;
  /** All Files in the system, surfaced in the card-level photos picker. */
  files: Array<{ id: string; name: string; mimeType: string }>;
  /** v1.92.0: inline linked-tasks panel (rendered by CardChrome). */
  linkedTasks?: LinkedTaskRow[];
  users?: UserOpt[];
};

export function BookOutfitCardEditor({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  isCouple,
  showMoney = true,
  card,
  files,
  linkedTasks = [],
  users = [],
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
      costPence: draft.costPence,
      fileIds: card.fileIds, // file picker is on view-mode only; draft mirrors saved card
      notes: draft.notes || null,
      items: draft.items.map((i) => ({
        id: i.id,
        itemLabel: i.itemLabel.trim(),
        description: i.description?.trim() || null,
        supplier: i.supplier?.trim() || null,
        website: i.website?.trim() || null,
        status: i.status || null,
        notes: i.notes?.trim() || null,
        // v1.93.1
        costPence: i.costPence ?? null,
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

  // v1.96.4: router refresh after photo-size action so the gallery
  // re-renders against the new BookSubsection.photoSize without
  // requiring a full navigation.
  const router = useRouter();
  function changePhotoSize(next: GallerySize) {
    startTransition(async () => {
      const res = await setBookSubsectionPhotoSize(subsectionId, next);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  // v1.97.0: three new handlers for the gallery's mode router. Same
  // refresh-after-action pattern as changePhotoSize above.
  function changePhotoDisplay(next: GalleryDisplay) {
    startTransition(async () => {
      const res = await setBookSubsectionPhotoDisplay(subsectionId, next);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  function pinHeader(fileId: string | null) {
    startTransition(async () => {
      const res = await setBookSubsectionHeaderFileId(subsectionId, fileId);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  function toggleSlideshowAuto(auto: boolean) {
    startTransition(async () => {
      const res = await setBookSubsectionSlideshowAuto(subsectionId, auto);
      if (res.ok) router.refresh();
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
      linkedTasks={linkedTasks}
      users={users}
      // v1.97.0: role chip moves into the chrome's title row so it
      // sits next to "Bryonys Outfit" instead of on a separate
      // sub-row. Person name dropped from the body entirely — v1.92.2
      // already hid it in the common case where it's redundant with
      // the title; with the role-chip migration there's no remaining
      // useful sub-line content.
      headerChips={
        card.role ? (
          <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-canvas border border-border-soft text-ink-tertiary flex-shrink-0">
            {card.role}
          </span>
        ) : null
      }
      // v1.97.0: photo gallery lifts to the chrome's media slot so it
      // renders at the top of the card (above stats / items / notes)
      // rather than below the body. ImageGallery's editMode flag
      // gates all management chrome on `editing` — view-mode readers
      // see photos with no controls.
      mediaBlock={
        <>
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
            onAttach={attach}
            onDetach={detach}
            size={card.photoSize}
            onSizeChange={changePhotoSize}
            display={card.photoDisplay}
            headerFileId={card.headerFileId}
            slideshowAuto={card.slideshowAuto}
            editMode={editing}
            onDisplayChange={changePhotoDisplay}
            onHeaderPin={pinHeader}
            onSlideshowAutoChange={toggleSlideshowAuto}
          />
        </>
      }
      // v1.96.4: housekeeping (Make couple-only + Delete) hidden in
      // edit mode — keeps Cancel / Save visually focused on the
      // pending change. Edit / Cancel / Save lift to CardChrome's
      // footer slot so the card no longer carries two action rows.
      hideHousekeeping={editing}
      actions={
        canEdit
          ? editing
            ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={save} disabled={pending}>
                  Save changes
                </Button>
              </>
            )
            : (
              <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )
          : undefined
      }
    >
      {/* v1.97.0: person+role sub-line removed — role chip moves
          into CardChrome's title row via the headerChips slot; the
          person name was already hidden in the common redundant
          case by v1.92.2, and the rare not-redundant case is rare
          enough that we drop it rather than carry an empty container. */}

      {/* v1.96.4: stats tiles replace the v1.93.x flat meta line.
          Each independent number — sorted progress, card-level
          budget, per-item items-total — gets its own bordered box,
          rendered conditionally so a no-money card just shows the
          Sorted tile. Three columns max; auto-wraps on narrow
          viewports via the responsive grid. */}
      {(() => {
        const itemsTotalPence = card.items.reduce(
          (sum, i) => sum + (i.costPence ?? 0),
          0,
        );
        const anyItemCost = card.items.some((i) => i.costPence != null);
        const showBudget = showMoney && card.costPence != null;
        const showItemsTotal = showMoney && anyItemCost;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            <StatTile
              label="Sorted"
              value={
                r.itemCount === 0
                  ? "—"
                  : `${r.collectedCount} / ${r.itemCount}`
              }
            />
            {showBudget && (
              <StatTile
                label="Budget"
                value={formatGBPFromPence(card.costPence!)}
              />
            )}
            {showItemsTotal && (
              <StatTile
                label="Items total"
                value={formatGBPFromPence(itemsTotalPence)}
                title="Sum of per-item costs. The card-level budget tile stays manual — set it to whatever the linked budget line should track."
              />
            )}
          </div>
        );
      })()}

      {editing ? (
        <EditBody draft={draft} setDraft={setDraft} pending={pending} showMoney={showMoney} />
      ) : (
        <ViewBody card={card} />
      )}
    </CardChrome>
  );
}

// v1.96.4: small bordered stat tile, used for the Sorted / Budget /
// Items-total trio above the body. Optional `title` populates the
// browser tooltip (e.g. for the items-total disambiguation).
function StatTile({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div
      className="bg-canvas border border-border-soft rounded-md px-3 py-2"
      title={title}
    >
      <div className="text-[9px] uppercase tracking-wider text-ink-tertiary font-bold">
        {label}
      </div>
      <div className="text-sm font-semibold text-ink-primary tabular-nums">
        {value}
      </div>
    </div>
  );
}

// v1.93.0: Stat + TimelineStep helpers removed (no more stats strip
// or fitting timeline). isoDate / shortDate are no longer needed at
// the card level either (dates moved to Tasks).

// ── View body ────────────────────────────────────────────────────

// v1.97.0: photo gallery + its props lifted out of ViewBody — they
// now live on CardChrome's mediaBlock slot. ViewBody is just the
// items list + notes block.
function ViewBody({ card }: { card: CardData }) {
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
            {card.items.map((item) => {
              // v1.93.2: status pill always renders. Null status falls
              // back to "Planned" — items always have a position in
              // the lifecycle, so the pill should always communicate
              // it. Encourages the user to update status as items
              // progress.
              const statusLabel = item.status ?? "Planned";
              const statusTone = STATUS_TONE[statusLabel] ?? STATUS_TONE.Planned;
              const hasMeta = !!item.description || !!item.supplier || !!item.website;
              return (
                <li key={item.id} className="px-3 py-2.5 space-y-1">
                  {/* Row 1: label (left) — status + cost + paid pills (right) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink-primary flex-1 min-w-0">
                      {item.itemLabel || (
                        <span className="italic text-ink-tertiary">Untitled item</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 flex-shrink-0">
                      {/* v1.93.1: per-item cost chip — muted by default
                          so it doesn't compete visually with paid /
                          status pills. Hidden when not set. */}
                      {item.costPence != null && (
                        <span
                          className="text-[10px] text-ink-secondary tabular-nums"
                          title={`Item cost: £${(item.costPence / 100).toFixed(2)}`}
                        >
                          £{(item.costPence / 100).toFixed(2)}
                        </span>
                      )}
                      {/* v1.78.0: paid-on-item reciprocal chip. Renders
                          next to the status pill when this item has
                          received payments. */}
                      {item.paidPence != null && item.paidPence > 0 && (
                        <span
                          className="text-[10px] text-moss-700 bg-moss-50 border border-moss-300 rounded-full px-2 py-0.5"
                          title={`Paid £${(item.paidPence / 100).toFixed(2)}`}
                        >
                          📎 £{(item.paidPence / 100).toFixed(2)}
                        </span>
                      )}
                      <span
                        className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border ${statusTone}`}
                      >
                        {statusLabel}
                      </span>
                    </span>
                  </div>
                  {/* Row 2: description · supplier · website link. Only
                      renders when at least one field is set, so empty
                      items collapse to a clean single line. */}
                  {hasMeta && (
                    <div className="text-xs text-ink-secondary flex items-baseline gap-1.5 flex-wrap">
                      {item.description && <span>{item.description}</span>}
                      {item.description && item.supplier && (
                        <span aria-hidden className="text-ink-tertiary">·</span>
                      )}
                      {item.supplier && (
                        <span className="text-ink-tertiary">{item.supplier}</span>
                      )}
                      {item.website && (
                        <a
                          href={item.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-moss-700 hover:underline"
                        >
                          Link ↗
                        </a>
                      )}
                    </div>
                  )}
                  {/* Row 3: per-item notes (v1.93.2). Italic muted,
                      whitespace-preserving so quick measurements /
                      reminders read cleanly. */}
                  {item.notes && (
                    <p className="text-xs text-ink-tertiary italic whitespace-pre-wrap pt-0.5">
                      {item.notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* v1.97.0: Photos block moved up to CardChrome's mediaBlock
          slot so it renders at the top of the card. */}

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
  costPence: number | null;
  notes: string;
  items: Item[];
};

function buildDraft(card: CardData): Draft {
  return {
    personName: card.personName ?? "",
    role: card.role ?? "",
    costPence: card.costPence,
    notes: card.notes ?? "",
    items: card.items.map((i) => ({ ...i })),
  };
}

function EditBody({
  draft,
  setDraft,
  pending,
  showMoney,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  pending: boolean;
  showMoney: boolean;
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
          website: null,
          status: null,
          notes: null,
          order: draft.items.length,
          // v1.93.1
          costPence: null,
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

      {/* v1.93.0: cost stays as the single budget-link knob (still
          feeds the linked BudgetLine via syncBudgetLine). Fitting /
          alterations / pickup dates removed — manage as Tasks. Paid /
          paidBy removed — payment tracking flows via Payments page +
          the per-item 📎 paid chip. */}
      {showMoney && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
          <FieldLabel>
            <Label>Cost (budget link)</Label>
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
        </div>
      )}

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
                showMoney={showMoney}
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
  showMoney,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: Item;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  showMoney: boolean;
  onChange: (p: Partial<Item>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [costStr, setCostStr] = useState(penceToPoundsString(item.costPence));
  function commitCost(s: string) {
    onChange({ costPence: poundsStringToPence(s) });
  }
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
      {/* Row 3 — website | cost (cost gated by showMoney) */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className={showMoney ? "sm:col-span-8" : "sm:col-span-12"}>
          <Label>Website</Label>
          <input
            type="url"
            value={item.website ?? ""}
            onChange={(e) => onChange({ website: e.target.value || null })}
            disabled={pending}
            placeholder="https://…"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        {showMoney && (
          <FieldLabel className="sm:col-span-4">
            <Label>Cost</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-tertiary text-sm pointer-events-none">£</span>
              <input
                type="text"
                inputMode="decimal"
                value={costStr}
                onChange={(e) => setCostStr(e.target.value)}
                onBlur={(e) => commitCost(e.target.value)}
                disabled={pending}
                placeholder="0.00"
                className="w-full text-sm bg-surface border border-border-soft rounded-sm pl-5 pr-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 tabular-nums"
              />
            </div>
          </FieldLabel>
        )}
      </div>
      {/* Row 4 — notes (v1.93.2: per-item notes — measurements,
          tailoring chats, anything that doesn't fit the structured
          fields). Card-level notes still cover whole-outfit
          observations. */}
      <FieldLabel>
        <Label>Notes</Label>
        <textarea
          value={item.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value || null })}
          disabled={pending}
          rows={2}
          placeholder="e.g. waist taken in 1.5cm, due back 12 Sept"
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
        />
      </FieldLabel>
      {/* Row 5 — reorder/remove */}
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
