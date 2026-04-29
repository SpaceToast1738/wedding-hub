"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { addBookOutfit, deleteBookOutfit, updateBookOutfit } from "../actions";
import { CardChrome } from "./CardChrome";

type Outfit = {
  id: string;
  personName: string;
  role: string | null;
  items: string[];
  supplier: string | null;
  status: string | null;
  notes: string | null;
  order: number;
};

// v1.26.0: OUTFIT card editor. Same row-based UX as the shot list,
// just with outfit fields. Each outfit row shows person + role +
// items inline; expand to edit. Items list is comma-separated free
// text in the form (parsed into an array on save).

export function BookOutfitCardEditor({
  subsectionId,
  slug,
  title,
  cardId,
  outfits,
  visibility,
  canEdit,
  isCouple,
}: {
  subsectionId: string;
  slug: string;
  title: string;
  cardId: string;
  outfits: Outfit[];
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
}) {
  const [adding, setAdding] = useState(false);

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
      {outfits.length === 0 && !canEdit ? (
        <p className="text-xs text-ink-tertiary italic">No outfits yet.</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {outfits.map((o) => (
            <OutfitRow key={o.id} outfit={o} canEdit={canEdit} />
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-3">
          {adding ? (
            <OutfitForm
              cardId={cardId}
              onClose={() => setAdding(false)}
              submitLabel="Add outfit"
            />
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
              + Add outfit
            </Button>
          )}
        </div>
      )}
    </CardChrome>
  );
}

function OutfitRow({ outfit, canEdit }: { outfit: Outfit; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Delete outfit for "${outfit.personName}"?`)) return;
    startTransition(async () => {
      const res = await deleteBookOutfit(outfit.id);
      if (!res.ok) notify("error", res.error);
    });
  }

  if (editing) {
    return (
      <li className="py-2">
        <OutfitForm
          outfitId={outfit.id}
          initial={outfit}
          onClose={() => setEditing(false)}
          submitLabel="Save"
        />
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 py-2 group">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-primary">
          {outfit.personName}
          {outfit.role && (
            <span className="text-ink-tertiary font-normal text-[11px] ml-2 uppercase tracking-wider">
              {outfit.role}
            </span>
          )}
        </div>
        {outfit.items.length > 0 && (
          <div className="text-[11px] text-ink-secondary mt-0.5">
            {outfit.items.join(" · ")}
          </div>
        )}
        <div className="text-[11px] text-ink-tertiary mt-0.5 flex flex-wrap gap-x-2">
          {outfit.supplier && <span>🛍 {outfit.supplier}</span>}
          {outfit.status && <span>· {outfit.status}</span>}
        </div>
        {outfit.notes && (
          <div className="text-[11px] text-ink-tertiary italic mt-0.5">
            {outfit.notes}
          </div>
        )}
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

function OutfitForm({
  outfitId,
  cardId,
  initial,
  onClose,
  submitLabel,
}: {
  outfitId?: string;
  cardId?: string;
  initial?: Outfit;
  onClose: () => void;
  submitLabel: string;
}) {
  const [personName, setPersonName] = useState(initial?.personName ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [items, setItems] = useState(initial?.items.join(", ") ?? "");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [status, setStatus] = useState(initial?.status ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!personName.trim()) return;
    const fd = new FormData();
    fd.set("personName", personName);
    fd.set("role", role);
    fd.set("items", items);
    fd.set("supplier", supplier);
    fd.set("status", status);
    fd.set("notes", notes);
    startTransition(async () => {
      const res = outfitId
        ? await updateBookOutfit(outfitId, fd)
        : cardId
          ? await addBookOutfit(cardId, fd)
          : { ok: false as const, error: "No outfit card" };
      if (res.ok) onClose();
      else notify("error", res.error);
    });
  }

  return (
    <div className="bg-canvas/40 border border-border-soft rounded-md p-3 space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          placeholder="Person (e.g. Bryony)"
          maxLength={100}
          disabled={pending}
          className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role (Bride / Groom / Best man / …)"
          maxLength={200}
          disabled={pending}
          className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
      </div>
      <input
        type="text"
        value={items}
        onChange={(e) => setItems(e.target.value)}
        placeholder="Items (comma-separated): Charcoal three-piece, White shirt, Burgundy tie…"
        disabled={pending}
        className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <div className="grid sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          placeholder="Supplier"
          maxLength={200}
          disabled={pending}
          className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
        <input
          type="text"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="Status (Ordered / Fitted / Collected)"
          maxLength={200}
          disabled={pending}
          className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={2}
        maxLength={2000}
        disabled={pending}
        className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500 resize-y"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={submit}
          disabled={pending || !personName.trim()}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
