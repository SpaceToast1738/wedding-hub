"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import { GuestForm } from "./GuestForm";
import { GuestGroupsControl, type GuestGroupSummary } from "@/components/ui/GuestGroupsControl";
import { createGuest, deleteGuest, deleteHousehold, setGuestRsvp, updateGuest, updateHousehold } from "./actions";
import { notify } from "@/lib/notify";
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
  parentGuestId: string | null;
  tableSeat?: {
    id: string;
    index: number;
    table: { id: string; name: string };
  } | null;
  _count?: { songRequests: number };
  // v1.49.0: each guest's current guest-group memberships. Loaded
  // by the guests page and threaded through HouseholdBlock so the
  // GuestGroupsControl can render chips + the manage popover
  // without an extra round-trip.
  groups?: { id: string }[];
};

// Reorder guests so each host is immediately followed by its +1 rows.
// The DB returns flat Guest rows ordered by isChild + firstName; we
// regroup so the visual hierarchy matches the data: parent → child.
function reorderHostsAndPlusOnes(guests: Guest[]): Guest[] {
  const byParent = new Map<string, Guest[]>();
  const hosts: Guest[] = [];
  for (const g of guests) {
    if (g.parentGuestId) {
      const list = byParent.get(g.parentGuestId) ?? [];
      list.push(g);
      byParent.set(g.parentGuestId, list);
    } else {
      hosts.push(g);
    }
  }
  // Orphan +1s (parent archived/deleted but child somehow remained):
  // append to the end so they're visible and can be cleaned up.
  const orphanPlusOnes = guests.filter(
    (g) => g.parentGuestId && !hosts.some((h) => h.id === g.parentGuestId),
  );
  return [
    ...hosts.flatMap((h) => [h, ...(byParent.get(h.id) ?? [])]),
    ...orphanPlusOnes,
  ];
}

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

export function HouseholdBlock({
  household,
  allGroups,
  canEdit,
}: {
  household: Household;
  allGroups: GuestGroupSummary[];
  canEdit: boolean;
}) {
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
    startTransition(async () => {
      // v1.53.0 (C1): result-shape — show real toast on failure.
      const res = await deleteHousehold(household.id);
      if (res.ok) notify("success", "Household deleted");
      else notify("error", res.error);
    });
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
        {reorderHostsAndPlusOnes(household.guests).map((g) => {
          const host = g.parentGuestId
            ? household.guests.find((h) => h.id === g.parentGuestId)
            : null;
          return (
            <GuestRow
              key={g.id}
              guest={g}
              host={host ? { firstName: host.firstName, lastName: host.lastName } : null}
              householdId={household.id}
              allGroups={allGroups}
              canEdit={canEdit}
            />
          );
        })}
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

  function GuestRow({
    guest,
    host,
    householdId,
    allGroups,
    canEdit,
  }: {
    guest: Guest;
    host: { firstName: string; lastName: string } | null;
    householdId: string;
    allGroups: GuestGroupSummary[];
    canEdit: boolean;
  }) {
    const [editing, setEditing] = useState(false);
    const [pending, startTransition] = useTransition();
    const isPlusOne = !!guest.parentGuestId;

    function changeRsvp(next: RsvpStatus) {
      startTransition(async () => { await setGuestRsvp(guest.id, next); });
    }

    function onDelete() {
      if (isPlusOne) {
        // Deleting a +1 directly is unusual — the host should normally
        // own the +1's lifecycle (toggle plusOneAllowed off on the host
        // to archive). But we allow it as an escape hatch.
        if (!confirm(`Archive +1 "${guest.firstName} ${guest.lastName}"? Their host's plusOneAllowed will stay on — toggling it off there is the cleaner path.`)) return;
      } else {
        if (!confirm(`Archive ${guest.firstName} ${guest.lastName}? Any +1 will be archived too.`)) return;
      }
      startTransition(async () => {
        // v1.53.0 (C1): result-shape.
        const res = await deleteGuest(guest.id);
        if (res.ok) notify("success", "Guest archived");
        else notify("error", res.error);
      });
    }

    if (editing) {
      return (
        <li className={`px-4 py-3 bg-moss-50/30 ${isPlusOne ? "pl-10" : ""}`}>
          <GuestForm
            householdId={householdId}
            submitLabel="Save"
            isPlusOne={isPlusOne}
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
      <li className={`flex items-center gap-3 px-4 py-2.5 group ${isPlusOne ? "pl-10 bg-canvas/40" : ""}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <Link
              href={`/guests/${guest.id}`}
              className="text-sm text-ink-primary hover:text-moss-700 hover:underline"
              title="Open guest details"
            >
              {guest.firstName} {guest.lastName}
            </Link>
            {isPlusOne && host && (
              <span
                className="text-[10px] text-info bg-[color:#eef4f5] dark:bg-muted border border-[color:#d0e4e8] dark:border-border-soft px-1 rounded"
                title={`+1 of ${host.firstName} ${host.lastName} — RSVP, household, and side cascade from the host`}
              >
                +1 of {host.firstName}
              </span>
            )}
            {guest.isChild && <span className="text-[10px] text-marigold-700 bg-marigold-100 px-1 rounded">Child</span>}
            {guest.needsHighchair && <span className="text-[10px] text-marigold-700 bg-marigold-100 px-1 rounded">Highchair</span>}
            {guest.childrenMeal && <span className="text-[10px] text-marigold-700 bg-marigold-100 px-1 rounded">Kids meal</span>}
            {guest.role && <span className="text-[10px] text-moss-700 bg-moss-50 border border-moss-100 px-1 rounded">{guest.role}</span>}
            {guest.plusOneAllowed && !isPlusOne && (
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
            {/* v1.49.0: guest-group memberships. Renders chips +
                a popover picker for adding/removing groups. Hidden
                entirely when there are no groups defined AND the
                guest isn't in any. */}
            {(allGroups.length > 0 || (guest.groups && guest.groups.length > 0)) && (
              <GuestGroupsControl
                guestId={guest.id}
                memberOf={(guest.groups ?? []).map((g) => g.id)}
                allGroups={allGroups}
                canEdit={canEdit}
                size="sm"
              />
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
