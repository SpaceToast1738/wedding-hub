"use client";

import { useEffect, useMemo, useState } from "react";
import type { TableShape } from "@prisma/client";
import { EmptySeating, EmptyState } from "@/components/ui/Illustrations";
import { CollapsiblePanel } from "./CollapsiblePanel";
import {
  ChecklistContent,
  NotesContent,
  checklistRightSlot,
} from "./SeatingPlanPanel";
import { SeatingCanvas } from "./SeatingCanvas";
import { TableCard } from "./TableCard";

type Seat = {
  id: string;
  index: number;
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    // v1.22.7: piped through to color seat dots on the canvas.
    rsvp: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
  } | null;
};

// v1.23.0: notes + checklist threaded through. Both nullable; UI
// renders an empty state / "Add a note" stub when null.
export type ChecklistItem = { id: string; label: string; done: boolean };
type Table = {
  id: string;
  name: string;
  shape: TableShape;
  capacity: number;
  posX: number;
  posY: number;
  rotation: number;
  seats: Seat[];
  notes: string | null;
  checklist: ChecklistItem[] | null;
};

// v1.20.6: panel now shows ALL non-archived guests with RSVP tag, not
// just unseated attending. The legacy `GuestOpt` shape (id+firstName+
// lastName) is still accepted by sub-components that don't need RSVP.
export type AllGuest = {
  id: string;
  firstName: string;
  lastName: string;
  rsvp: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
  currentSeatId: string | null;
  currentTableName: string | null;
};

// v1.22.6: dropdown options now carry RSVP so the picker can prefix
// pending/maybe with their tag — pre-fix the picker only listed
// attending guests, so the planner couldn't provisionally seat someone
// who hadn't RSVP'd yet (only drag-from-panel worked, which they
// missed). The label is just decoration; assignment ignores RSVP.
type GuestOpt = {
  id: string;
  firstName: string;
  lastName: string;
  rsvp?: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
};

type View = "canvas" | "list";

const VIEW_STORAGE_KEY = "wh-seating-view";

export function SeatingClient({
  tables,
  allGuests,
  canEdit,
  seatingNotes,
  seatingChecklist,
}: {
  tables: Table[];
  allGuests: AllGuest[];
  canEdit: boolean;
  // v1.23.2: notes + checklist now thread through to the canvas
  // sidebar (replaces v1.23.1's top-of-page panel).
  seatingNotes: string;
  seatingChecklist: ChecklistItem[];
}) {
  // Sub-components that only need {id, firstName, lastName, rsvp} (the
  // seat picker dropdown for the FocusPanel + TableCard) get a slimmed-
  // down list of unseated guests.
  // v1.22.6: include PENDING and MAYBE alongside ATTENDING — planners
  // want to provisionally seat people who haven't confirmed yet (esp.
  // family members on stalled invites). DECLINED stays out — they
  // won't get a seat. The dropdown labels mark non-attending entries.
  const unseatedGuests = useMemo<GuestOpt[]>(
    () =>
      allGuests
        .filter((g) => g.rsvp !== "DECLINED" && !g.currentSeatId)
        .map((g) => ({
          id: g.id,
          firstName: g.firstName,
          lastName: g.lastName,
          rsvp: g.rsvp,
        })),
    [allGuests],
  );
  const [view, setView] = useState<View>("canvas");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "canvas" || saved === "list") setView(saved);
    } catch {}
    setHydrated(true);
  }, []);

  function pick(v: View) {
    setView(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {}
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-end gap-1 px-6 pt-3 pb-1">
        <ViewButton active={view === "canvas"} onClick={() => pick("canvas")} label="Canvas" />
        <ViewButton active={view === "list"} onClick={() => pick("list")} label="List" />
      </div>
      {hydrated && view === "canvas" ? (
        <SeatingCanvas
          tables={tables}
          unseatedGuests={unseatedGuests}
          allGuests={allGuests}
          canEdit={canEdit}
          seatingNotes={seatingNotes}
          seatingChecklist={seatingChecklist}
        />
      ) : (
        <ListView
          tables={tables}
          unseatedGuests={unseatedGuests}
          canEdit={canEdit}
          seatingNotes={seatingNotes}
          seatingChecklist={seatingChecklist}
        />
      )}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "text-xs px-2.5 py-1 rounded-sm border transition-colors cursor-pointer",
        active
          ? "bg-moss-500 text-white border-moss-500"
          : "bg-canvas text-ink-secondary border-border-soft hover:border-moss-300",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ListView({
  tables,
  unseatedGuests,
  canEdit,
  seatingNotes,
  seatingChecklist,
}: {
  tables: Table[];
  unseatedGuests: GuestOpt[];
  canEdit: boolean;
  // v1.23.2: List view also gets a collapsible notes + checklist
  // strip at the top so editors can manage them without switching
  // to canvas. Same content cards as the canvas sidebar uses.
  seatingNotes: string;
  seatingChecklist: ChecklistItem[];
}) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {/* v1.23.2: collapsible notes + checklist at the top of list
            view. Canvas view mounts the same content in the right
            sidebar instead. */}
        <div className="grid gap-3 lg:grid-cols-2">
          <CollapsiblePanel
            storageKey="wh_seating_panel_notes"
            title="Notes"
            defaultOpen
          >
            <NotesContent initial={seatingNotes} canEdit={canEdit} />
          </CollapsiblePanel>
          <CollapsiblePanel
            storageKey="wh_seating_panel_checklist"
            title="Day-of checklist"
            defaultOpen
            rightSlot={checklistRightSlot(seatingChecklist)}
          >
            <ChecklistContent initial={seatingChecklist} canEdit={canEdit} />
          </CollapsiblePanel>
        </div>
        {tables.length === 0 ? (
          <EmptyState
            illustration={EmptySeating}
            title="No tables yet"
            body={canEdit ? "Add the first table above and drag guests in." : "The couple hasn't set up the seating plan yet."}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {tables.map((t) => (
              <TableCard
                key={t.id}
                table={t}
                unseatedGuests={unseatedGuests}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
        {unseatedGuests.length > 0 && (
          <section className="bg-surface border border-border-soft rounded-md p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-ink-primary mb-2">Unseated attendees</h2>
            <ul className="flex flex-wrap gap-2">
              {unseatedGuests.map((g) => (
                <li
                  key={g.id}
                  className="text-xs text-ink-secondary bg-canvas border border-border-soft rounded-md px-2 py-1"
                >
                  {g.firstName} {g.lastName}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
