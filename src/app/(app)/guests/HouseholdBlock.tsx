"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import { GuestForm } from "./GuestForm";
import { createGuest, deleteGuest, deleteHousehold, setGuestRsvp, updateGuest, updateHousehold } from "./actions";
import type { RsvpStatus, Side } from "@prisma/client";

type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  rsvp: RsvpStatus;
  side: Side;
  isChild: boolean;
  needsHighchair: boolean;
  childrenMeal?: boolean;
  plusOneAllowed: boolean;
  plusOneName: string | null;
  role: string | null;
  dietary: string[];
  mealStarter?: string | null;
  mealMain?: string | null;
  mealDessert?: string | null;
  rsvpUniqueLink?: string | null;
  notes: string | null;
  tableSeat?: {
    id: string;
    index: number;
    table: { id: string; name: string };
  } | null;
  _count?: { songRequests: number };
};

type Household = {
  id: string;
  name: string;
  side: Side;
  notes: string | null;
  guests: Guest[];
};

const RSVP_PILL: Record<string, "YES" | "NO" | "PENDING"> = {
  ATTENDING: "YES",
  DECLINED: "NO",
  MAYBE: "PENDING",
  PENDING: "PENDING",
};

export function HouseholdBlock({ household, canEdit }: { household: Household; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editingHh, setEditingHh] = useState(false);
  const [pending, startTransition] = useTransition();

  const summary = household.guests.reduce(
    (acc, g) => {
      if (g.rsvp === "ATTENDING") acc.attending++;
      else if (g.rsvp === "DECLINED") acc.declined++;
      else acc.pending++;
      return acc;
    },
    { attending: 0, declined: 0, pending: 0 },
  );

  function onDeleteHousehold() {
    if (household.guests.length > 0) {
      if (!confirm(`Household "${household.name}" has ${household.guests.length} guests. Delete everything?`)) return;
    } else {
      if (!confirm(`Delete household "${household.name}"?`)) return;
    }
    startTransition(async () => { await deleteHousehold(household.id); });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-soft">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-primary truncate">{household.name}</h2>
            <span className="text-[10px] text-ink-tertiary bg-canvas border border-border-soft px-1.5 py-px rounded-md uppercase tracking-wider">{household.side.toLowerCase()}</span>
          </div>
          <div className="text-[11px] text-ink-tertiary mt-0.5">
            {household.guests.length} guest{household.guests.length === 1 ? "" : "s"}
            {summary.attending > 0 && ` · ${summary.attending} attending`}
            {summary.declined > 0 && ` · ${summary.declined} declined`}
            {summary.pending > 0 && ` · ${summary.pending} pending`}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)} disabled={pending}>+ Guest</Button>
            <Button variant="ghost" size="sm" onClick={() => setEditingHh(true)} disabled={pending}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={onDeleteHousehold} disabled={pending}>Delete</Button>
          </div>
        )}
      </header>

      {editingHh && (
        <div className="px-4 py-3 border-b border-border-soft bg-moss-50/30">
          <HouseholdEditForm household={household} onDone={() => setEditingHh(false)} />
        </div>
      )}

      <ul className="divide-y divide-border-soft">
        {household.guests.map((g) => (
          <GuestRow key={g.id} guest={g} householdId={household.id} canEdit={canEdit} />
        ))}
        {household.guests.length === 0 && !adding && (
          <li className="px-4 py-3 text-xs text-ink-tertiary italic text-center">No guests yet.</li>
        )}
        {adding && (
          <li className="px-4 py-3 bg-moss-50/30">
            <GuestForm
              householdId={household.id}
              submitLabel="Add"
              onSubmit={async (fd) => { await createGuest(fd); setAdding(false); }}
              onCancel={() => setAdding(false)}
            />
          </li>
        )}
      </ul>
    </section>
  );

  function GuestRow({ guest, householdId, canEdit }: { guest: Guest; householdId: string; canEdit: boolean }) {
    const [editing, setEditing] = useState(false);
    const [pending, startTransition] = useTransition();

    function changeRsvp(next: RsvpStatus) {
      startTransition(async () => { await setGuestRsvp(guest.id, next); });
    }

    function onDelete() {
      if (!confirm(`Delete ${guest.firstName} ${guest.lastName}?`)) return;
      startTransition(async () => { await deleteGuest(guest.id); });
    }

    if (editing) {
      return (
        <li className="px-4 py-3 bg-moss-50/30">
          <GuestForm
            householdId={householdId}
            submitLabel="Save"
            initial={{
              firstName: guest.firstName,
              lastName: guest.lastName,
              email: guest.email ?? "",
              phone: guest.phone ?? "",
              rsvp: guest.rsvp,
              side: guest.side,
              isChild: guest.isChild,
              needsHighchair: guest.needsHighchair,
              plusOneAllowed: guest.plusOneAllowed,
              plusOneName: guest.plusOneName ?? "",
              role: guest.role ?? "",
              dietary: guest.dietary.join(", "),
              notes: guest.notes ?? "",
            }}
            onSubmit={async (fd) => { await updateGuest(guest.id, fd); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        </li>
      );
    }

    return (
      <li className="flex items-center gap-3 px-4 py-2.5 group">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm text-ink-primary">{guest.firstName} {guest.lastName}</span>
            {guest.isChild && <span className="text-[10px] text-marigold-700 bg-marigold-100 px-1 rounded">Child</span>}
            {guest.needsHighchair && <span className="text-[10px] text-marigold-700 bg-marigold-100 px-1 rounded">Highchair</span>}
            {guest.childrenMeal && <span className="text-[10px] text-marigold-700 bg-marigold-100 px-1 rounded">Kids meal</span>}
            {guest.role && <span className="text-[10px] text-moss-700 bg-moss-50 border border-moss-100 px-1 rounded">{guest.role}</span>}
            {guest.plusOneAllowed && (
              <span className="text-[10px] text-ink-tertiary bg-canvas border border-border-soft px-1 rounded">
                +1{guest.plusOneName ? ` (${guest.plusOneName})` : ""}
              </span>
            )}
            {guest.tableSeat && (
              <Link
                href="/seating"
                className="text-[10px] text-info bg-[color:#eef4f5] dark:bg-muted border border-[color:#d0e4e8] dark:border-border-soft px-1 rounded hover:underline"
                title={`Seat ${guest.tableSeat.index + 1} on the seating canvas`}
              >
                ⊛ {guest.tableSeat.table.name}
              </Link>
            )}
            {guest._count && guest._count.songRequests > 0 && (
              <Link
                href="/songs"
                className="text-[10px] text-info bg-[color:#eef4f5] dark:bg-muted border border-[color:#d0e4e8] dark:border-border-soft px-1 rounded hover:underline"
                title={`${guest._count.songRequests} song request${guest._count.songRequests === 1 ? "" : "s"}`}
              >
                ♪ {guest._count.songRequests}
              </Link>
            )}
            {guest.rsvpUniqueLink && (
              <a
                href={guest.rsvpUniqueLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-ink-tertiary bg-canvas border border-border-soft px-1 rounded hover:text-moss-700 hover:border-moss-300"
                title="RSVP link (opens externally)"
              >
                🔗 RSVP
              </a>
            )}
          </div>
          {(guest.email || guest.phone || guest.dietary.length > 0) && (
            <div className="text-[11px] text-ink-tertiary mt-0.5 truncate">
              {guest.email && <>{guest.email}</>}
              {guest.email && guest.phone && " · "}
              {guest.phone && <>{guest.phone}</>}
              {guest.dietary.length > 0 && <> · Dietary: {guest.dietary.join(", ")}</>}
            </div>
          )}
          {(guest.mealStarter || guest.mealMain || guest.mealDessert) && (
            <div className="text-[11px] text-ink-tertiary mt-0.5 truncate">
              {guest.mealStarter && <span title={guest.mealStarter}>🍲 {guest.mealStarter.split(/\s+/).slice(0, 3).join(" ")}{guest.mealStarter.split(/\s+/).length > 3 ? "…" : ""}</span>}
              {guest.mealStarter && (guest.mealMain || guest.mealDessert) && " · "}
              {guest.mealMain && <span title={guest.mealMain}>🍽 {guest.mealMain.split(/\s+/).slice(0, 3).join(" ")}{guest.mealMain.split(/\s+/).length > 3 ? "…" : ""}</span>}
              {guest.mealMain && guest.mealDessert && " · "}
              {guest.mealDessert && <span title={guest.mealDessert}>🍰 {guest.mealDessert.split(/\s+/).slice(0, 3).join(" ")}{guest.mealDessert.split(/\s+/).length > 3 ? "…" : ""}</span>}
            </div>
          )}
        </div>
        <select
          value={guest.rsvp}
          disabled={!canEdit || pending}
          onChange={(e) => changeRsvp(e.target.value as RsvpStatus)}
          className="text-xs bg-canvas border border-border-soft rounded-sm px-1.5 py-0.5 text-ink-secondary outline-none disabled:opacity-50"
        >
          <option value="PENDING">Pending</option>
          <option value="ATTENDING">Attending</option>
          <option value="DECLINED">Declined</option>
          <option value="MAYBE">Maybe</option>
        </select>
        <StatusPill status={RSVP_PILL[guest.rsvp] ?? "PENDING"} size="sm" />
        {canEdit && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>×</Button>
          </div>
        )}
      </li>
    );
  }
}

function HouseholdEditForm({ household, onDone }: { household: Household; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd) => startTransition(async () => { await updateHousehold(household.id, fd); onDone(); })}
      className="space-y-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Input name="name" required defaultValue={household.name} placeholder="Household name" className="sm:col-span-2" />
        <select name="side" defaultValue={household.side} className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none">
          <option value="BRIDE">Bride</option>
          <option value="GROOM">Groom</option>
          <option value="BOTH">Both</option>
        </select>
      </div>
      <textarea name="notes" rows={2} defaultValue={household.notes ?? ""} placeholder="Notes (optional)"
        className="w-full text-xs bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500" />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
