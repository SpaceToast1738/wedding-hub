"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { assignGuestToSeat, deleteTable, updateTableCapacity } from "./actions";

type Seat = { id: string; index: number; guest: { id: string; firstName: string; lastName: string } | null };
type Table = { id: string; name: string; shape: string; capacity: number; seats: Seat[] };
type GuestOpt = {
  id: string;
  firstName: string;
  lastName: string;
  rsvp?: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
};

// v1.22.6: prefix pending/maybe entries with their tag so the planner
// can see at-a-glance which dropdown picks haven't RSVP'd. Attending
// stays clean (no prefix — most rows).
function guestOptionLabel(g: GuestOpt): string {
  const name = `${g.firstName} ${g.lastName}`;
  if (g.rsvp === "PENDING") return `? ${name}`;
  if (g.rsvp === "MAYBE") return `~ ${name}`;
  return name;
}

export function TableCard({
  table,
  unseatedGuests,
  canEdit,
}: {
  table: Table;
  unseatedGuests: GuestOpt[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const assigned = table.seats.filter((s) => s.guest).length;

  function onDelete() {
    if (!confirm(`Delete table "${table.name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteTable(table.id);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't delete table");
      }
    });
  }

  function onAssign(seatId: string, guestId: string) {
    startTransition(async () => {
      try {
        await assignGuestToSeat(seatId, guestId || null);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't assign seat");
      }
    });
  }

  // v1.22.6: capacity +/- buttons. Server-side action enforces "must be
  // empty to remove" — we surface the error via notify if it throws.
  function onCapacity(delta: 1 | -1) {
    const next = table.capacity + delta;
    if (next < 1 || next > 40) return;
    startTransition(async () => {
      try {
        await updateTableCapacity(table.id, next);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't change capacity");
      }
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
        <div>
          <h2 className="text-sm font-semibold text-ink-primary">{table.name}</h2>
          <div className="text-[11px] text-ink-tertiary flex items-center gap-1.5">
            <span>{table.shape.toLowerCase()} · {assigned}/{table.capacity} seated</span>
            {canEdit && (
              <span className="inline-flex items-center gap-0.5 ml-1">
                <button
                  type="button"
                  onClick={() => onCapacity(-1)}
                  disabled={pending || table.capacity <= 1}
                  className="w-4 h-4 leading-none rounded-sm border border-border-soft bg-canvas hover:border-moss-300 disabled:opacity-40 disabled:cursor-not-allowed text-ink-secondary"
                  aria-label="Remove a seat"
                  title="Remove a seat (must be empty)"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => onCapacity(1)}
                  disabled={pending || table.capacity >= 40}
                  className="w-4 h-4 leading-none rounded-sm border border-border-soft bg-canvas hover:border-moss-300 disabled:opacity-40 disabled:cursor-not-allowed text-ink-secondary"
                  aria-label="Add a seat"
                  title="Add a seat"
                >
                  +
                </button>
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>Delete</Button>
        )}
      </header>
      <ul className="divide-y divide-border-soft">
        {table.seats.map((seat) => (
          <li key={seat.id} className="flex items-center gap-3 px-4 py-2">
            <span className="text-[10px] text-ink-tertiary w-6">#{seat.index + 1}</span>
            {canEdit ? (
              <select
                value={seat.guest?.id ?? ""}
                disabled={pending}
                onChange={(e) => onAssign(seat.id, e.target.value)}
                className="flex-1 text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none"
              >
                <option value="">— empty —</option>
                {seat.guest && (
                  <option value={seat.guest.id}>
                    {seat.guest.firstName} {seat.guest.lastName}
                  </option>
                )}
                {unseatedGuests.map((g) => (
                  <option key={g.id} value={g.id}>{guestOptionLabel(g)}</option>
                ))}
              </select>
            ) : (
              <span className="flex-1 text-sm text-ink-primary">
                {seat.guest ? `${seat.guest.firstName} ${seat.guest.lastName}` : <span className="text-ink-tertiary italic">empty</span>}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
