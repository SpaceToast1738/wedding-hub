"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { GuestForm } from "../GuestForm";
import { deleteGuest, setGuestRsvp, updateGuest } from "../actions";
import type { RsvpStatus, Side } from "@prisma/client";

type GuestSnapshot = {
  id: string;
  householdId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  rsvp: RsvpStatus;
  side: Side;
  isChild: boolean;
  needsHighchair: boolean;
  plusOneAllowed: boolean;
  plusOneName: string | null;
  role: string | null;
  dietary: string;
  notes: string | null;
};

export function GuestDetailClient({
  guest,
  canEdit,
}: {
  guest: GuestSnapshot;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function changeRsvp(next: RsvpStatus) {
    startTransition(async () => {
      await setGuestRsvp(guest.id, next);
    });
  }

  function onDelete() {
    if (!confirm(`Delete ${guest.firstName} ${guest.lastName}? Their song requests and seat assignment will also be removed.`)) return;
    startTransition(async () => {
      await deleteGuest(guest.id);
      router.push("/guests");
    });
  }

  if (!canEdit) {
    return (
      <section className="bg-surface border border-border-soft rounded-md shadow-sm">
        <header className="px-4 py-3 border-b border-border-soft flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-primary">RSVP</h2>
          <span className="text-[11px] text-ink-tertiary capitalize">
            {guest.rsvp.toLowerCase()}
          </span>
        </header>
        <p className="px-4 py-3 text-xs text-ink-tertiary italic">
          You don&apos;t have edit access for guests.
        </p>
      </section>
    );
  }

  if (editing) {
    return (
      <section className="bg-surface border border-border-soft rounded-md shadow-sm">
        <header className="px-4 py-3 border-b border-border-soft">
          <h2 className="text-sm font-semibold text-ink-primary">Edit guest</h2>
        </header>
        <div className="p-4">
          <GuestForm
            householdId={guest.householdId}
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
              dietary: guest.dietary,
              notes: guest.notes ?? "",
            }}
            onSubmit={async (fd) => {
              await updateGuest(guest.id, fd);
              setEditing(false);
              router.refresh();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-ink-primary">RSVP</h2>
          <select
            value={guest.rsvp}
            onChange={(e) => changeRsvp(e.target.value as RsvpStatus)}
            disabled={pending}
            className="text-xs bg-canvas border border-border-soft rounded-sm px-1.5 py-0.5 text-ink-secondary outline-none disabled:opacity-50"
          >
            <option value="PENDING">Pending</option>
            <option value="ATTENDING">Attending</option>
            <option value="DECLINED">Declined</option>
            <option value="MAYBE">Maybe</option>
          </select>
        </div>
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)} disabled={pending}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
            Delete
          </Button>
        </div>
      </header>
    </section>
  );
}
