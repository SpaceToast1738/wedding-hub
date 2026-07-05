"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { GuestForm } from "../GuestForm";
import { deleteGuest, setGuestRsvp, updateGuest } from "../actions";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/notify";
import type { RsvpStatus, Side } from "@prisma/client";

// v2.5.1 (finding #5): segmented pill options for the RSVP control —
// replaces the ~22px plain <select>.
const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "ATTENDING", label: "Attending" },
  { value: "PENDING", label: "Pending" },
  { value: "DECLINED", label: "Declined" },
  { value: "MAYBE", label: "Maybe" },
];

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
  const confirm = useConfirm();
  // v2.5.1 (finding #5): optimistic local RSVP state — the pill flips
  // immediately instead of visibly snapping back on a slow connection
  // until the page revalidates. Re-syncs if the server-confirmed value
  // arrives via a fresh `guest` prop (e.g. another tab changed it).
  const [localRsvp, setLocalRsvp] = useState<RsvpStatus>(guest.rsvp);
  useEffect(() => {
    setLocalRsvp(guest.rsvp);
  }, [guest.rsvp]);

  function changeRsvp(next: RsvpStatus) {
    if (next === localRsvp || pending) return;
    const previous = localRsvp;
    setLocalRsvp(next);
    startTransition(async () => {
      try {
        await setGuestRsvp(guest.id, next);
        const label = RSVP_OPTIONS.find((o) => o.value === next)?.label ?? next;
        notify(
          "success",
          guest.plusOneAllowed
            ? `RSVP set to ${label} (their plus-one, if named, follows automatically)`
            : `RSVP set to ${label}`,
        );
      } catch (err) {
        setLocalRsvp(previous);
        notify("error", err instanceof Error ? err.message : "Couldn't update RSVP");
      }
    });
  }

  async function onDelete() {
    if (!(await confirm({
      title: `Delete ${guest.firstName} ${guest.lastName}?`,
      body: "Their song requests and seat assignment will also be removed.",
      confirmLabel: "Delete",
      tone: "danger",
    }))) return;
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
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-ink-primary">RSVP</h2>
          {/* v2.5.1 (finding #5): segmented pills at a proper touch
              height, replacing the ~22px plain <select> — this is the
              single most-used action in this area. */}
          <div className="inline-flex flex-wrap gap-1" role="group" aria-label="RSVP status">
            {RSVP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => changeRsvp(opt.value)}
                disabled={pending}
                aria-pressed={localRsvp === opt.value}
                className={[
                  "text-xs font-medium px-3 py-1.5 min-h-[40px] sm:min-h-0 rounded-full border transition-colors disabled:cursor-not-allowed",
                  localRsvp === opt.value
                    ? "bg-moss-500 text-on-moss border-moss-500"
                    : "bg-canvas text-ink-secondary border-border-soft hover:border-moss-300 hover:text-moss-700",
                  pending ? "opacity-60" : "",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
