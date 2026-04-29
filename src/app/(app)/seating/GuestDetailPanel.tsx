"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/StatusPill";
import type { AllGuest } from "./SeatingClient";

// v1.27.7: read-only summary panel for a focused seated guest.
// Opens when the planner clicks (no drag movement) a seated guest
// dot on the canvas. Mirrors the FocusPanelBody shape — emits only
// inner content; the outer card chrome is provided by the
// CollapsiblePanel wrapper in SeatingCanvas.
//
// Read-only by design: editing a guest is a multi-field affair best
// done on /guests/[id]. The "Open record →" link covers that path.
// Keeping this surface read-only also avoids a second copy of the
// guest-edit form maintained alongside the existing one.
export function GuestDetailPanel({
  guest,
  onClose,
}: {
  guest: AllGuest;
  onClose: () => void;
}) {
  const fullName = `${guest.firstName} ${guest.lastName}`;
  const rsvpLabel: "ATTENDING" | "PENDING" | "MED" =
    guest.rsvp === "ATTENDING"
      ? "ATTENDING"
      : guest.rsvp === "PENDING"
        ? "PENDING"
        : "MED"; // DECLINED + MAYBE fall back to a neutral pill
  return (
    <>
      <div className="px-4 pt-3 pb-2 border-b border-border-soft">
        <div className="flex items-center gap-2.5">
          <Avatar name={fullName} size={32} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink-primary truncate">
              {fullName}
            </div>
            <div className="text-[11px] text-ink-tertiary mt-0.5 flex items-center gap-1.5">
              <StatusPill status={rsvpLabel} size="sm" />
              {guest.isChild && (
                <span className="text-[10px] uppercase tracking-wider text-ink-tertiary bg-canvas border border-border-soft rounded-md px-1.5 py-0.5">
                  child
                </span>
              )}
              {guest.currentTableName && (
                <span className="truncate">at {guest.currentTableName}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 text-xs">
        {guest.householdName && (
          <Row label="Household" value={guest.householdName} />
        )}
        {guest.email && <Row label="Email" value={guest.email} />}
        {guest.plusOneAllowed && (
          <Row
            label="Plus-one"
            value={guest.plusOneName ?? "Allowed (no name yet)"}
          />
        )}
        {guest.dietary.length > 0 && (
          <div>
            <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
              Dietary
            </strong>
            <div className="flex flex-wrap gap-1">
              {guest.dietary.map((d) => (
                <span
                  key={d}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-canvas border border-border-soft text-ink-secondary"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}
        {guest.notes && (
          <div>
            <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
              Notes
            </strong>
            <pre className="whitespace-pre-wrap text-ink-secondary font-sans">
              {guest.notes}
            </pre>
          </div>
        )}
        {!guest.householdName &&
          !guest.email &&
          !guest.plusOneAllowed &&
          guest.dietary.length === 0 &&
          !guest.notes && (
            <p className="text-ink-tertiary italic">
              No extra details on file. Open the guest record for the full form.
            </p>
          )}
      </div>

      <div className="flex justify-between items-center px-4 py-2.5 border-t border-border-soft">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-ink-tertiary hover:text-ink-primary"
        >
          Close
        </button>
        <Link
          href={`/guests/${guest.id}`}
          className="text-xs text-moss-700 font-semibold hover:underline"
        >
          Open record →
        </Link>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-0.5">
        {label}
      </strong>
      <span className="text-ink-primary break-words">{value}</span>
    </div>
  );
}
