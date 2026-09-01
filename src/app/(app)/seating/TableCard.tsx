"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { assignGuestToSeat, deleteTable, updateTableCapacity, swapSeats } from "./actions";
import { HighChairIcon } from "./highchair";

type Seat = {
  id: string;
  index: number;
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    rsvp: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
    // v2.10.0: high-chair chip on the seat row + header count.
    needsHighchair: boolean;
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
  // Drag-to-reorder state: which seat ID is being dragged, which is hovered.
  const [draggingSeatId, setDraggingSeatId] = useState<string | null>(null);
  const [overSeatId, setOverSeatId] = useState<string | null>(null);

  const assigned = table.seats.filter((s) => s.guest).length;
  // v2.10.0: how many seated guests at this table need a high chair.
  const highChairs = table.seats.filter((s) => s.guest?.needsHighchair).length;

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

  function onDrop(toSeatId: string) {
    setOverSeatId(null);
    if (!draggingSeatId || draggingSeatId === toSeatId) {
      setDraggingSeatId(null);
      return;
    }
    const fromId = draggingSeatId;
    setDraggingSeatId(null);
    startTransition(async () => {
      const res = await swapSeats(fromId, toSeatId);
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink-primary">{table.name}</h2>
            <div className="text-[11px] text-ink-tertiary flex items-center gap-1.5">
              <span>{table.shape.toLowerCase()} · {assigned}/{table.capacity} seated</span>
              {highChairs > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-marigold-700"
                  title={`${highChairs} high chair${highChairs === 1 ? "" : "s"} needed at this table`}
                >
                  <HighChairIcon className="text-[13px]" title="High chairs at this table" />
                  ×{highChairs}
                </span>
              )}
            </div>
          </div>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>Delete</Button>
          )}
        </div>
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
        {table.seats.map((seat) => {
          const isDragging = draggingSeatId === seat.id;
          const isOver = overSeatId === seat.id && draggingSeatId !== seat.id;
          return (
            <li
              key={seat.id}
              onDragEnter={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setOverSeatId(seat.id);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => canEdit && onDrop(seat.id)}
              className={`flex items-center gap-2 px-4 py-2 transition-colors ${
                isDragging ? "opacity-40" : ""
              } ${isOver ? "bg-moss-50 ring-1 ring-inset ring-moss-400" : ""}`}
            >
              {canEdit && (
                <span
                  draggable
                  onDragStart={() => setDraggingSeatId(seat.id)}
                  onDragEnd={() => { setDraggingSeatId(null); setOverSeatId(null); }}
                  className="cursor-grab active:cursor-grabbing select-none text-ink-tertiary hover:text-ink-secondary flex-shrink-0 text-xs leading-none"
                  aria-label="Drag to reorder"
                  title="Drag to swap seats"
                >
                  ⣿
                </span>
              )}
              <span className="text-[10px] text-ink-tertiary w-5 flex-shrink-0 tabular-nums">
                #{seat.index + 1}
              </span>
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
                  {seat.guest
                    ? `${seat.guest.firstName} ${seat.guest.lastName}`
                    : <span className="text-ink-tertiary italic">empty</span>
                  }
                </span>
              )}
              {/* v2.10.0: high-chair marker for this seat's guest. */}
              {seat.guest?.needsHighchair && (
                <span
                  className="flex-shrink-0 text-marigold-700 text-base leading-none"
                  title={`${seat.guest.firstName} needs a high chair`}
                >
                  <HighChairIcon title={`${seat.guest.firstName} needs a high chair`} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
