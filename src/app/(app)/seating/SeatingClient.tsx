"use client";

import { useEffect, useState } from "react";
import type { TableShape } from "@prisma/client";
import { EmptySeating, EmptyState } from "@/components/ui/Illustrations";
import { SeatingCanvas } from "./SeatingCanvas";
import { TableCard } from "./TableCard";

type Seat = {
  id: string;
  index: number;
  guest: { id: string; firstName: string; lastName: string } | null;
};

type Table = {
  id: string;
  name: string;
  shape: TableShape;
  capacity: number;
  posX: number;
  posY: number;
  rotation: number;
  seats: Seat[];
};

type GuestOpt = { id: string; firstName: string; lastName: string };

type View = "canvas" | "list";

const VIEW_STORAGE_KEY = "wh-seating-view";

export function SeatingClient({
  tables,
  unseatedGuests,
  canEdit,
}: {
  tables: Table[];
  unseatedGuests: GuestOpt[];
  canEdit: boolean;
}) {
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
          canEdit={canEdit}
        />
      ) : (
        <ListView tables={tables} unseatedGuests={unseatedGuests} canEdit={canEdit} />
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
}: {
  tables: Table[];
  unseatedGuests: GuestOpt[];
  canEdit: boolean;
}) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-4">
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
