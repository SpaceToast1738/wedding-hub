"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { hardDeleteGuest, restoreGuest } from "./actions";

type ArchivedGuest = {
  id: string;
  firstName: string;
  lastName: string;
  householdName: string;
  householdId: string;
  updatedAt: Date;
};

function formatRelativeDate(d: Date): string {
  const now = Date.now();
  const diffMs = now - new Date(d).getTime();
  const days = Math.round(diffMs / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ArchivedGuestList({
  guests,
  canEdit,
  canHardDelete,
}: {
  guests: ArchivedGuest[];
  canEdit: boolean;
  canHardDelete: boolean;
}) {
  if (guests.length === 0) {
    return (
      <div className="bg-surface border border-border-soft rounded-md shadow-sm px-6 py-12 text-center">
        <p className="text-sm text-ink-tertiary italic">
          Nothing archived. Anyone you delete on the main list lands here, and
          can be restored before you permanently remove them.
        </p>
      </div>
    );
  }

  return (
    <ul className="bg-surface border border-border-soft rounded-md shadow-sm divide-y divide-border-soft">
      {guests.map((g) => (
        <ArchivedRow
          key={g.id}
          guest={g}
          canEdit={canEdit}
          canHardDelete={canHardDelete}
        />
      ))}
    </ul>
  );
}

function ArchivedRow({
  guest,
  canEdit,
  canHardDelete,
}: {
  guest: ArchivedGuest;
  canEdit: boolean;
  canHardDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function onRestore() {
    startTransition(async () => {
      await restoreGuest(guest.id);
    });
  }

  function onHardDelete() {
    if (
      !confirm(
        `Permanently delete ${guest.firstName} ${guest.lastName}? This cannot be undone — the row, RSVP history, song requests, and all related data will be removed from the database.`,
      )
    )
      return;
    startTransition(async () => {
      await hardDeleteGuest(guest.id);
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink-primary">
          {guest.firstName} {guest.lastName}
        </div>
        <div className="text-[11px] text-ink-tertiary">
          <Link
            href={`/guests/${guest.id}`}
            className="hover:text-moss-700 hover:underline"
          >
            {guest.householdName}
          </Link>
          {" · archived "}
          {formatRelativeDate(new Date(guest.updatedAt))}
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-1.5 flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRestore}
            disabled={pending}
            title="Bring this guest back to the active list (unseated)"
          >
            Restore
          </Button>
          {canHardDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onHardDelete}
              disabled={pending}
              title="Permanently delete this row from the database — couple-only"
            >
              Delete forever
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
