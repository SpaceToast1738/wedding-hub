"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { TableShape } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { assignGuestToSeat, deleteTable, updateTableCapacity, updateTablePosition } from "./actions";
import type { AllGuest } from "./SeatingClient";

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

type GuestOpt = {
  id: string;
  firstName: string;
  lastName: string;
  rsvp?: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
};

// v1.22.6: prefix pending/maybe entries in dropdowns with their RSVP
// tag, so planners can spot un-confirmed picks at a glance. Attending
// is unprefixed (it's the common case).
function guestOptionLabel(g: GuestOpt): string {
  const name = `${g.firstName} ${g.lastName}`;
  if (g.rsvp === "PENDING") return `? ${name}`;
  if (g.rsvp === "MAYBE") return `~ ${name}`;
  return name;
}

const CANVAS_W = 1400;
const CANVAS_H = 900;
const GRID = 20;
// v1.22.6: SNAP_RADIUS removed. Snap behaviour is now an explicit
// user-controlled toggle (`snapToGrid` state) — either always snap on
// drop, or never. The pre-v1.22.6 "soft snap within ±10px tolerance"
// was confusing in practice (rarely fired).

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
  allGuests,
  canEdit,
}: {
  tables: Table[];
  unseatedGuests: GuestOpt[];
  allGuests: AllGuest[];
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

  // v1.20.5: per-seat label/dot size selector. The pre-v1.20.5 defaults
  // (dotR=3.5, fontSize=9) were conservative — readable on a desktop
  // monitor at 100% zoom but cramped on narrower screens. Three sizes:
  //   S = 1.0  (pre-v1.20.5 default; dot 3.5px, font 9px)
  //   M = 1.4  (new default; dot 4.9px, font 12.6px)
  //   L = 1.8  (chunky; dot 6.3px, font 16.2px)
  // Persisted to localStorage so the user's pick survives navigation.
  // v1.22.5: split into independent dot + label scales. The user wanted
  // "bigger seats but not bigger labels" — pre-fix, both grew together
  // because they shared one scale. Now each persists separately.
  const [labelScale, setLabelScale] = useState<number>(1.4);
  const [dotScale, setDotScale] = useState<number>(1.4);
  // v1.22.6: snap-to-grid toggle. Pre-fix the snap-on-drop only fired
  // when the drop landed within ±10px of a grid point — the rest of
  // the time tables stayed wherever the drag ended (off-grid). User
  // wants alignment, so the new toggle lets them say "always snap on
  // drop". Default on (alignment is the planner's stated goal).
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  // v1.22.5 persistence fix: pre-fix, the save effect ran on mount
  // with the default state value and overwrote whatever the user had
  // saved before the load effect could swap it in. Gate the save on
  // `loaded` so it only fires after the initial read completes. This
  // was the user-visible "doesn't save my seat label size" bug.
  const [loaded, setLoaded] = useState(false);

  // v1.20.6: HTML5 drag-and-drop wiring for seat assignment.
  // - Panel rows: `draggable`, `onDragStart` sets dataTransfer + state
  // - Seat groups: wider transparent drop-zone circle that listens for
  //   `onDragOver` (preventDefault to allow drop) + `onDrop`
  // - Panel itself: `onDrop` unseats (assignGuestToSeat(currentSeatId, null))
  // The action's transaction (B12, v1.12.0) handles the multi-guest
  // race + unique-constraint case atomically.
  const [draggingGuestId, setDraggingGuestId] = useState<string | null>(null);
  const [dragOverSeatId, setDragOverSeatId] = useState<string | null>(null);

  function dropOnSeat(seatId: string, guestId: string) {
    startTransitionDrop(async () => {
      try {
        await assignGuestToSeat(seatId, guestId);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't assign seat");
      }
    });
  }

  function dropOnPanel(guestId: string) {
    // Look up the guest's current seat; only call the action if there
    // is one (otherwise it's a no-op drag from panel → panel).
    const g = allGuests.find((x) => x.id === guestId);
    if (!g?.currentSeatId) return;
    startTransitionDrop(async () => {
      try {
        await assignGuestToSeat(g.currentSeatId!, null);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't unseat");
      }
    });
  }

  const [, startTransitionDrop] = useTransition();
  useEffect(() => {
    try {
      const savedLabel = localStorage.getItem("wh_seating_label_scale");
      if (savedLabel) {
        const n = Number(savedLabel);
        if (n === 1.0 || n === 1.4 || n === 1.8) setLabelScale(n);
      }
      const savedDot = localStorage.getItem("wh_seating_dot_scale");
      if (savedDot) {
        const n = Number(savedDot);
        if (n === 1.0 || n === 1.4 || n === 1.8 || n === 2.4) setDotScale(n);
      }
      const savedSnap = localStorage.getItem("wh_seating_snap_to_grid");
      if (savedSnap === "true" || savedSnap === "false") setSnapToGrid(savedSnap === "true");
    } catch {
      // ignore — non-critical preference
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("wh_seating_label_scale", String(labelScale));
    } catch {
      // ignore
    }
  }, [labelScale, loaded]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("wh_seating_dot_scale", String(dotScale));
    } catch {
      // ignore
    }
  }, [dotScale, loaded]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("wh_seating_snap_to_grid", String(snapToGrid));
    } catch {
      // ignore
    }
  }, [snapToGrid, loaded]);

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
    // v1.22.6: snap toggle. When on, every drop snaps to the nearest
    // grid point — easy alignment of multiple tables. When off, drop
    // wherever the cursor lands. Pre-v1.22.6 behaviour was a "soft
    // snap" within ±10px tolerance, which almost never fired in
    // practice; replaced with the explicit toggle.
    let final: { x: number; y: number };
    if (snapToGrid) {
      final = { x: snap(live.x), y: snap(live.y) };
      setPositions((prev) => ({ ...prev, [id]: final }));
    } else {
      final = { x: live.x, y: live.y };
    }
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
                {/* C7 (v1.14.0): per-seat position dots on round tables.
                    Filled (moss) = occupied; outlined (canvas) = empty.
                    v1.16.0: now also renders the occupant's first name
                    next to each filled dot, anchored away from the
                    table centre so the text reads outward and doesn't
                    overlap the table circle. */}
                {t.shape === "ROUND" && t.seats.map((seat, i) => {
                  // -90° offset puts seat 0 at the top of the circle,
                  // matching how a host typically reads round-table
                  // seating ("twelve o'clock first").
                  const angle = (i / t.capacity) * 2 * Math.PI - Math.PI / 2;
                  const dotOffset = size.r + 8 * dotScale;
                  const cx = dotOffset * Math.cos(angle);
                  const cy = dotOffset * Math.sin(angle);
                  const occupied = !!seat.guest;
                  // Label sits a bit further out than the dot. Anchor
                  // is "end" on the left half of the table, "start" on
                  // the right half, so the text always grows away from
                  // the centre rather than crashing into the table.
                  // v1.22.5: label offset is dot edge + label-scaled
                  // breathing room. Decouples from dot size so picking
                  // L dots + S labels keeps the text close to the dot.
                  const labelOffset = dotOffset + 3.5 * dotScale + 8 * labelScale;
                  const lx = labelOffset * Math.cos(angle);
                  const ly = labelOffset * Math.sin(angle);
                  const textAnchor: "start" | "middle" | "end" =
                    lx < -2 ? "end" : lx > 2 ? "start" : "middle";
                  // Truncate to keep the canvas readable when names
                  // are long. First-name-only is the convention; a
                  // 10-char cap catches the rare "Christopher" case.
                  const firstName = seat.guest?.firstName ?? "";
                  const label = firstName.length > 10
                    ? `${firstName.slice(0, 9)}…`
                    : firstName;
                  const isDragOver = dragOverSeatId === seat.id;
                  return (
                    <g key={seat.id}>
                      {/* v1.20.6: invisible wider drop-zone behind the
                          visible dot — only rendered while a guest is
                          being dragged, so normal pointer events pass
                          through to the table-drag handler. */}
                      {canEdit && draggingGuestId && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={Math.max(14, 8 * dotScale)}
                          fill="transparent"
                          onDragEnter={(e) => {
                            e.preventDefault();
                            setDragOverSeatId(seat.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                          }}
                          onDragLeave={() => {
                            setDragOverSeatId((prev) => (prev === seat.id ? null : prev));
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const guestId =
                              e.dataTransfer.getData("guestId") || draggingGuestId;
                            if (guestId) dropOnSeat(seat.id, guestId);
                            setDraggingGuestId(null);
                            setDragOverSeatId(null);
                          }}
                          style={{ cursor: "copy" }}
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={3.5 * dotScale}
                        fill={
                          isDragOver
                            ? "var(--color-marigold-500)"
                            : occupied
                              ? "var(--color-moss-500)"
                              : "var(--color-canvas)"
                        }
                        stroke={
                          isDragOver
                            ? "var(--color-marigold-700)"
                            : occupied
                              ? "var(--color-moss-700)"
                              : "var(--color-border-strong)"
                        }
                        strokeWidth={isDragOver ? 2 : 1}
                        pointerEvents="none"
                      />
                      {occupied && (
                        <text
                          x={lx}
                          y={ly + 3 * labelScale}
                          textAnchor={textAnchor}
                          fontSize={9 * labelScale}
                          fill="var(--color-ink-secondary)"
                          pointerEvents="none"
                        >
                          {label}
                        </text>
                      )}
                    </g>
                  );
                })}
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
          <div className="bg-surface border border-border-soft rounded-md p-4 shadow-sm text-xs text-ink-tertiary space-y-3">
            <div>
              <strong className="block text-ink-secondary text-[11px] uppercase tracking-wider mb-1.5">
                Canvas
              </strong>
              {canEdit
                ? "Drag tables to reposition. Click to focus and assign seats. Arrow keys nudge the focused table; hold ⇧ for bigger steps."
                : "Click a table to view its seating. Editing is read-only for your role."}
            </div>
            {/* v1.22.6: snap-to-grid toggle. Persists via localStorage. */}
            {canEdit && (
              <div className="pt-3 border-t border-border-soft">
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={snapToGrid}
                    onChange={(e) => setSnapToGrid(e.target.checked)}
                    className="accent-moss-500"
                  />
                  <span className="uppercase tracking-wider font-bold">Snap to grid on drop</span>
                </label>
              </div>
            )}
            {/* v1.20.5: per-seat scale toggles. The user's picks
                persist across sessions via localStorage.
                v1.22.5: split into dot + label so they can be tuned
                independently ("bigger seats but not bigger labels"). */}
            <div className="pt-3 border-t border-border-soft space-y-2.5">
              <div>
                <strong className="block text-ink-secondary text-[11px] uppercase tracking-wider mb-1.5">
                  Seat dot size
                </strong>
                <div className="inline-flex gap-px bg-canvas border border-border-soft rounded-full p-0.5">
                  {([
                    { label: "S", value: 1.0 },
                    { label: "M", value: 1.4 },
                    { label: "L", value: 1.8 },
                    { label: "XL", value: 2.4 },
                  ] as const).map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setDotScale(opt.value)}
                      className={[
                        "text-xs px-3 py-0.5 rounded-full font-semibold transition-colors",
                        dotScale === opt.value
                          ? "bg-moss-500 text-white"
                          : "text-ink-tertiary hover:text-ink-primary",
                      ].join(" ")}
                      aria-pressed={dotScale === opt.value}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <strong className="block text-ink-secondary text-[11px] uppercase tracking-wider mb-1.5">
                  Seat label size
                </strong>
                <div className="inline-flex gap-px bg-canvas border border-border-soft rounded-full p-0.5">
                  {([
                    { label: "S", value: 1.0 },
                    { label: "M", value: 1.4 },
                    { label: "L", value: 1.8 },
                  ] as const).map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setLabelScale(opt.value)}
                      className={[
                        "text-xs px-3 py-0.5 rounded-full font-semibold transition-colors",
                        labelScale === opt.value
                          ? "bg-moss-500 text-white"
                          : "text-ink-tertiary hover:text-ink-primary",
                      ].join(" ")}
                      aria-pressed={labelScale === opt.value}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <AllGuestsPanel
          guests={allGuests}
          canEdit={canEdit}
          draggingGuestId={draggingGuestId}
          onDragStart={(id) => setDraggingGuestId(id)}
          onDragEnd={() => {
            setDraggingGuestId(null);
            setDragOverSeatId(null);
          }}
          onDropToUnseat={(id) => {
            dropOnPanel(id);
            setDraggingGuestId(null);
            setDragOverSeatId(null);
          }}
        />
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

  // v1.22.6: capacity +/- buttons. Shrink fails server-side if any of
  // the trailing seats are still assigned (the action throws with a
  // clear message); grow always succeeds within 1..40.
  function onCapacity(delta: 1 | -1) {
    const next = table.capacity + delta;
    if (next < 1 || next > 40) return;
    startTransition(async () => {
      try {
        await updateTableCapacity(table.id, next);
      } catch (err) {
        notify(
          "error",
          err instanceof Error ? err.message : "Couldn't change capacity",
        );
      }
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="flex items-start justify-between gap-2 px-4 py-3 border-b border-border-soft">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink-primary truncate">{table.name}</h2>
          <div className="text-[11px] text-ink-tertiary flex items-center gap-1.5">
            <span>{table.shape.toLowerCase()} · {filled}/{table.capacity} seated</span>
            {canEdit && (
              <span className="inline-flex items-center gap-0.5 ml-1">
                <button
                  type="button"
                  onClick={() => onCapacity(-1)}
                  disabled={pending || table.capacity <= 1}
                  className="w-4 h-4 leading-none rounded-sm border border-border-soft bg-canvas hover:border-moss-300 disabled:opacity-40 disabled:cursor-not-allowed text-ink-secondary"
                  aria-label="Remove a seat"
                  title="Remove a seat (must be empty)"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => onCapacity(1)}
                  disabled={pending || table.capacity >= 40}
                  className="w-4 h-4 leading-none rounded-sm border border-border-soft bg-canvas hover:border-moss-300 disabled:opacity-40 disabled:cursor-not-allowed text-ink-secondary"
                  aria-label="Add a seat"
                  title="Add a seat"
                >
                  +
                </button>
              </span>
            )}
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
                    {guestOptionLabel(g)}
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

// v1.20.6: replaces the pre-v1.20.6 UnseatedPanel. Shows ALL non-archived
// guests with their RSVP state at a glance + currently-seated table
// label. Each row is draggable (when canEdit); the panel itself is a
// drop target for unseating. Declined guests are hidden by default —
// they don't get seats, but the toggle exists so the user can scan
// for "did anyone I know declined?" if needed.
function AllGuestsPanel({
  guests,
  canEdit,
  draggingGuestId,
  onDragStart,
  onDragEnd,
  onDropToUnseat,
}: {
  guests: AllGuest[];
  canEdit: boolean;
  draggingGuestId: string | null;
  onDragStart: (guestId: string) => void;
  onDragEnd: () => void;
  onDropToUnseat: (guestId: string) => void;
}) {
  const [showDeclined, setShowDeclined] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const visible = guests.filter((g) => showDeclined || g.rsvp !== "DECLINED");
  // Order: attending unseated first (most actionable) → attending seated
  // → pending → maybe → declined.
  const ordered = [...visible].sort((a, b) => {
    const rank = (g: AllGuest) =>
      g.rsvp === "ATTENDING" && !g.currentSeatId
        ? 0
        : g.rsvp === "ATTENDING"
          ? 1
          : g.rsvp === "PENDING"
            ? 2
            : g.rsvp === "MAYBE"
              ? 3
              : 4;
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return a.firstName.localeCompare(b.firstName);
  });
  const visibleSlice = showAll ? ordered : ordered.slice(0, 18);

  const counts = guests.reduce(
    (acc, g) => {
      acc[g.rsvp] = (acc[g.rsvp] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <section
      className="bg-surface border border-border-soft rounded-md p-3 shadow-sm"
      onDragOver={
        canEdit && draggingGuestId
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          : undefined
      }
      onDrop={
        canEdit && draggingGuestId
          ? (e) => {
              e.preventDefault();
              const guestId = e.dataTransfer.getData("guestId") || draggingGuestId;
              if (guestId) onDropToUnseat(guestId);
            }
          : undefined
      }
    >
      <header className="flex items-baseline justify-between mb-2 gap-2">
        <strong className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
          Guests
        </strong>
        <span className="text-[11px] text-ink-tertiary tabular-nums">
          {counts.ATTENDING ?? 0} ✓ · {counts.PENDING ?? 0} ?
          {(counts.DECLINED ?? 0) > 0 && (
            <>
              {" "}
              · <button
                type="button"
                onClick={() => setShowDeclined((v) => !v)}
                className="underline hover:text-ink-primary"
              >
                {counts.DECLINED} ✗ {showDeclined ? "hide" : "show"}
              </button>
            </>
          )}
        </span>
      </header>
      {canEdit && (
        <p className="text-[10px] text-ink-tertiary mb-2 italic">
          Drag a guest onto a seat to assign · drag back here to unseat.
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {visibleSlice.map((g) => (
          <GuestRow
            key={g.id}
            guest={g}
            canEdit={canEdit}
            isDragging={draggingGuestId === g.id}
            onDragStart={() => onDragStart(g.id)}
            onDragEnd={onDragEnd}
          />
        ))}
      </ul>
      {ordered.length > 18 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-[11px] text-info hover:underline"
        >
          {showAll ? `Show first 18` : `Show all ${ordered.length}`}
        </button>
      )}
    </section>
  );
}

function GuestRow({
  guest,
  canEdit,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  guest: AllGuest;
  canEdit: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const tagClass =
    guest.rsvp === "ATTENDING"
      ? "text-moss-700 bg-moss-50 border-moss-100"
      : guest.rsvp === "PENDING"
        ? "text-marigold-700 bg-marigold-100 border-marigold-700/20"
        : guest.rsvp === "MAYBE"
          ? "text-info bg-[color:#eef4f5] dark:bg-muted border-[color:#d0e4e8] dark:border-border-soft"
          : "text-ink-tertiary bg-canvas border-border-soft";
  const tagLabel =
    guest.rsvp === "ATTENDING" ? "✓"
    : guest.rsvp === "PENDING" ? "?"
    : guest.rsvp === "MAYBE" ? "~"
    : "✗";
  return (
    <li
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.setData("guestId", guest.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={[
        "flex items-center gap-2 px-2 py-1 rounded-sm border text-xs",
        canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        isDragging ? "opacity-40 border-moss-300" : "border-transparent hover:border-border-soft hover:bg-canvas/50",
      ].join(" ")}
    >
      <span className={["text-[10px] font-bold px-1 rounded border flex-shrink-0", tagClass].join(" ")}>
        {tagLabel}
      </span>
      <span className="text-ink-primary flex-1 truncate">
        {guest.firstName} {guest.lastName}
      </span>
      {guest.currentTableName && (
        <span className="text-[10px] text-ink-tertiary flex-shrink-0">
          {guest.currentTableName}
        </span>
      )}
    </li>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
