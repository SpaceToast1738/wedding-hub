"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { notify } from "@/lib/notify";
import {
  saveStayCard,
  attachFileToStayCard,
  detachFileFromStayCard,
  uploadAndAttachStayFile,
  setBookSubsectionHeaderFileId,
  setBookSubsectionHeaderPosition,
  setBookSubsectionPhotoDisplay,
  setBookSubsectionPhotoSize,
  setBookSubsectionSlideshowAuto,
  type StaySavePayload,
} from "../actions";
import { stayRollups } from "@/lib/book-cards";
import { CardChrome } from "./CardChrome";
import {
  ImageGallery,
  type GalleryDisplay,
  type GallerySize,
  type HeaderPosition,
} from "@/components/ui/ImageGallery";
import {
  FieldLabel,
  Label,
  formatGBPFromPence,
  penceToPoundsString,
  poundsStringToPence,
} from "./bookCardUi";

// v1.36.0 (P6): STAY card — one accommodation booking the couple
// pays for. Single bulk save, View / Edit pattern per §10a. Occupants
// is free-text array (chips); guestIds links to existing Guest rows
// for the reverse query in P7's guest detail panel.

const PAID_BY_OPTIONS = ["Couple", "Self", "Parents", "Other"];

type GuestOpt = { id: string; name: string };

type CardData = {
  id: string;
  propertyName: string | null;
  propertyContact: string | null;
  bookingReference: string | null;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  costPence: number | null;
  paidBy: string | null;
  paid: boolean;
  occupants: string[];
  guestIds: string[];
  notes: string | null;
  /** v1.63.0: photo gallery — File ids attached to this card. */
  fileIds: string[];
  /** v1.99.4: gallery layout props (live on BookSubsection). */
  photoSize: GallerySize;
  photoDisplay: GalleryDisplay;
  headerFileId: string | null;
  headerPosition: HeaderPosition;
  slideshowAuto: boolean;
};

type StayCardProps = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  /** v1.76.0: gates Cost stat + cost input in edit mode. Hidden
   *  values preserved via draft state. */
  showMoney?: boolean;
  card: CardData;
  /** All non-archived guests, surfaced in the "linked guests" picker. */
  guests: GuestOpt[];
  /** v1.63.0: file list for the photo gallery. */
  files: Array<{ id: string; name: string; mimeType: string }>;
};

function isoDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function BookStayCard({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  isCouple,
  showMoney = true,
  card,
  guests,
  files,
}: StayCardProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => buildDraft(card));
  const router = useRouter();
  // v1.98.1: gated on !editing — see BookOutfitCard for the bug
  // context (router.refresh during edit mode wipes the draft).
  useEffect(() => {
    if (!editing) setDraft(buildDraft(card));
  }, [card, editing]);

  // v1.99.4: gallery handlers — same router.refresh pattern as OUTFIT.
  function changePhotoSize(next: GallerySize) {
    startTransition(async () => {
      const res = await setBookSubsectionPhotoSize(subsectionId, next);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
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
  function changeHeaderPosition(next: HeaderPosition) {
    startTransition(async () => {
      const res = await setBookSubsectionHeaderPosition(subsectionId, next);
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

  function cancel() {
    setDraft(buildDraft(card));
    setEditing(false);
  }

  function save() {
    const payload: StaySavePayload = {
      propertyName: draft.propertyName.trim() || null,
      propertyContact: draft.propertyContact.trim() || null,
      bookingReference: draft.bookingReference.trim() || null,
      checkInDate: draft.checkInDate || null,
      checkOutDate: draft.checkOutDate || null,
      costPence: draft.costPence,
      paidBy: draft.paidBy || null,
      paid: draft.paid,
      occupants: draft.occupants
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
      guestIds: draft.guestIds,
      notes: draft.notes.trim() || null,
    };
    startTransition(async () => {
      const res = await saveStayCard(subsectionId, payload);
      if (res.ok) {
        notify("success", "Saved");
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  const r = stayRollups({
    checkInDate: card.checkInDate,
    checkOutDate: card.checkOutDate,
    costPence: card.costPence,
    paid: card.paid,
  });
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const linkedGuests = card.guestIds
    .map((id) => guestById.get(id))
    .filter((g): g is GuestOpt => Boolean(g));

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Stay"
    >
      {/* Property header */}
      <div className="mb-4 flex items-baseline gap-2 flex-wrap">
        <span className="text-base font-semibold text-ink-primary">
          {card.propertyName || (
            <span className="text-ink-tertiary italic">No property set</span>
          )}
        </span>
        {r.phase && (
          <span
            className={[
              "text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border",
              r.phase === "upcoming"
                ? "bg-info/10 border-info/30 text-info"
                : r.phase === "current"
                  ? "bg-moss-50 border-moss-300 text-moss-700"
                  : "bg-canvas border-border-soft text-ink-tertiary",
            ].join(" ")}
          >
            {r.phase}
          </span>
        )}
      </div>

      {/* Stats strip */}
      <div className={`grid grid-cols-2 ${showMoney ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-2 mb-4`}>
        <Stat
          label="Check-in"
          value={
            card.checkInDate
              ? `${shortDate(card.checkInDate)}${
                  r.daysToCheckIn != null
                    ? ` (${r.daysToCheckIn >= 0 ? `${r.daysToCheckIn}d` : `${-r.daysToCheckIn}d ago`})`
                    : ""
                }`
              : "—"
          }
        />
        <Stat
          label="Check-out"
          value={card.checkOutDate ? shortDate(card.checkOutDate) : "—"}
        />
        {showMoney && <Stat label="Cost" value={formatGBPFromPence(card.costPence)} />}
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
      </div>

      {r.nights != null && r.nights > 0 && (
        <p className="text-[11px] text-ink-tertiary mb-3">
          {r.nights} {r.nights === 1 ? "night" : "nights"}
          {card.bookingReference && (
            <>
              {" · "}
              <span>
                Booking ref{" "}
                <span className="text-ink-secondary font-medium">
                  {card.bookingReference}
                </span>
              </span>
            </>
          )}
        </p>
      )}

      {editing ? (
        <EditBody
          draft={draft}
          setDraft={setDraft}
          pending={pending}
          guests={guests}
          showMoney={showMoney}
        />
      ) : (
        <ViewBody
          card={card}
          linkedGuests={linkedGuests}
          subsectionId={subsectionId}
          canEdit={canEdit}
          editing={editing}
          pending={pending}
          files={files}
          onSizeChange={changePhotoSize}
          onDisplayChange={changePhotoDisplay}
          onHeaderPin={pinHeader}
          onHeaderPositionChange={changeHeaderPosition}
          onSlideshowAutoChange={toggleSlideshowAuto}
          onUpload={async (file) => {
            const fd = new FormData();
            fd.set("file", file);
            const res = await uploadAndAttachStayFile(subsectionId, fd);
            if (res.ok) notify("success", "Photo uploaded");
            else notify("error", res.error);
          }}
          onAttach={(fileId) => {
            startTransition(async () => {
              const res = await attachFileToStayCard(subsectionId, fileId);
              if (res.ok) notify("success", "Photo attached");
              else notify("error", res.error);
            });
          }}
          onDetach={(fileId) => {
            startTransition(async () => {
              const res = await detachFileFromStayCard(subsectionId, fileId);
              if (res.ok) notify("success", "Photo detached");
              else notify("error", res.error);
            });
          }}
        />
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

function ViewBody({
  card,
  linkedGuests,
  subsectionId,
  canEdit,
  editing,
  pending,
  files,
  onUpload,
  onAttach,
  onDetach,
  onSizeChange,
  onDisplayChange,
  onHeaderPin,
  onHeaderPositionChange,
  onSlideshowAutoChange,
}: {
  card: CardData;
  linkedGuests: GuestOpt[];
  subsectionId: string;
  canEdit: boolean;
  /** v1.99.4: edit gate for the gallery management chrome. */
  editing: boolean;
  pending: boolean;
  files: Array<{ id: string; name: string; mimeType: string }>;
  onUpload: (file: File) => Promise<void>;
  onAttach: (fileId: string) => void;
  onDetach: (fileId: string) => void;
  onSizeChange: (next: GallerySize) => void;
  onDisplayChange: (next: GalleryDisplay) => void;
  onHeaderPin: (fileId: string | null) => void;
  onHeaderPositionChange: (next: HeaderPosition) => void;
  onSlideshowAutoChange: (next: boolean) => void;
}) {
  void subsectionId;
  return (
    <div className="space-y-3">
      {card.propertyContact && (
        <div>
          <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
            Contact
          </strong>
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">
            {card.propertyContact}
          </p>
        </div>
      )}
      {(card.occupants.length > 0 || linkedGuests.length > 0) && (
        <div>
          <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
            Occupants ({card.occupants.length + linkedGuests.length})
          </strong>
          <ul className="flex flex-wrap gap-1.5">
            {linkedGuests.map((g) => (
              <li
                key={`g-${g.id}`}
                className="text-[11px] bg-moss-50 border border-moss-300 text-moss-700 rounded-full px-2 py-0.5"
              >
                {g.name}
              </li>
            ))}
            {card.occupants.map((o, i) => (
              <li
                key={`o-${i}`}
                className="text-[11px] bg-canvas border border-border-soft rounded-full px-2 py-0.5"
              >
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* v1.63.0: photo gallery — bridal suite, property exterior, etc. */}
      {(card.fileIds.length > 0 || canEdit) && (
        <div>
          <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
            Photos ({card.fileIds.length})
          </strong>
          <ImageGallery
            fileIds={card.fileIds}
            files={files}
            canEdit={canEdit}
            pending={pending}
            editMode={editing}
            size={card.photoSize}
            display={card.photoDisplay}
            headerFileId={card.headerFileId}
            headerPosition={card.headerPosition}
            slideshowAuto={card.slideshowAuto}
            onSizeChange={onSizeChange}
            onDisplayChange={onDisplayChange}
            onHeaderPin={onHeaderPin}
            onHeaderPositionChange={onHeaderPositionChange}
            onSlideshowAutoChange={onSlideshowAutoChange}
            onUpload={onUpload}
            onAttach={onAttach}
            onDetach={onDetach}
          />
        </div>
      )}
      {card.notes && (
        <div>
          <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
            Notes
          </strong>
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">
            {card.notes}
          </p>
        </div>
      )}
    </div>
  );
}

type Draft = {
  propertyName: string;
  propertyContact: string;
  bookingReference: string;
  checkInDate: string;
  checkOutDate: string;
  costPence: number | null;
  paidBy: string;
  paid: boolean;
  occupants: string[];
  guestIds: string[];
  notes: string;
};

function buildDraft(card: CardData): Draft {
  return {
    propertyName: card.propertyName ?? "",
    propertyContact: card.propertyContact ?? "",
    bookingReference: card.bookingReference ?? "",
    checkInDate: isoDate(card.checkInDate),
    checkOutDate: isoDate(card.checkOutDate),
    costPence: card.costPence,
    paidBy: card.paidBy ?? "",
    paid: card.paid,
    occupants: [...card.occupants],
    guestIds: [...card.guestIds],
    notes: card.notes ?? "",
  };
}

function EditBody({
  draft,
  setDraft,
  pending,
  guests,
  showMoney,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  pending: boolean;
  guests: GuestOpt[];
  showMoney: boolean;
}) {
  function patch(p: Partial<Draft>) {
    setDraft({ ...draft, ...p });
  }
  const [costStr, setCostStr] = useState(penceToPoundsString(draft.costPence));
  const [newOccupant, setNewOccupant] = useState("");
  function commitCost(s: string) {
    patch({ costPence: poundsStringToPence(s) });
  }
  function addOccupant() {
    const t = newOccupant.trim();
    if (!t) return;
    patch({ occupants: [...draft.occupants, t] });
    setNewOccupant("");
  }
  function removeOccupant(idx: number) {
    patch({ occupants: draft.occupants.filter((_, i) => i !== idx) });
  }
  function toggleGuest(id: string) {
    if (draft.guestIds.includes(id)) {
      patch({ guestIds: draft.guestIds.filter((g) => g !== id) });
    } else {
      patch({ guestIds: [...draft.guestIds, id] });
    }
  }

  return (
    <div className="space-y-4">
      {/* Property — name + booking ref */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-7">
          <Label>Property</Label>
          <input
            value={draft.propertyName}
            onChange={(e) => patch({ propertyName: e.target.value })}
            disabled={pending}
            placeholder="e.g. Alveston Manor — Bridal Suite"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-5">
          <Label>Booking ref</Label>
          <input
            value={draft.bookingReference}
            onChange={(e) => patch({ bookingReference: e.target.value })}
            disabled={pending}
            placeholder="e.g. AM-2026-09-25-0142"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
        <FieldLabel className="sm:col-span-6">
          <Label>Check-in</Label>
          <input
            type="date"
            value={draft.checkInDate}
            onChange={(e) => patch({ checkInDate: e.target.value })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
        <FieldLabel className="sm:col-span-6">
          <Label>Check-out</Label>
          <input
            type="date"
            value={draft.checkOutDate}
            onChange={(e) => patch({ checkOutDate: e.target.value })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </FieldLabel>
      </div>

      {/* Cost / paidBy / paid */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
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
                onBlur={() => commitCost(costStr)}
                disabled={pending}
                placeholder="0.00"
                className="w-full text-sm bg-surface border border-border-soft rounded-sm pl-5 pr-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 tabular-nums text-right"
              />
            </div>
          </FieldLabel>
        )}
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

      {/* Property contact */}
      <FieldLabel>
        <Label>Property contact</Label>
        <MentionableTextarea
          value={draft.propertyContact}
          onChange={(e) => patch({ propertyContact: e.target.value })}
          disabled={pending}
          rows={2}
          placeholder="Phone / email / address"
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
        />
      </FieldLabel>

      {/* Occupants — free text */}
      <div>
        <Label>Occupants (free text)</Label>
        <ul className="flex flex-wrap gap-1.5 mb-1.5">
          {draft.occupants.length === 0 && (
            <li className="text-xs text-ink-tertiary italic">
              None yet — names of people staying that aren&apos;t in the guest list (or in addition to it).
            </li>
          )}
          {draft.occupants.map((o, i) => (
            <li
              key={i}
              className="inline-flex items-center gap-1 text-[11px] bg-canvas border border-border-soft rounded-full px-2 py-0.5"
            >
              {o}
              <button
                type="button"
                onClick={() => removeOccupant(i)}
                disabled={pending}
                className="text-ink-tertiary hover:text-danger px-0.5"
                aria-label={`Remove ${o}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1.5">
          <input
            value={newOccupant}
            onChange={(e) => setNewOccupant(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOccupant();
              }
            }}
            disabled={pending}
            placeholder="e.g. Bryony's mum"
            className="flex-1 text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
          <Button variant="ghost" size="sm" onClick={addOccupant} disabled={pending || !newOccupant.trim()}>
            + Add
          </Button>
        </div>
      </div>

      {/* Linked guests — picker */}
      <div>
        <Label>Linked guests</Label>
        {guests.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">No guests yet — add them on /guests first.</p>
        ) : (
          <ul className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 border border-border-soft rounded-sm bg-canvas/40">
            {guests.map((g) => {
              const on = draft.guestIds.includes(g.id);
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
                        : "bg-surface border-border-soft text-ink-tertiary hover:text-ink-primary",
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

      <FieldLabel>
        <Label>Notes</Label>
        <MentionableTextarea
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          disabled={pending}
          rows={3}
          placeholder="Anything worth remembering — group rate, breakfast included, parking notes."
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
        />
      </FieldLabel>
    </div>
  );
}
