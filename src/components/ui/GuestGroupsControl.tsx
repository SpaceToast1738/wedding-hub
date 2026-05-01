"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { notify } from "@/lib/notify";
import { toggleGuestGroupMember } from "@/app/(app)/settings/guest-group-actions";

// v1.49.0: reusable guest-group membership control. Renders the
// guest's current group memberships as colour-tinted chips and (in
// edit mode) exposes a "+ Add" affordance that pops a checkbox list
// of every available custom group.
//
// Used everywhere a guest's groups should be visible:
//   - guests list (HouseholdBlock guest rows) — edit mode
//   - guest detail page (/guests/[id]) — edit mode
//   - seating canvas detail panel — read-only
//   - … any future surface that renders a single guest's record
//
// Reuses the existing `toggleGuestGroupMember` server action — no
// new endpoint, no new audit code path. The popover talks to the
// same gate (`requireCoupleEditor`) so non-couple readers see chips
// only.

export type GuestGroupSummary = {
  id: string;
  slug: string;
  name: string;
  colour: string | null;
  side: "BRIDE" | "GROOM" | "BOTH";
};

const SIDE_LABELS: Record<"BRIDE" | "GROOM" | "BOTH", string> = {
  BRIDE: "Bride",
  GROOM: "Groom",
  BOTH: "Both",
};

export function GuestGroupsControl({
  guestId,
  memberOf,
  allGroups,
  canEdit,
  size = "sm",
}: {
  guestId: string;
  /** Group ids the guest is currently a member of. */
  memberOf: string[];
  /** Every custom guest group available for assignment. */
  allGroups: GuestGroupSummary[];
  canEdit: boolean;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click-outside dismiss for the popover. Pointerdown rather than
  // click so the popover closes the moment the press starts elsewhere
  // (matches native menu behaviour).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const memberSet = new Set(memberOf);
  const memberGroups = allGroups.filter((g) => memberSet.has(g.id));

  function onToggle(groupId: string, on: boolean) {
    startTransition(async () => {
      const res = await toggleGuestGroupMember({ groupId, guestId, on });
      if (!res.ok) notify("error", res.error);
    });
  }

  // Read-only mode: just chips, no edit affordance.
  if (!canEdit) {
    if (memberGroups.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {memberGroups.map((g) => (
          <Chip key={g.id} group={g} size={size} />
        ))}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative inline-flex flex-wrap items-center gap-1">
      {memberGroups.map((g) => (
        <Chip key={g.id} group={g} size={size} />
      ))}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending || allGroups.length === 0}
        className="text-[10px] text-ink-tertiary hover:text-ink-primary border border-dashed border-border-soft rounded-full px-1.5 py-0.5 disabled:opacity-50"
        title={allGroups.length === 0 ? "No guest groups exist yet — add one in Settings" : "Manage groups"}
        aria-label="Manage guest groups"
        aria-expanded={open}
      >
        {memberGroups.length === 0 ? "+ Add group" : "+"}
      </button>
      {open && (
        <div
          className="absolute z-30 left-0 top-full mt-1 w-64 max-h-72 overflow-y-auto bg-surface border border-border-soft rounded-md shadow-lg p-2"
          role="menu"
        >
          {allGroups.length === 0 ? (
            <p className="text-xs text-ink-tertiary italic px-1 py-0.5">
              No guest groups exist yet. Add one in Settings → Guest groups.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {allGroups.map((g) => {
                const on = memberSet.has(g.id);
                return (
                  <li key={g.id}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-canvas/60 rounded-sm px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={pending}
                        onChange={(e) => onToggle(g.id, e.target.checked)}
                        className="accent-moss-500 flex-shrink-0"
                      />
                      {g.colour && (
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full border border-border-soft flex-shrink-0"
                          style={{ background: g.colour }}
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`flex-1 truncate ${on ? "text-ink-primary" : "text-ink-tertiary"}`}
                      >
                        {g.name}
                      </span>
                      <span
                        className={`text-[9px] uppercase tracking-wider font-semibold ${
                          g.side === "BRIDE"
                            ? "text-rose-700"
                            : g.side === "GROOM"
                              ? "text-moss-700"
                              : "text-ink-tertiary"
                        }`}
                        title={`Side: ${SIDE_LABELS[g.side]}`}
                      >
                        {SIDE_LABELS[g.side].slice(0, 1)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({
  group,
  size,
}: {
  group: GuestGroupSummary;
  size: "sm" | "md";
}) {
  const padding = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-0.5";
  const fontSize = size === "sm" ? "text-[10px]" : "text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 ${padding} ${fontSize} rounded-full border border-border-soft text-ink-secondary`}
      style={{
        background: group.colour ? `${group.colour}30` : "var(--color-canvas)",
        borderColor: group.colour ?? undefined,
      }}
      title={`${group.name} (${SIDE_LABELS[group.side]})`}
    >
      {group.colour && (
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: group.colour }}
          aria-hidden="true"
        />
      )}
      <span className="truncate max-w-[12rem]">{group.name}</span>
    </span>
  );
}
