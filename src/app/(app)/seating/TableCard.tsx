"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { assignGuestToSeat, deleteTable, updateTableCapacity } from "./actions";

type Seat = {
  id: string;
  index: number;
  // v1.22.7: rsvp threaded through for canvas dot coloring; not used
  // here in the list view but the type matches Prisma's select.
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    rsvp: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
  } | null;
};
type ChecklistItem = { id: string; label: string; done: boolean };
type Table = {
  id: string;
  name: string;
  shape: string;
  capacity: number;
  seats: Seat[];
  notes: string | null;
  checklist: ChecklistItem[] | null;
};
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
  const confirm = useConfirm();
  const assigned = table.seats.filter((s) => s.guest).length;

  async function onDelete() {
    if (!(await confirm({ title: `Delete table "${table.name}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
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

  // v1.22.6: capacity +/- buttons. v1.22.9: action returns a result
  // object instead of throwing (see SeatingCanvas onCapacity for the
  // "why").
  function onCapacity(delta: 1 | -1) {
    const next = table.capacity + delta;
    if (next < 1 || next > 40) return;
    startTransition(async () => {
      try {
        const res = await updateTableCapacity(table.id, next);
        if (!res.ok) notify("error", res.error);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't change capacity");
      }
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink-primary">{table.name}</h2>
            <div className="text-[11px] text-ink-tertiary">
              {table.shape.toLowerCase()} · {assigned}/{table.capacity} seated
            </div>
          </div>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>Delete</Button>
          )}
        </div>
        {/* v1.22.7: visible capacity edit row, mirrors FocusPanel. */}
        {canEdit && (
          <div className="mt-3 flex items-center justify-between gap-2 bg-canvas/60 rounded-md px-3 py-2">
            <span className="text-[11px] uppercase tracking-wider font-bold text-ink-secondary">
              Seats
            </span>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCapacity(-1)}
                disabled={pending || table.capacity <= 1}
                className="w-7 h-7 rounded-md border border-border-soft bg-surface text-ink-primary text-base font-semibold leading-none hover:border-moss-500 hover:bg-moss-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface flex items-center justify-center"
                aria-label="Remove a seat"
                title="Remove a seat (must be empty)"
              >
                −
              </button>
              <span className="text-sm font-semibold text-ink-primary tabular-nums w-6 text-center">
                {table.capacity}
              </span>
              <button
                type="button"
                onClick={() => onCapacity(1)}
                disabled={pending || table.capacity >= 40}
                className="w-7 h-7 rounded-md border border-border-soft bg-surface text-ink-primary text-base font-semibold leading-none hover:border-moss-500 hover:bg-moss-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface flex items-center justify-center"
                aria-label="Add a seat"
                title="Add a seat"
              >
                +
              </button>
            </div>
          </div>
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
      {/* v1.23.0 mounted per-table notes + checklist here. v1.23.1
          moved both to a global panel above the canvas. */}
    </section>
  );
}
