"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptySearch, EmptyState } from "@/components/ui/Illustrations";
import type { GuestGroupSummary } from "@/components/ui/GuestGroupsControl";

// v1.72.0: flat-table layout matching the design prototype
// (prototype/GuestsPage.jsx). Replaces the v1.17.0 card-based
// HouseholdBlock list. Tag-filter pills above, household subheader
// rows when a household has 2+ members, row click → /guests/[id].

type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  rsvp: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
  side?: "BRIDE" | "GROOM" | "BOTH";
  isChild: boolean;
  dietary?: string[];
  parentGuestId?: string | null;
  profilePictureFileId?: string | null;
  groups?: { id: string }[];
  tableSeat?: { id: string; table: { id: string; name: string } } | null;
};

type Household = {
  id: string;
  name: string;
  side?: "BRIDE" | "GROOM" | "BOTH";
  guests: Guest[];
};

const RSVP_LABEL: Record<Guest["rsvp"], string> = {
  ATTENDING: "Confirmed",
  PENDING: "Pending",
  DECLINED: "Declined",
  MAYBE: "Maybe",
};

const RSVP_STATUS: Record<Guest["rsvp"], string> = {
  ATTENDING: "YES",
  PENDING: "PENDING",
  DECLINED: "DECLINED",
  MAYBE: "PENDING",
};

export function GuestList<T extends Household>({
  households,
  allGroups,
}: {
  households: T[];
  allGroups: GuestGroupSummary[];
  canEdit: boolean;
}) {
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return households
      .map((h) => {
        const visibleGuests = h.guests.filter((g) => {
          if (activeGroupId && !g.groups?.some((gr) => gr.id === activeGroupId))
            return false;
          if (trimmed) {
            const fullName = `${g.firstName} ${g.lastName}`.toLowerCase();
            if (!h.name.toLowerCase().includes(trimmed) && !fullName.includes(trimmed))
              return false;
          }
          return true;
        });
        return { ...h, guests: visibleGuests };
      })
      .filter((h) => h.guests.length > 0);
  }, [households, activeGroupId, query]);

  const trimmed = query.trim();
  const totalGuests = households.reduce((n, h) => n + h.guests.length, 0);
  const visibleGuests = filtered.reduce((n, h) => n + h.guests.length, 0);

  return (
    <>
      {/* Tag-filter pills — matches prototype's flat-table tag row. */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <FilterPill
          label="All"
          active={activeGroupId === null}
          onClick={() => setActiveGroupId(null)}
        />
        {allGroups.map((g) => (
          <FilterPill
            key={g.id}
            label={g.name}
            active={activeGroupId === g.id}
            onClick={() =>
              setActiveGroupId(activeGroupId === g.id ? null : g.id)
            }
          />
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search households or guests…"
          aria-label="Search guests"
          className="flex-1 text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-3 py-1.5 outline-none focus:border-moss-500"
        />
        {trimmed && (
          <span className="text-[11px] text-ink-tertiary tabular-nums whitespace-nowrap">
            {visibleGuests}/{totalGuests}
          </span>
        )}
        {trimmed && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-xs text-ink-tertiary hover:text-ink-primary px-1.5"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        trimmed || activeGroupId ? (
          <EmptyState
            illustration={EmptySearch}
            title={trimmed ? `No matches for "${query}"` : "No guests in this group"}
            body="Try clearing the filter or search."
          />
        ) : (
          <p className="text-sm text-ink-tertiary text-center py-12">No households yet.</p>
        )
      ) : (
        <div className="overflow-x-auto border border-border-soft rounded-sm bg-surface">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border-soft bg-canvas">
                {["Name", "Table", "RSVP", "Type", "Tags", "Dietary"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary py-2.5 px-3 sticky top-0 bg-canvas"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const showHouseholdHeader = h.guests.length > 1;
                return (
                  <Fragment key={h.id}>
                    {showHouseholdHeader && (
                      <tr className="bg-muted">
                        <td
                          colSpan={6}
                          className="text-[11px] text-ink-tertiary font-medium py-1.5 px-3"
                        >
                          {h.name}
                        </td>
                      </tr>
                    )}
                    {h.guests.map((g) => {
                      const fullName = `${g.firstName} ${g.lastName}`.trim();
                      const isPlusOne = !!g.parentGuestId;
                      const dietary =
                        g.dietary && g.dietary.length > 0
                          ? g.dietary.join(", ")
                          : null;
                      const guestGroups = (g.groups ?? [])
                        .map((gr) => allGroups.find((m) => m.id === gr.id))
                        .filter((m): m is GuestGroupSummary => !!m);
                      return (
                        <tr
                          key={g.id}
                          className="border-b border-border-soft last:border-b-0 hover:bg-canvas/50"
                        >
                          <td
                            className={
                              "py-2 px-3 " + (showHouseholdHeader ? "pl-7" : "")
                            }
                          >
                            <Link
                              href={`/guests/${g.id}`}
                              className="flex items-center gap-2 text-sm text-ink-primary hover:text-moss-700"
                            >
                              <Avatar
                                name={fullName}
                                pictureFileId={g.profilePictureFileId ?? undefined}
                                size={24}
                              />
                              <span className="font-medium">{fullName}</span>
                              {isPlusOne && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-marigold-100 text-marigold-700 border border-[color:#f0d9a8] dark:border-marigold-700 tracking-wider">
                                  +1
                                </span>
                              )}
                            </Link>
                          </td>
                          <td className="py-2 px-3 text-xs text-ink-secondary whitespace-nowrap">
                            {g.tableSeat?.table.name ?? "—"}
                          </td>
                          <td className="py-2 px-3">
                            <StatusPill
                              status={RSVP_STATUS[g.rsvp]}
                              label={RSVP_LABEL[g.rsvp]}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <StatusPill
                              status={g.isChild ? "CHILD" : "ADULT"}
                              label={g.isChild ? "Child" : "Adult"}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1">
                              {guestGroups.slice(0, 2).map((gr) => (
                                <span
                                  key={gr.id}
                                  className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-ink-tertiary border border-border-soft whitespace-nowrap"
                                >
                                  {gr.name}
                                </span>
                              ))}
                              {guestGroups.length > 2 && (
                                <span className="text-[11px] text-ink-tertiary self-center">
                                  +{guestGroups.length - 2}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-xs text-ink-secondary whitespace-nowrap">
                            {dietary ?? <span className="text-ink-tertiary">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "text-xs px-3 py-1 rounded-full border transition-colors whitespace-nowrap " +
        (active
          ? "bg-moss-500 text-white border-moss-500"
          : "bg-canvas text-ink-secondary border-border-soft hover:border-moss-300 hover:text-moss-700")
      }
    >
      {label}
    </button>
  );
}
