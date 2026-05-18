"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { notify } from "@/lib/notify";
import {
  saveSetupCard,
  attachFileToSetupCard,
  detachFileFromSetupCard,
  uploadAndAttachSetupFile,
  setBookSubsectionComponentHidden,
  setBookSubsectionComponentOrder,
  type SetupSavePayload,
} from "../actions";
import { setupRollups } from "@/lib/book-cards";
import { CardChrome } from "./CardChrome";
import { FieldLabel, Label, newRowId } from "./bookCardUi";
import { ImageGallery } from "@/components/ui/ImageGallery";
import { ReorderableCardBody, type CardComponent } from "./ReorderableCardBody";

// v1.33.0: SETUP card editor — per-space spatial walkthrough.
// View / Edit flow mirrors v1.31.1 BUILD + v1.32.0 MENU/BAR.
// Items table with packed + placed checkbox columns + a pack-down
// plan column. `source` autocompletes from existing Supplier names
// (string match, no FK — matches the v1.30.5 cross-module-reference
// convention).
//
// v1.99.1: body migrated to <ReorderableCardBody>. Components split:
//   - photos   — gallery (canEdit gates the management chrome)
//   - stats    — space / setup time / owner / progress tiles (view)
//                or the three header inputs (edit)
//   - items    — read-only table (view) or editable item list (edit)
//   - notes    — view paragraph or edit textarea
// All four are hide-able; in edit mode the per-section ↑/↓/👁 strip
// from ReorderableCardBody lets the couple shuffle them around or
// suppress one from view mode.

const PRESET_SPACES = ["Ceremony room", "Drinks reception", "Reception room", "Evening setup", "Pack-down"];

type Item = {
  id: string;
  name: string;
  quantity: number | null;
  location: string | null;
  source: string | null;
  website: string | null;
  packed: boolean;
  placed: boolean;
  packDownPlan: string | null;
  notes: string | null;
  order: number;
};

type CardData = {
  id: string;
  space: string | null;
  setupStartsAt: string | null;
  setupOwner: string | null;
  notes: string | null;
  items: Item[];
  /** v1.63.0: photo gallery — File ids attached to this card. */
  fileIds: string[];
  /** v1.99.1: per-card body layout. */
  componentOrder: string[];
  hiddenComponents: string[];
};

type SetupCardProps = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  card: CardData;
  /** Existing Supplier.name values used as autocomplete hints on the
   *  per-item `source` field. */
  supplierNames: string[];
  /** v1.63.0: file list for the photo gallery. */
  files: Array<{ id: string; name: string; mimeType: string }>;
};

