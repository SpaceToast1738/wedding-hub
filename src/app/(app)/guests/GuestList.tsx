"use client";

import { Fragment, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/StatusPill";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { EmptySearch, EmptyState } from "@/components/ui/Illustrations";
import type { GuestGroupSummary } from "@/components/ui/GuestGroupsControl";
import { GuestForm } from "./GuestForm";
import { createGuest, createHousehold } from "./actions";

// v1.72.0: flat-table layout matching the design prototype
// (prototype/GuestsPage.jsx). Replaces the v1.17.0 card-based
// HouseholdBlock list. Tag-filter pills above, household subheader
// rows when a household has 2+ members, row click → /guests/[id].
// v2.5.1 (Design Pass P1): + Add guest / + Add member affordances,
// responsive column hiding, whole-row navigation, empty-household
// rows, visible filter-pill counts, canEdit finally wired up.

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
  // v2.5.1 (finding #8): needed to render the "+1 TBC" chip on a host
  // row whose plus-one is allowed but not yet named.
  plusOneAllowed?: boolean;
  plusOneName?: string | null;
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
  canEdit,
}: {
  households: T[];
  allGroups: GuestGroupSummary[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const householdOptions = useMemo(
    () => households.map((h) => ({ id: h.id, name: h.name })),
    [households],
  );

  // v2.5.1 (finding #10 / ADHD note): visible counts on the filter
  // pills so scanning replaces recall. Computed off the full
  // (unfiltered) household list so the numbers stay stable while
  // another filter is active.
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of households) {
      for (const g of h.guests) {
        for (const gr of g.groups ?? []) {
          counts.set(gr.id, (counts.get(gr.id) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [households]);

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
        return { ...h, guests: visibleGuests, totalMemberCount: h.guests.length };
      })
      .filter((h) => {
        if (h.guests.length > 0) return true;
        // v2.5.1 (finding #1): a household with zero guest rows is
        // either genuinely empty (keep it visible so "add member" is
        // reachable — pre-fix it was invisible, and the empty state
        // below falsely claimed "no households yet") or it just has
        // no MATCHES for the active search/group filter (hide it —
        // that's ordinary filtering, not an empty household).
        return h.totalMemberCount === 0 && !trimmed && !activeGroupId;
      });
  }, [households, activeGroupId, query]);

  const trimmed = query.trim();
  const totalGuests = households.reduce((n, h) => n + h.guests.length, 0);
  const visibleGuests = filtered.reduce((n, h) => n + h.guests.length, 0);

  function clearFilters() {
    setQuery("");
    setActiveGroupId(null);
  }

  return (
    <>
      {/* Tag-filter pills — matches prototype's flat-table tag row.
          v2.5.1: swapped the bespoke pill for the shared Tag
          primitive (40px touch floor + aria-pressed baked in), and
          added visible counts (finding #10 / ADHD note). */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <Tag
          label={`All (${totalGuests})`}
          active={activeGroupId === null}
          onClick={() => setActiveGroupId(null)}
        />
        {allGroups.map((g) => (
          <Tag
            key={g.id}
            label={`${g.name} (${groupCounts.get(g.id) ?? 0})`}
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
          // v2.5.1 (ADHD note): a real "Clear filters" button, not
          // just a sentence telling the user to go find the filter
          // themselves.
          <EmptyState
            illustration={EmptySearch}
            title={trimmed ? `No matches for "${query}"` : "No guests in this group"}
            body="Try clearing the filter or search."
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <p className="text-sm text-ink-tertiary text-center py-12">No households yet.</p>
        )
      ) : (
        // v2.5.1 (finding #4): overflow-auto (both axes, explicitly)
        // with a bounded height makes THIS div the one and only
        // vertical scroll owner for the sticky header to stick
        // relative to. Pre-fix this was `overflow-x-auto` — the CSS
        // overflow spec silently forces the other axis's `visible` to
        // `auto` too, so this div became an *accidental* second
        // scroll container with no actual scrolling ever happening in
        // it (unbounded height), which left `sticky top-0` pinned to
        // a scrollport that never moved instead of the real one.
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border-soft bg-canvas">
                {(["Name", "Table", "RSVP", "Type", "Tags", "Dietary"] as const).map((h) => {
                  // v2.5.1 (finding #4): Type/Tags/Dietary hide below
                  // sm — dietary reappears as a badge under the guest
                  // name instead. Name/Table/RSVP stay visible at
                  // every width.
                  const hideOnMobile = h === "Type" || h === "Tags" || h === "Dietary";
                  return (
                    <th
                      key={h}
                      className={[
                        "text-left text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary py-2.5 px-3 sticky top-0 z-10 bg-canvas",
                        hideOnMobile ? "hidden sm:table-cell" : "",
                      ].join(" ")}
                    >
                      {h}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                // v2.5.1 (finding #9): subheader only for actual
                // multi-member households — pre-fix it rendered for
                // every household (including solo guests), doubling
                // the row count for the common couple/single case.
                // The empty case (finding #1) still needs a subheader
                // row though — it's the only place "add member" can
                // live for a household with zero guest rows yet.
                const isMultiMember = h.guests.length > 1;
                const isEmpty = h.guests.length === 0;
                return (
                  <Fragment key={h.id}>
                    {(isMultiMember || isEmpty) && (
                      <tr className="bg-muted">
                        <td colSpan={6} className="text-[11px] text-ink-tertiary font-medium py-1.5 px-3">
                          <div className="flex items-center justify-between gap-2">
                            <span>{h.name}</span>
                            {isEmpty && canEdit && (
                              <AddGuestButton
                                households={householdOptions}
                                presetHouseholdId={h.id}
                                variant="ghost"
                                label="+ Add member"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    {h.guests.map((g) => {
                      const fullName = `${g.firstName} ${g.lastName}`.trim();
                      const isPlusOne = !!g.parentGuestId;
                      // v2.5.1 (finding #8): a host who's allowed a
                      // plus-one but hasn't named them yet used to be
                      // fully invisible — the +1 badge only ever
                      // rendered for an already-materialised child row
                      // (which only gets created once a name exists).
                      const plusOneTbc = !!g.plusOneAllowed && !g.plusOneName && !isPlusOne;
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
                          onClick={() => router.push(`/guests/${g.id}`)}
                          // v2.5.1 (finding #9): the whole row now
                          // actually navigates — pre-fix only the name
                          // cell linked anywhere, but the hover style
                          // implied the whole row was clickable. The
                          // name stays a real <Link> below for
                          // keyboard/middle-click.
                          className="border-b border-border-soft last:border-b-0 hover:bg-canvas/50 cursor-pointer"
                        >
                          <td
                            className={
                              "py-2 px-3 " + (isMultiMember ? "pl-7" : "")
                            }
                          >
                            <Link
                              href={`/guests/${g.id}`}
                              onClick={(e) => e.stopPropagation()}
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
                              {plusOneTbc && (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-dashed border-marigold-700/50 text-marigold-700 tracking-wider"
                                  title="Plus-one allowed, not yet named"
                                >
                                  +1 TBC
                                </span>
                              )}
                            </Link>
                            {/* v2.5.1 (finding #4): dietary badge under
                                the name at narrow widths — replaces
                                the Dietary column, which hides below
                                sm. */}
                            {dietary && (
                              <div className="sm:hidden mt-1 pl-8">
                                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-marigold-100 text-marigold-700 border border-marigold-200">
                                  {dietary}
                                </span>
                              </div>
                            )}
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
                          <td className="py-2 px-3 hidden sm:table-cell">
                            <StatusPill
                              status={g.isChild ? "CHILD" : "ADULT"}
                              label={g.isChild ? "Child" : "Adult"}
                            />
                          </td>
                          <td className="py-2 px-3 hidden sm:table-cell">
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
                          <td className="py-2 px-3 text-xs text-ink-secondary whitespace-nowrap hidden sm:table-cell">
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

// v2.5.1 (finding #1): the only way to add a single guest used to be
// editing an existing row — createGuest + GuestForm already existed,
// but nothing in the UI ever mounted GuestForm in create mode. This
// opens GuestForm inside an AddNewModal with a household picker (plus
// an inline "create new household" option) in front of it. Exported
// so both the page-header "+ Add guest" button (guests/page.tsx) and
// the compact per-household "+ Add member" affordance above (empty
// households) can share one implementation.
export function AddGuestButton({
  households,
  presetHouseholdId,
  variant = "primary",
  label = "+ Add guest",
}: {
  households: { id: string; name: string }[];
  presetHouseholdId?: string;
  variant?: "primary" | "ghost";
  label?: string;
}) {
  const router = useRouter();
  const householdSelectId = useId();
  const sideSelectId = useId();
  const [open, setOpen] = useState(false);
  const [householdMode, setHouseholdMode] = useState<"existing" | "new">(
    !presetHouseholdId && households.length === 0 ? "new" : "existing",
  );
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(
    presetHouseholdId ?? households[0]?.id ?? "",
  );
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [newHouseholdSide, setNewHouseholdSide] = useState<"BRIDE" | "GROOM" | "BOTH">("BOTH");

  function reset() {
    setHouseholdMode(!presetHouseholdId && households.length === 0 ? "new" : "existing");
    setSelectedHouseholdId(presetHouseholdId ?? households[0]?.id ?? "");
    setNewHouseholdName("");
    setNewHouseholdSide("BOTH");
  }

  async function handleSubmit(formData: FormData) {
    let householdId = presetHouseholdId || selectedHouseholdId;
    if (!presetHouseholdId && householdMode === "new") {
      const name = newHouseholdName.trim();
      if (!name) throw new Error("Household name is required");
      const houseFd = new FormData();
      houseFd.set("name", name);
      houseFd.set("side", newHouseholdSide);
      const created = await createHousehold(houseFd);
      householdId = created.id;
    }
    if (!householdId) throw new Error("Choose or create a household first");
    formData.set("householdId", householdId);
    await createGuest(formData);
    router.refresh();
    setOpen(false);
    reset();
  }

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <AddNewModal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Add guest"
        width="lg"
      >
        <div className="space-y-3">
          {!presetHouseholdId && (
            <div>
              <label
                htmlFor={householdSelectId}
                className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1"
              >
                Household
              </label>
              <select
                id={householdSelectId}
                value={householdMode === "new" ? "__new__" : selectedHouseholdId}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setHouseholdMode("new");
                  } else {
                    setHouseholdMode("existing");
                    setSelectedHouseholdId(e.target.value);
                  }
                }}
                className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2.5 py-1.5 text-ink-primary outline-none"
              >
                {households.length === 0 && <option value="">— none yet —</option>}
                {households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
                <option value="__new__">+ Create new household…</option>
              </select>
            </div>
          )}
          {!presetHouseholdId && householdMode === "new" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-canvas border border-border-soft rounded-md p-2.5">
              <Input
                label="New household name"
                value={newHouseholdName}
                onChange={(e) => setNewHouseholdName(e.target.value)}
                placeholder="e.g. The Spencer Family"
                wrapperClassName="sm:col-span-2"
                autoFocus
              />
              <div>
                <label
                  htmlFor={sideSelectId}
                  className="block text-[11px] font-bold text-ink-secondary uppercase tracking-wider mb-1"
                >
                  Side
                </label>
                <select
                  id={sideSelectId}
                  value={newHouseholdSide}
                  onChange={(e) => setNewHouseholdSide(e.target.value as "BRIDE" | "GROOM" | "BOTH")}
                  className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none"
                >
                  <option value="BRIDE">Bride</option>
                  <option value="GROOM">Groom</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>
            </div>
          )}
          <GuestForm
            householdId={presetHouseholdId || selectedHouseholdId || "pending"}
            submitLabel="Add guest"
            onSubmit={handleSubmit}
            onCancel={() => {
              setOpen(false);
              reset();
            }}
          />
        </div>
      </AddNewModal>
    </>
  );
}
