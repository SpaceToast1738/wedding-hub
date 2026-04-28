"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { TableShape } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { assignGuestToSeat, deleteTable, updateTablePosition } from "./actions";

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

const CANVAS_W = 1400;
const CANVAS_H = 900;
const GRID = 20;
const SNAP_RADIUS = 10; // px tolerance — never snap "wrong" by more than this

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

// Visual sizing — purely cosmetic, scaled by capacity. Tables stay distinct
// without becoming illegible.
function tableSize(shape: TableShape, capacity: number): { w: number; h: number; r: number } {
  if (shape === "ROUND") {
    const r = 36 + capacity * 4;
    return { w: r * 2, h: r * 2, r };
  }
  if (shape === "HEAD") {
    return { w: 80 + capacity * 18, h: 70, r: 0 };
  }
  // RECTANGLE
  return { w: 70 + capacity * 14, h: 60, r: 0 };
}

function FillForShape(shape: TableShape): string {
  if (shape === "HEAD") return "#FBE9C5"; // marigold-100
  if (shape === "ROUND") return "#DDE6D0"; // moss-100
  return "#F1ECE2"; // bg-muted
}

export function SeatingCanvas({
  tables: initialTables,
  unseatedGuests,
  canEdit,
}: {
  tables: Table[];
  unseatedGuests: GuestOpt[];
  canEdit: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Local positions are the source of truth during a drag. We seed from
  // the server tables, mirror prop changes via useEffect, and write back
  // to the server on drop.
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    () => Object.fromEntries(initialTables.map((t) => [t.id, { x: t.posX, y: t.posY }])),
  );

  useEffect(() => {
    setPositions((prev) => {
      const next: Record<string, { x: number; y: number }> = {};
      for (const t of initialTables) {
        next[t.id] = prev[t.id] ?? { x: t.posX, y: t.posY };
      }
      return next;
    });
  }, [initialTables]);

  const [drag, setDrag] = useState<
    | { id: string; pointerId: number; offsetX: number; offsetY: number; moved: boolean }
    | null
  >(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Convert client coords (mouse) to SVG userspace coords.
  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((clientY - rect.top) / rect.height) * CANVAS_H;
    return { x, y };
  }, []);

  function startDrag(e: React.PointerEvent<SVGGElement>, t: Table) {
    if (!canEdit) {
      setFocusedId(t.id);
      return;
    }
    const point = clientToSvg(e.clientX, e.clientY);
    const pos = positions[t.id] ?? { x: t.posX, y: t.posY };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      id: t.id,
      pointerId: e.pointerId,
      offsetX: point.x - pos.x,
      offsetY: point.y - pos.y,
      moved: false,
    });
  }

  function onMove(e: React.PointerEvent<SVGGElement>) {
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;
    const p = clientToSvg(e.clientX, e.clientY);
    const x = clamp(p.x - drag.offsetX, 0, CANVAS_W);
    const y = clamp(p.y - drag.offsetY, 0, CANVAS_H);
    setPositions((prev) => ({ ...prev, [drag.id]: { x, y } }));
    if (!drag.moved) setDrag({ ...drag, moved: true });
  }

  function onUp(e: React.PointerEvent<SVGGElement>) {
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;
    const id = drag.id;
    const moved = drag.moved;
    setDrag(null);

    if (!moved) {
      setFocusedId((cur) => (cur === id ? null : id));
      return;
    }

    const live = positions[id];
    if (!live) return;
    const snapped = { x: snap(live.x), y: snap(live.y) };
    if (Math.abs(snapped.x - live.x) <= SNAP_RADIUS && Math.abs(snapped.y - live.y) <= SNAP_RADIUS) {
      setPositions((prev) => ({ ...prev, [id]: snapped }));
    }
    const final = positions[id] ? { x: snap(positions[id].x), y: snap(positions[id].y) } : null;
    if (!final) return;
    startTransition(async () => {
      try {
        await updateTablePosition(id, final.x, final.y);
      } catch (err) {
        console.error("position update failed", err);
      }
    });
  }

  // Keyboard nudging on the focused table.
  useEffect(() => {
    if (!canEdit || !focusedId) return;
    const handler = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;
      e.preventDefault();
      const step = e.shiftKey ? GRID * 4 : GRID;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      setPositions((prev) => {
        const cur = prev[focusedId];
        if (!cur) return prev;
        const next = { x: clamp(cur.x + dx, 0, CANVAS_W), y: clamp(cur.y + dy, 0, CANVAS_H) };
        startTransition(async () => {
          try {
            await updateTablePosition(focusedId, next.x, next.y);
          } catch (err) {
            console.error("position update failed", err);
          }
        });
        return { ...prev, [focusedId]: next };
      });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canEdit, focusedId]);

  const focusedTable = useMemo(
    () => initialTables.find((t) => t.id === focusedId) ?? null,
    [initialTables, focusedId],
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden min-h-0" ref={containerRef}>
      <div className="flex-1 bg-surface border border-border-soft rounded-md shadow-sm overflow-hidden min-h-[400px]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full block touch-none select-none"
          style={{ background: "var(--color-canvas)" }}
        >
          <defs>
            <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={1} fill="var(--color-border-soft)" />
            </pattern>
          </defs>
          <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />

          {initialTables.map((t) => {
            const pos = positions[t.id] ?? { x: t.posX, y: t.posY };
            const size = tableSize(t.shape, t.capacity);
            const filled = t.seats.filter((s) => s.guest).length;
            const isFocused = focusedId === t.id;
            const isDragging = drag?.id === t.id;
            return (
              <g
                key={t.id}
                transform={`translate(${pos.x} ${pos.y}) rotate(${t.rotation})`}
                onPointerDown={(e) => startDrag(e, t)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                style={{ cursor: canEdit ? (isDragging ? "grabbing" : "grab") : "pointer" }}
                tabIndex={0}
                onFocus={() => setFocusedId(t.id)}
                aria-label={`Table ${t.name}, ${filled} of ${t.capacity} seated`}
              >
                {t.shape === "ROUND" ? (
                  <circle
                    cx={0}
                    cy={0}
                    r={size.r}
                    fill={FillForShape(t.shape)}
                    stroke={isFocused ? "var(--color-moss-500)" : "var(--color-border-strong)"}
                    strokeWidth={isFocused ? 3 : 1.5}
                  />
                ) : (
                  <rect
                    x={-size.w / 2}
                    y={-size.h / 2}
                    width={size.w}
                    height={size.h}
                    rx={8}
                    fill={FillForShape(t.shape)}
                    stroke={isFocused ? "var(--color-moss-500)" : "var(--color-border-strong)"}
                    strokeWidth={isFocused ? 3 : 1.5}
                  />
                )}
                <text
                  x={0}
                  y={-4}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={600}
                  fill="var(--color-ink-primary)"
                  pointerEvents="none"
                >
                  {t.name}
                </text>
                <text
                  x={0}
                  y={14}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--color-ink-tertiary)"
                  pointerEvents="none"
                >
                  {filled} / {t.capacity}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <aside className="lg:w-80 flex-shrink-0 flex flex-col gap-3 lg:max-h-full overflow-auto">
        {focusedTable ? (
          <FocusPanel
            table={focusedTable}
            unseatedGuests={unseatedGuests}
            canEdit={canEdit}
            onClose={() => setFocusedId(null)}
          />
        ) : (
          <div className="bg-surface border border-border-soft rounded-md p-4 shadow-sm text-xs text-ink-tertiary">
            <strong className="block text-ink-secondary text-[11px] uppercase tracking-wider mb-1.5">
              Canvas
            </strong>
            {canEdit
              ? "Drag tables to reposition. Click to focus and assign seats. Arrow keys nudge the focused table; hold ⇧ for bigger steps."
              : "Click a table to view its seating. Editing is read-only for your role."}
          </div>
        )}
        <UnseatedPanel guests={unseatedGuests} />
      </aside>
    </div>
  );
}

function FocusPanel({
  table,
  unseatedGuests,
  canEdit,
  onClose,
}: {
  table: Table;
  unseatedGuests: GuestOpt[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const filled = table.seats.filter((s) => s.guest).length;

  function onAssign(seatId: string, guestId: string) {
    startTransition(async () => {
      try {
        await assignGuestToSeat(seatId, guestId || null);
      } catch (err) {
        notify(
          "error",
          err instanceof Error ? err.message : "Couldn't update seating",
        );
      }
    });
  }

  function onDeleteTable() {
    if (!confirm(`Delete table "${table.name}"?`)) return;
    startTransition(async () => {
      await deleteTable(table.id);
      onClose();
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="flex items-start justify-between gap-2 px-4 py-3 border-b border-border-soft">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink-primary truncate">{table.name}</h2>
          <div className="text-[11px] text-ink-tertiary">
            {table.shape.toLowerCase()} · {filled}/{table.capacity} seated
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close focus panel"
          className="text-ink-tertiary hover:text-ink-primary text-xl leading-none px-1"
        >
          ×
        </button>
      </header>
      <ul className="divide-y divide-border-soft max-h-[420px] overflow-auto">
        {table.seats.map((seat) => (
          <li key={seat.id} className="flex items-center gap-3 px-4 py-2">
            <span className="text-[10px] text-ink-tertiary w-6 flex-shrink-0">#{seat.index + 1}</span>
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
                  <option key={g.id} value={g.id}>
                    {g.firstName} {g.lastName}
                  </option>
                ))}
              </select>
            ) : (
              <span className="flex-1 text-sm text-ink-primary">
                {seat.guest ? (
                  `${seat.guest.firstName} ${seat.guest.lastName}`
                ) : (
                  <span className="text-ink-tertiary italic">empty</span>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="flex justify-end px-4 py-2.5 border-t border-border-soft">
          <Button variant="ghost" size="sm" onClick={onDeleteTable} disabled={pending}>
            Delete table
          </Button>
        </div>
      )}
    </section>
  );
}

function UnseatedPanel({ guests }: { guests: GuestOpt[] }) {
  if (guests.length === 0) {
    return (
      <div className="bg-moss-50/40 border border-moss-100 text-moss-700 rounded-md p-3 text-xs text-center">
        ✓ Everyone attending has a seat.
      </div>
    );
  }
  return (
    <section className="bg-surface border border-border-soft rounded-md p-3 shadow-sm">
      <header className="flex items-baseline justify-between mb-2">
        <strong className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
          Unseated
        </strong>
        <span className="text-[11px] text-ink-tertiary">{guests.length}</span>
      </header>
      <ul className="flex flex-wrap gap-1.5">
        {guests.map((g) => (
          <li
            key={g.id}
            className="text-xs text-ink-secondary bg-canvas border border-border-soft rounded-md px-2 py-0.5"
          >
            {g.firstName} {g.lastName}
          </li>
        ))}
      </ul>
    </section>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