export function BookSetupCard({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  isCouple,
  card,
  supplierNames,
  files,
}: SetupCardProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => buildDraft(card));
  const router = useRouter();
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
      if (!draft.items[i]!.name.trim()) {
        notify("error", `Item #${i + 1} needs a name.`);
        return;
      }
    }
    const payload: SetupSavePayload = {
      space: draft.space || null,
      setupStartsAt: draft.setupStartsAt || null,
      setupOwner: draft.setupOwner || null,
      notes: draft.notes || null,
      items: draft.items.map((i) => ({
        id: i.id,
        name: i.name.trim(),
        quantity: i.quantity,
        location: i.location || null,
        source: i.source || null,
        website: i.website || null,
        packed: i.packed,
        placed: i.placed,
        packDownPlan: i.packDownPlan || null,
        notes: i.notes || null,
      })),
    };
    startTransition(async () => {
      const res = await saveSetupCard(subsectionId, payload);
      if (res.ok) {
        notify("success", "Saved");
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  // v1.99.1: reorder + hide handlers wired identically to OUTFIT.
  function reorderComponents(next: string[]) {
    startTransition(async () => {
      const res = await setBookSubsectionComponentOrder(subsectionId, next);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  function toggleComponentHidden(componentId: string, hidden: boolean) {
    startTransition(async () => {
      const res = await setBookSubsectionComponentHidden(subsectionId, componentId, hidden);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }

  const r = setupRollups({ items: editing ? draft.items : card.items });

  // v1.99.1: per-card component registry.
  const photosNode = (
    <>
      <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
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
          const res = await uploadAndAttachSetupFile(subsectionId, fd);
          if (res.ok) notify("success", "Photo uploaded");
          else notify("error", res.error);
        }}
        onAttach={(fileId) => {
          startTransition(async () => {
            const res = await attachFileToSetupCard(subsectionId, fileId);
            if (res.ok) notify("success", "Photo attached");
            else notify("error", res.error);
          });
        }}
        onDetach={(fileId) => {
          startTransition(async () => {
            const res = await detachFileFromSetupCard(subsectionId, fileId);
            if (res.ok) notify("success", "Photo detached");
            else notify("error", res.error);
          });
        }}
      />
    </>
  );

  const statsNode = editing ? (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Field label="Space" hint="The physical area this card covers.">
        <input
          value={draft.space}
          onChange={(e) => setDraft({ ...draft, space: e.target.value })}
          disabled={pending}
          list="setup-spaces"
          placeholder="e.g. Ceremony room"
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
        />
        <datalist id="setup-spaces">
          {PRESET_SPACES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
      <Field label="Setup starts at" hint="Free text — clock time on the day.">
        <input
          value={draft.setupStartsAt}
          onChange={(e) => setDraft({ ...draft, setupStartsAt: e.target.value })}
          disabled={pending}
          placeholder="e.g. 10:00am"
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
        />
      </Field>
      <Field label="Owner" hint="Who's leading the setup for this space.">
        <input
          value={draft.setupOwner}
          onChange={(e) => setDraft({ ...draft, setupOwner: e.target.value })}
          disabled={pending}
          placeholder="e.g. Paintbox Blooms · Bridesmaids"
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
        />
      </Field>
    </div>
  ) : (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Space" value={card.space ?? "—"} />
      <Stat label="Setup at" value={card.setupStartsAt ?? "—"} />
      <Stat label="Owner" value={card.setupOwner ?? "—"} />
      <Stat
        label="Progress"
        value={
          r.itemCount === 0
            ? "—"
            : `${r.percentPacked}% pack · ${r.percentPlaced}% place`
        }
      />
    </div>
  );

  const itemsNode = editing ? (
    <ItemsEditBody
      draft={draft}
      setDraft={setDraft}
      pending={pending}
      supplierNames={supplierNames}
    />
  ) : (
    <ItemsViewBody card={card} />
  );

  const notesNode = editing ? (
    <Field label="Notes" hint="Anything the team should know — access codes, parking, on-call contact.">
      <MentionableTextarea
        value={draft.notes}
        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        disabled={pending}
        rows={3}
        placeholder="e.g. Side door access from 9:30am. Parking via main car park."
        className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
      />
    </Field>
  ) : card.notes ? (
    <div>
      <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
        Notes
      </strong>
      <p className="text-sm text-ink-secondary whitespace-pre-wrap">{card.notes}</p>
    </div>
  ) : (
    <p className="text-xs text-ink-tertiary italic">No notes.</p>
  );

  const components: CardComponent[] = [];
  if (canEdit || card.fileIds.length > 0) {
    components.push({ id: "photos", label: "Photos", node: photosNode });
  }
  components.push({ id: "stats", label: "Stats", node: statsNode });
  components.push({
    id: "items",
    label: "Items",
    node: itemsNode,
    alwaysVisible: true,
  });
  components.push({ id: "notes", label: "Notes", node: notesNode });

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Setup"
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
      <ReorderableCardBody
        components={components}
        savedOrder={card.componentOrder}
        hiddenIds={card.hiddenComponents}
        editMode={editing}
        pending={pending}
        onReorder={reorderComponents}
        onToggleHidden={toggleComponentHidden}
      />
    </CardChrome>
  );
}

// ── View body — items table only (other sections live alongside) ─

function ItemsViewBody({ card }: { card: CardData }) {
  if (card.items.length === 0) {
    return <p className="text-xs text-ink-tertiary italic">No items yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold border-b border-border-soft">
            <Th align="left">Item</Th>
            <Th align="right">Qty</Th>
            <Th align="left">Location</Th>
            <Th align="left">Source</Th>
            <Th align="center">Packed</Th>
            <Th align="center">Placed</Th>
            <Th align="left">Pack-down</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-soft">
          {card.items.map((item) => (
            <tr key={item.id}>
              <td className="py-1.5 px-2 text-ink-primary">{item.name}</td>
              <td className="py-1.5 px-2 text-ink-secondary tabular-nums text-right">
                {item.quantity ?? ""}
              </td>
              <td className="py-1.5 px-2 text-ink-secondary">{item.location ?? ""}</td>
              <td className="py-1.5 px-2 text-ink-secondary">
                {item.source ?? ""}
                {item.website && (
                  <a href={item.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-moss-700 hover:underline ml-1">Link ↗</a>
                )}
              </td>
              <td className="py-1.5 px-2 text-center">
                {item.packed ? (
                  <span className="text-moss-700" aria-label="packed">●</span>
                ) : (
                  <span className="text-ink-tertiary/40">○</span>
                )}
              </td>
              <td className="py-1.5 px-2 text-center">
                {item.placed ? (
                  <span className="text-moss-700" aria-label="placed">●</span>
                ) : (
                  <span className="text-ink-tertiary/40">○</span>
                )}
              </td>
              <td className="py-1.5 px-2 text-ink-secondary text-xs">
                {item.packDownPlan ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ align, children }: { align: "left" | "right" | "center"; children: React.ReactNode }) {
  return (
    <th
      className={`py-1.5 px-2 font-bold ${align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center"}`}
    >
      {children}
    </th>
  );
}

// ── Edit body — items list only ──────────────────────────────────

type Draft = {
  space: string;
  setupStartsAt: string;
  setupOwner: string;
  notes: string;
  items: Item[];
};

function buildDraft(card: CardData): Draft {
  return {
    space: card.space ?? "",
    setupStartsAt: card.setupStartsAt ?? "",
    setupOwner: card.setupOwner ?? "",
    notes: card.notes ?? "",
    items: card.items.map((i) => ({ ...i })),
  };
}

function ItemsEditBody({
  draft,
  setDraft,
  pending,
  supplierNames,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  pending: boolean;
  supplierNames: string[];
}) {
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
          quantity: null,
          location: null,
          source: null,
          website: null,
          packed: false,
          placed: false,
          packDownPlan: null,
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
          Add what gets put where in this space — the venue coordinator and best man will work off this list.
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
              supplierNames={supplierNames}
              onChange={(p) => patchItem(idx, p)}
              onRemove={() => removeItem(idx)}
              onMoveUp={() => moveItem(idx, -1)}
              onMoveDown={() => moveItem(idx, 1)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemEditRow({
  item,
  isFirst,
  isLast,
  pending,
  supplierNames,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: Item;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  supplierNames: string[];
  onChange: (p: Partial<Item>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <li className="px-3 py-3 bg-canvas/30 space-y-2">
      {/* Row 1 — what + where: name | qty | location */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-6">
          <Label>Item</Label>
          <input
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            disabled={pending}
            placeholder="e.g. Centerpiece"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-2">
          <Label>Qty</Label>
          <input
            type="number"
            min={0}
            value={item.quantity ?? ""}
            onChange={(e) =>
              onChange({ quantity: e.target.value === "" ? null : Number(e.target.value) })
            }
            disabled={pending}
            placeholder="0"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 tabular-nums"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-4">
          <Label>Location</Label>
          <input
            value={item.location ?? ""}
            onChange={(e) => onChange({ location: e.target.value })}
            disabled={pending}
            placeholder="e.g. Round-table centre"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
      </div>
      {/* Row 2 — who from / what to do: source | pack-down plan */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-6">
          <Label>Source / supplier</Label>
          <input
            value={item.source ?? ""}
            onChange={(e) => onChange({ source: e.target.value })}
            disabled={pending}
            list={`setup-suppliers-${item.id}`}
            placeholder="e.g. Paintbox Blooms"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
          <datalist id={`setup-suppliers-${item.id}`}>
            {supplierNames.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </FieldLabel>
        <FieldLabel className="sm:col-span-6">
          <Label>Pack-down plan</Label>
          <input
            value={item.packDownPlan ?? ""}
            onChange={(e) => onChange({ packDownPlan: e.target.value })}
            disabled={pending}
            placeholder="e.g. Bridesmaids take to best man's car"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
      </div>
      {/* Row 3 — website */}
      <FieldLabel>
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
      <div className="flex items-center justify-between gap-2 pt-1 text-xs">
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={item.packed}
              onChange={(e) => onChange({ packed: e.target.checked })}
              disabled={pending}
            />
            <span className="text-ink-secondary">Packed</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={item.placed}
              onChange={(e) => onChange({ placed: e.target.checked })}
              disabled={pending}
            />
            <span className="text-ink-secondary">Placed</span>
          </label>
        </div>
        <div className="flex gap-1">
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

// ── Small helpers ─────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas border border-border-soft rounded-md px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-ink-tertiary font-bold">
        {label}
      </div>
      <div className="text-sm font-semibold text-ink-primary tabular-nums">{value}</div>
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
    <FieldLabel>
      <Label>{label}</Label>
      {children}
      {hint && <span className="block text-[10px] text-ink-tertiary mt-0.5">{hint}</span>}
    </FieldLabel>
  );
}
