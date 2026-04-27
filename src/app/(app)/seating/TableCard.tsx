"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { assignGuestToSeat, deleteTable } from "./actions";

type Seat = { id: string; index: number; guest: { id: string; firstName: string; lastName: string } | null };
type Table = { id: string; name: string; shape: string; capacity: number; seats: Seat[] };
type GuestOpt = { id: string; firstName: string; lastName: string; tableSeatId: string | null };

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
    startTransition(async () => { await deleteTable(table.id); });
  }

  function onAssign(seatId: string, guestId: string) {
    startTransition(async () => { await assignGuestToSeat(seatId, guestId || null); });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
        <div>
          <h2 className="text-sm font-semibold text-ink-primary">{table.name}</h2>
          <div className="text-[11px] text-ink-tertiary">
            {table.shape.toLowerCase()} · {assigned}/{table.capacity} seated
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
                  <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>
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
