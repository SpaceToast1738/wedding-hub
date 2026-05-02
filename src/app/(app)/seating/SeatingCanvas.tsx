"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import type { TableShape } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { assignGuestToSeat, deleteTable, updateTableCapacity, updateTablePosition } from "./actions";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { GuestDetailPanel } from "./GuestDetailPanel";
import {
  ChecklistContent,
  NotesContent,
  checklistRightSlot,
} from "./SeatingPlanPanel";
import type { AllGuest } from "./SeatingClient";

type Rsvp = "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";

type Seat = {
  id: string;
  index: number;
  // v1.22.7: rsvp on the guest so the dot can be colored by
  // attendance confirmation (moss / marigold / info / muted).
  guest: { id: string; firstName: string; lastName: string; rsvp: Rsvp } | null;
};

// Colors for the seat dots by RSVP. Mirrors the AllGuestsPanel tag
// palette so the visual language is consistent.
function dotFillForRsvp(rsvp: Rsvp): string {
  if (rsvp === "ATTENDING") return "var(--color-moss-500)";
  if (rsvp === "PENDING") return "var(--color-marigold-500)";
  if (rsvp === "MAYBE") return "var(--color-info)";
  return "var(--color-ink-tertiary)"; // declined — shouldn't usually have a seat
}
function dotStrokeForRsvp(rsvp: Rsvp): string {
  if (rsvp === "ATTENDING") return "var(--color-moss-700)";
  if (rsvp === "PENDING") return "var(--color-marigold-700)";
  if (rsvp === "MAYBE") return "var(--color-info)";
  return "var(--color-border-strong)";
}

// v1.22.8: glyph reinforces the RSVP color so the canvas reads
// correctly for colour-blind users and at small dot sizes (where
// hue alone gets ambiguous). Mirrors the AllGuestsPanel tag chars
// exactly so the visual language is consistent across surfaces.
function seatGlyphForRsvp(rsvp: Rsvp): string {
  if (rsvp === "ATTENDING") return "✓";
  if (rsvp === "PENDING") return "?";
  if (rsvp === "MAYBE") return "~";
  return "✗";
}

// v1.23.0: notes + checklist threaded through. UI in FocusPanel +
// TableCard surfaces edit controls; canvas dot rendering ignores them.
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
// v1.23.2: padding around the auto-cropped viewBox so seat dots and
// labels don't bump into the canvas edge.
const CROP_PADDING = 80;
// v1.22.7: grid is now user-resizable. Default M=20 matches the
// pre-v1.22.7 fixed value. Both the visual pattern and the snap
// math read off this value at render time.
const GRID_OPTIONS = [
  { label: "S", value: 10 },
  { label: "M", value: 20 },
  { label: "L", value: 30 },
  { label: "XL", value: 40 },
] as const;
const GRID_VALUES = GRID_OPTIONS.map((o) => o.value);

// v1.22.7: scale toggles unified to S/M/L/XL across all sizing
// features (dot, label, grid). The pre-v1.22.7 label-M (1.4) was
// "too cramped" per user feedback — bumped to 1.6, which sits
// between the old M and L. Dot scale stays 1.0/1.6/2.0/2.5 to
// match the label spacing visually.
const SCALE_OPTIONS = [
  { label: "S", value: 1.0 },
  { label: "M", value: 1.6 },
  { label: "L", value: 2.0 },
  { label: "XL", value: 2.5 },
] as const;
const SCALE_VALUES = SCALE_OPTIONS.map((o) => o.value);

// v1.22.6: SNAP_RADIUS removed. Snap behaviour is now an explicit
// user-controlled toggle (`snapToGrid` state) — either always snap on
// drop, or never. The pre-v1.22.6 "soft snap within ±10px tolerance"
// was confusing in practice (rarely fired).

function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

// Visual sizing — purely cosmetic. v1.25.3 introduced the 10-seat
// baseline (capacity tweaks 8↔10 don't reflow the table). v1.27.1
// scopes that baseline to ROUND only — HEAD and RECTANGLE go back
// to capacity-driven sizing because their seats sit along edges,
// where unused capacity creates obvious empty stretches that look
// odd on a fixed-size table.
const SIZE_BASELINE_CAP = 10;
function tableSize(shape: TableShape, capacity: number): { w: number; h: number; r: number } {
  if (shape === "ROUND") {
    // ROUND: fixed at 10-seat baseline, grows beyond that.
    const sizingCap = Math.max(capacity, SIZE_BASELINE_CAP);
    const r = 36 + sizingCap * 4;
    return { w: r * 2, h: r * 2, r };
  }
  if (shape === "HEAD") {
    // v1.23.0: bumped per-seat width (18→30) + base (80→110) and
    // height (70→80). v1.27.1: capacity-driven again — HEAD seats
    // sit along the front edge, fixed-width with sparse seats
    // looked off.
    return { w: 110 + capacity * 30, h: 80, r: 0 };
  }
  // RECTANGLE — capacity-driven.
  return { w: 70 + capacity * 14, h: 60, r: 0 };
}

// v1.22.7: per-seat dot/label layout per shape.
//   ROUND — radial around perimeter, anchor flips left/right by hemisphere.
//   HEAD  — single row along the front (bottom) edge — guests face the room.
//   RECTANGLE — split between top and bottom edges, half each (top gets the
//               extra seat when capacity is odd).
type SeatLayout = {
  cx: number;
  cy: number;
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "middle" | "end";
};

function computeSeatLayouts(
  shape: TableShape,
  capacity: number,
  size: { w: number; h: number; r: number },
  dotScale: number,
  labelScale: number,
): SeatLayout[] {
  if (shape === "ROUND") {
    return Array.from({ length: capacity }, (_, i) => {
      // -90° offset puts seat 0 at the top of the circle, matching how
      // a host typically reads round-table seating ("twelve o'clock first").
      const angle = (i / capacity) * 2 * Math.PI - Math.PI / 2;
      const dotOffset = size.r + 8 * dotScale;
      const cx = dotOffset * Math.cos(angle);
      const cy = dotOffset * Math.sin(angle);
      const labelOffset = dotOffset + 3.5 * dotScale + 8 * labelScale;
      const lx = labelOffset * Math.cos(angle);
      const ly = labelOffset * Math.sin(angle) + 3 * labelScale;
      const labelAnchor: "start" | "middle" | "end" =
        lx < -2 ? "end" : lx > 2 ? "start" : "middle";
      return { cx, cy, labelX: lx, labelY: ly, labelAnchor };
    });
  }
  // v1.22.10: explicit dot-edge + padding label spacing for HEAD +
  // RECTANGLE so labels don't crowd the dots. SVG <text> y is the
  // *baseline*; visible glyphs extend ~0.8*fontSize above and
  // ~0.2*fontSize below that. fontSize = 9 * labelScale, so:
  //   - label ABOVE dot: baseline at dot.top - GAP - 0.2*fontSize
  //   - label BELOW dot: baseline at dot.bottom + GAP + 0.8*fontSize
  // GAP keeps a constant pixel breathing room independent of scale.
  const dotR = 3.5 * dotScale;
  const fontSize = 9 * labelScale;
  const GAP = 4;
  const labelYAbove = (cy: number) => cy - dotR - GAP - 0.2 * fontSize;
  const labelYBelow = (cy: number) => cy + dotR + GAP + 0.8 * fontSize;

  if (shape === "HEAD") {
    // v1.22.9: flipped from bottom→top edge. The "head" table by
    // convention sits behind the couple at the head of the room with
    // guests *facing* the room — so seats on the back side (top of
    // the rendered rect) reads more naturally on the floorplan.
    return Array.from({ length: capacity }, (_, i) => {
      const cx = -size.w / 2 + ((i + 0.5) * size.w) / capacity;
      const cy = -size.h / 2 - 8 * dotScale;
      return { cx, cy, labelX: cx, labelY: labelYAbove(cy), labelAnchor: "middle" };
    });
  }
  // RECTANGLE — split top/bottom edges, top takes the extra when odd.
  const topCount = Math.ceil(capacity / 2);
  const bottomCount = capacity - topCount;
  return Array.from({ length: capacity }, (_, i) => {
    const onTop = i < topCount;
    const localIdx = onTop ? i : i - topCount;
    const localTotal = onTop ? topCount : bottomCount;
    const cx = -size.w / 2 + ((localIdx + 0.5) * size.w) / localTotal;
    const cy = onTop ? -size.h / 2 - 8 * dotScale : size.h / 2 + 8 * dotScale;
    const labelY = onTop ? labelYAbove(cy) : labelYBelow(cy);
    return { cx, cy, labelX: cx, labelY, labelAnchor: "middle" };
  });
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
  allGuestGroups,
  canEdit,
  seatingNotes,
  seatingChecklist,
}: {
  tables: Table[];
  unseatedGuests: GuestOpt[];
  allGuests: AllGuest[];
  // v1.49.0: passed through to GuestDetailPanel for the read-only
  // chip strip; not used by the canvas itself.
  allGuestGroups: import("@/components/ui/GuestGroupsControl").GuestGroupSummary[];
  canEdit: boolean;
  // v1.23.2: notes + checklist render in the right sidebar wrapped
  // in CollapsiblePanel.
  seatingNotes: string;
  seatingChecklist: { id: string; label: string; done: boolean }[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // v1.23.2: detect coarse-pointer (touch) devices so we can disable
  // table drag on mobile. The canvas is fundamentally desktop-first;
  // on a phone the user wants to view + tap-to-focus, not wrestle
  // with hit-targets and accidental drags. List view is the touch-
  // friendly mode.
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setIsCoarsePointer(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsCoarsePointer(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const dragEnabled = canEdit && !isCoarsePointer;

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
  // v1.22.7: defaults bumped to M=1.6 (the new uniform M).
  const [labelScale, setLabelScale] = useState<number>(1.6);
  const [dotScale, setDotScale] = useState<number>(1.6);
  // v1.22.6: snap-to-grid toggle. Pre-fix the snap-on-drop only fired
  // when the drop landed within ±10px of a grid point — the rest of
  // the time tables stayed wherever the drag ended (off-grid). User
  // wants alignment, so the new toggle lets them say "always snap on
  // drop". Default on (alignment is the planner's stated goal).
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  // v1.22.7: user-controlled grid size. The visible <pattern> and the
  // snap-on-drop both read this. Persisted via localStorage.
  const [gridSize, setGridSize] = useState<number>(20);
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
  // v1.22.9: pointer-event-based drag for canvas seat-to-seat re-seating.
  // v1.22.7's `draggable={true}` on SVG <circle> turned out to be flaky
  // across browsers — Chrome/Firefox/Safari each handle it differently
  // and several users couldn't drag a seat at all. Pointer events work
  // identically everywhere (same primitive the table-drag uses). Drops
  // from the AllGuestsPanel still use HTML5 drag (works because the
  // source there is a regular HTML <li>); only the canvas-source drag
  // is pointer-based.
  const [seatDrag, setSeatDrag] = useState<
    | {
        guestId: string;
        fromSeatId: string;
        // v1.22.10: track the source's RSVP + first name so the ghost
        // dot rendered at the cursor matches the source visually.
        rsvp: Rsvp;
        firstName: string;
        pointerId: number;
        startX: number;
        startY: number;
        moved: boolean;
        // v1.25.1: cursorX / cursorY removed from state — the ghost
        // now updates via refs (see ghostCircleRef etc) so we don't
        // re-render the entire SeatingCanvas tree on every pointermove.
        // v1.25.0: cursor's offset from the source seat's centre at
        // drag start, in SVG-userspace coords. Subtracting offsetX/Y
        // from the live cursor on render keeps the ghost wherever the
        // user first grabbed it.
        offsetX: number;
        offsetY: number;
      }
    | null
  >(null);

  // v1.25.1: ghost-render refs. Pre-fix `setSeatDrag({ cursorX, cursorY,
  // ... })` on every pointermove caused a full re-render of the canvas
  // (every table + seat dot + drop-zone), which lagged behind the
  // cursor on real layouts. Imperatively setting SVG attributes via
  // refs sidesteps React reconciliation entirely — the ghost tracks
  // the cursor at native rate.
  // v1.27.1: single <g transform> ref instead of three child refs.
  // Pre-fix every pointermove wrote 5 SVG attributes (circle.cx/cy,
  // glyph.x/y, label.x/y) — each invalidates SVG layout. Browsers
  // composite a single `transform` change much more cheaply, often
  // GPU-accelerated when paired with `will-change: transform`. The
  // ghost children stay anchored at (0, 0) inside the group.
  const ghostGroupRef = useRef<SVGGElement>(null);
  // RAF guard for the dragOverSeatId update — findSeatAt is O(n*m),
  // throttled to once per animation frame so it doesn't dominate the
  // pointermove cost.
  const findSeatAtRafRef = useRef<number | null>(null);
  // Last known cursor in SVG-userspace coords. Populated on every
  // pointer event during a seat drag. The useLayoutEffect below uses
  // this to position the ghost on its first render (the moment
  // `seatDrag.moved` flips true, before any subsequent pointermove
  // can write the refs).
  const cursorPosRef = useRef<{ x: number; y: number } | null>(null);

  // v1.25.1: when the ghost group first mounts (moved → true), seed
  // its position from the live cursor. Prevents a single-frame paint
  // at (0, 0) before pointermove writes the real values. Subsequent
  // pointermoves bypass React entirely (see onPointerMove handler).
  // v1.27.1: single transform write on the group instead of 5
  // separate attributes — composite-friendly + cheaper.
  const ghostMounted = !!seatDrag?.moved;
  useLayoutEffect(() => {
    if (!ghostMounted) return;
    const cursor = cursorPosRef.current;
    const offset = seatDrag ? { x: seatDrag.offsetX, y: seatDrag.offsetY } : null;
    if (!cursor || !offset) return;
    const gx = cursor.x - offset.x;
    const gy = cursor.y - offset.y;
    if (ghostGroupRef.current) {
      ghostGroupRef.current.setAttribute("transform", `translate(${gx} ${gy})`);
    }
    // Only depend on `ghostMounted`; offset+cursor read from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostMounted]);

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
      // v1.22.7: scales now live in SCALE_VALUES (1.0/1.6/2.0/2.5).
      // Old values (1.4 / 1.8 / 2.4) silently reset to default M=1.6
      // — minor footgun for users who picked a size in v1.22.5/6, but
      // the toggle is right there to re-pick.
      const savedLabel = localStorage.getItem("wh_seating_label_scale");
      if (savedLabel) {
        const n = Number(savedLabel);
        if ((SCALE_VALUES as readonly number[]).includes(n)) setLabelScale(n);
      }
      const savedDot = localStorage.getItem("wh_seating_dot_scale");
      if (savedDot) {
        const n = Number(savedDot);
        if ((SCALE_VALUES as readonly number[]).includes(n)) setDotScale(n);
      }
      const savedSnap = localStorage.getItem("wh_seating_snap_to_grid");
      if (savedSnap === "true" || savedSnap === "false") setSnapToGrid(savedSnap === "true");
      const savedGrid = localStorage.getItem("wh_seating_grid_size");
      if (savedGrid) {
        const n = Number(savedGrid);
        if ((GRID_VALUES as readonly number[]).includes(n)) setGridSize(n);
      }
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
    if (!loaded) return;
    try {
      localStorage.setItem("wh_seating_grid_size", String(gridSize));
    } catch {
      // ignore
    }
  }, [gridSize, loaded]);

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
  // v1.57.0 (XL11): on mount, honour `#table-<id>` URL fragment from
  // a deep-link (guest list / detail page chip → /seating). Sets the
  // focused table so the existing focus chrome (highlight + sidebar
  // panel) does the work; planner sees their target without scrolling
  // through 20 tables. One-shot: only fires on first mount, ignores
  // hash changes thereafter (the user isn't expected to type fragments
  // by hand).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const m = /^#table-(.+)$/.exec(hash);
    if (!m) return;
    const targetId = m[1] ?? "";
    if (targetId && initialTables.some((t) => t.id === targetId)) {
      setFocusedId(targetId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // v1.27.7: focused-guest state for the GuestDetailPanel that opens
  // when the planner clicks (no drag) a seated guest dot. Mutually
  // exclusive with focused-table — selecting a guest closes any
  // table focus and vice versa, so only one entity is "selected" at
  // a time in the sidebar.
  const [focusedGuestId, setFocusedGuestId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // v1.23.2: auto-crop viewBox to fit the actual tables — declared
  // before clientToSvg below because the helper closes over it for
  // pointer→userspace conversions. See longer comment further down.
  // v1.23.3: the viewBox is *frozen* while a table or seat drag is
  // in progress. Pre-fix the bounds recomputed on every pointermove
  // (because they depend on `positions`), which (a) made the canvas
  // shimmer/zoom on every cursor tick and (b) drifted the dragged
  // table off the cursor — `clientToSvg` reads the live viewBox to
  // convert pointer coords, so changing it mid-drag shifted the
  // mapping. Freezing during a drag, then recomputing on release,
  // gives a stable drag and a clean re-fit when the drag settles.
  const computedViewBox = useMemo(() => {
    if (initialTables.length === 0) {
      return { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of initialTables) {
      const pos = positions[t.id] ?? { x: t.posX, y: t.posY };
      const size = tableSize(t.shape, t.capacity);
      const halfW = size.r > 0 ? size.r : size.w / 2;
      const halfH = size.r > 0 ? size.r : size.h / 2;
      const seatExtent = 8 * dotScale + 3.5 * dotScale + 14 * labelScale;
      const reach = Math.max(halfW, halfH) + seatExtent;
      minX = Math.min(minX, pos.x - reach);
      minY = Math.min(minY, pos.y - reach);
      maxX = Math.max(maxX, pos.x + reach);
      maxY = Math.max(maxY, pos.y + reach);
    }
    const pad = CROP_PADDING;
    const x = Math.max(0, minX - pad);
    const y = Math.max(0, minY - pad);
    const w = Math.min(CANVAS_W, maxX + pad) - x;
    const h = Math.min(CANVAS_H, maxY + pad) - y;
    return { x, y, w: Math.max(200, w), h: Math.max(200, h) };
  }, [initialTables, positions, dotScale, labelScale]);
  const [stableViewBox, setStableViewBox] = useState(computedViewBox);
  // `drag` (table) declared at line ~427 above; `seatDrag` at ~311.
  // Both are read here — when neither is active, mirror the latest
  // computed bounds. Effect runs on every drag-end transition so the
  // post-drop layout settles into a freshly cropped viewBox without
  // an extra render.
  useEffect(() => {
    if (drag || seatDrag) return;
    setStableViewBox(computedViewBox);
  }, [computedViewBox, drag, seatDrag]);
  const viewBox = stableViewBox;

  // Convert client coords (mouse) to SVG userspace coords.
  // v1.23.2: honours the dynamic viewBox — pre-fix this assumed the
  // viewBox was always 0,0,1400,900, so cropped layouts had drag math
  // that drifted by the crop offset.
  const clientToSvg = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const x = viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.w;
      const y = viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.h;
      return { x, y };
    },
    [viewBox.x, viewBox.y, viewBox.w, viewBox.h],
  );

  // v1.22.9: hit-test which seat (if any) is under a given SVG-userspace
  // point. Walks tables, applies their rotation to compute world-space
  // seat centres, then checks distance against a generous drop radius.
  const findSeatAt = useCallback(
    (x: number, y: number): string | null => {
      const dropR = Math.max(14, 8 * dotScale);
      for (const t of initialTables) {
        const pos = positions[t.id] ?? { x: t.posX, y: t.posY };
        const size = tableSize(t.shape, t.capacity);
        const layouts = computeSeatLayouts(t.shape, t.capacity, size, dotScale, labelScale);
        const cosR = Math.cos((t.rotation * Math.PI) / 180);
        const sinR = Math.sin((t.rotation * Math.PI) / 180);
        for (let i = 0; i < t.seats.length; i++) {
          const layout = layouts[i]!;
          // Apply table rotation to seat-local coords.
          const seatX = pos.x + layout.cx * cosR - layout.cy * sinR;
          const seatY = pos.y + layout.cx * sinR + layout.cy * cosR;
          if (Math.hypot(x - seatX, y - seatY) <= dropR) {
            return t.seats[i]!.id;
          }
        }
      }
      return null;
    },
    [initialTables, positions, dotScale, labelScale],
  );

  function startDrag(e: React.PointerEvent<SVGGElement>, t: Table) {
    // v1.23.2: drag disabled on coarse-pointer (touch) devices —
    // tap focuses the table instead. Read-only roles keep the same
    // tap-to-focus behaviour they always had.
    if (!dragEnabled) {
      setFocusedId(t.id);
      return;
    }
    // v1.22.7: if the user clicked a seat's drag-source layer (an
    // HTML5-draggable circle on top of the dot), don't start a table
    // drag — let the HTML5 drag handle the seat-to-seat reseat. Still
    // focus the table so the side panel reflects the click.
    const target = e.target as Element | null;
    if (target?.getAttribute?.("draggable") === "true") {
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
      // v1.22.7: was a toggle (cur === id ? null : id). Race-y because
      // the table's `<g>` is `tabIndex=0` so it gains browser focus on
      // mousedown, which fires `onFocus` and sets focusedId mid-flight.
      // The pointerup toggle then *un*set it on the very same click.
      // Fix: just set; deselection happens via the × button.
      // v1.27.7: also clear any focused guest — sidebar selection is
      // mutually exclusive.
      setFocusedGuestId(null);
      setFocusedId(id);
      return;
    }

    const live = positions[id];
    if (!live) return;
    // v1.22.6: snap toggle. When on, every drop snaps to the nearest
    // grid point — easy alignment of multiple tables. When off, drop
    // wherever the cursor lands. Pre-v1.22.6 behaviour was a "soft
    // snap" within ±10px tolerance, which almost never fired in
    // practice; replaced with the explicit toggle.
    // v1.22.7: snap math reads the user-controlled `gridSize`.
    let final: { x: number; y: number };
    if (snapToGrid) {
      final = { x: snap(live.x, gridSize), y: snap(live.y, gridSize) };
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
      const step = e.shiftKey ? gridSize * 4 : gridSize;
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
  }, [canEdit, focusedId, gridSize]);

  const focusedTable = useMemo(
    () => initialTables.find((t) => t.id === focusedId) ?? null,
    [initialTables, focusedId],
  );
  // v1.27.7: focused guest from allGuests by id. Falls back to null
  // if the id is stale (e.g. the guest was unseated by another tab
  // mid-session); the panel won't render in that case.
  const focusedGuest = useMemo(
    () => (focusedGuestId ? allGuests.find((g) => g.id === focusedGuestId) ?? null : null),
    [allGuests, focusedGuestId],
  );

  // viewBox auto-crop is declared earlier (above clientToSvg) so the
  // pointer-conversion helper can close over it.

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden min-h-0" ref={containerRef}>
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {/* v1.25.1: mobile-only hint that table dragging is desktop-
            only. The canvas-settings panel says the same in its body
            but starts collapsed; this banner makes the limit obvious
            without the user having to dig. */}
        {canEdit && isCoarsePointer && (
          <div className="lg:hidden bg-marigold-100/40 border border-marigold-700/20 text-marigold-700 rounded-md px-3 py-1.5 text-[11px]">
            ⓘ Tap a table to focus. Drag-to-reposition is desktop-only.
          </div>
        )}
        {/* v1.25.1: bumped mobile canvas height. Pre-fix
            `min-h-[400px]` left the canvas tiny on tall phones with
            lots of vertical space below it. 60vh on mobile gives the
            canvas the dominant share of the viewport; lg+ flips back
            to 400px since the canvas takes flex-row width there. */}
        <div className="flex-1 bg-surface border border-border-soft rounded-md shadow-sm overflow-hidden min-h-[60vh] lg:min-h-[400px]">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full block touch-none select-none"
          style={{ background: "var(--color-canvas)" }}
        >
          <defs>
            {/* v1.22.7: pattern step is the user-controlled gridSize. */}
            <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
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
                style={{ cursor: dragEnabled ? (isDragging ? "grabbing" : "grab") : "pointer" }}
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
                    v1.16.0 added first-name labels.
                    v1.22.7 extends to HEAD + RECTANGLE shapes, colors
                    dots by RSVP status (attendance markers), and adds
                    a draggable layer per occupied seat for canvas
                    seat-to-seat reseating. */}
                {(() => {
                  const layouts = computeSeatLayouts(t.shape, t.capacity, size, dotScale, labelScale);
                  // v1.22.9: dynamic truncation. For HEAD/RECTANGLE the
                  // labels sit above/below dots and would overlap when
                  // capacity is small + names are long. ROUND labels
                  // are radial so the per-seat horizontal budget is
                  // generous; we only cap at 14 chars there. Approx
                  // glyph width ~5.5 * labelScale.
                  const charPx = 5.5 * labelScale;
                  let maxChars: number;
                  if (t.shape === "ROUND") {
                    maxChars = 14;
                  } else if (t.shape === "HEAD") {
                    maxChars = Math.max(4, Math.floor(size.w / t.capacity / charPx));
                  } else {
                    // RECTANGLE: budget is split top/bottom (each side
                    // has roughly capacity/2 seats sharing size.w).
                    const perSide = Math.ceil(t.capacity / 2);
                    maxChars = Math.max(4, Math.floor(size.w / perSide / charPx));
                  }
                  return t.seats.map((seat, i) => {
                    const layout = layouts[i]!;
                    const occupied = !!seat.guest;
                    const isDragOver = dragOverSeatId === seat.id;
                    const guestRsvp = seat.guest?.rsvp;
                    const fillColor = isDragOver
                      ? "var(--color-marigold-500)"
                      : occupied
                        ? dotFillForRsvp(guestRsvp!)
                        : "var(--color-canvas)";
                    const strokeColor = isDragOver
                      ? "var(--color-marigold-700)"
                      : occupied
                        ? dotStrokeForRsvp(guestRsvp!)
                        : "var(--color-border-strong)";
                    const firstName = seat.guest?.firstName ?? "";
                    const label = firstName.length > maxChars
                      ? `${firstName.slice(0, maxChars - 1)}…`
                      : firstName;
                    return (
                      <g key={seat.id}>
                        {/* v1.22.9: pointer-event drag-source. Replaces
                            v1.22.7's HTML5 `draggable` attribute, which
                            was unreliable on SVG <circle>. PointerDown
                            captures the pointer, pointerMove tracks
                            position + sets state when threshold passed,
                            pointerUp commits to nearest seat (or unseats
                            if dropped outside). Stops propagation so the
                            table-drag handler never fires. */}
                        {canEdit && occupied && (
                          <circle
                            cx={layout.cx}
                            cy={layout.cy}
                            r={Math.max(12, 8 * dotScale)}
                            fill="transparent"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              (e.currentTarget as Element).setPointerCapture(e.pointerId);
                              const p = clientToSvg(e.clientX, e.clientY);
                              // v1.25.0: compute the seat's world-
                              // space (SVG-userspace) position from its
                              // table-local layout + table position +
                              // table rotation. The offset between
                              // cursor and seat centre at grab time is
                              // preserved across the drag so the ghost
                              // doesn't "jump" to cursor-centre.
                              const tablePos = positions[t.id] ?? { x: t.posX, y: t.posY };
                              const cosR = Math.cos((t.rotation * Math.PI) / 180);
                              const sinR = Math.sin((t.rotation * Math.PI) / 180);
                              const seatWorldX = tablePos.x + layout.cx * cosR - layout.cy * sinR;
                              const seatWorldY = tablePos.y + layout.cx * sinR + layout.cy * cosR;
                              cursorPosRef.current = { x: p.x, y: p.y };
                              setSeatDrag({
                                guestId: seat.guest!.id,
                                fromSeatId: seat.id,
                                rsvp: seat.guest!.rsvp,
                                firstName: seat.guest!.firstName,
                                pointerId: e.pointerId,
                                startX: e.clientX,
                                startY: e.clientY,
                                moved: false,
                                offsetX: p.x - seatWorldX,
                                offsetY: p.y - seatWorldY,
                              });
                            }}
                            onPointerMove={(e) => {
                              if (!seatDrag) return;
                              if (e.pointerId !== seatDrag.pointerId) return;
                              const dx = e.clientX - seatDrag.startX;
                              const dy = e.clientY - seatDrag.startY;
                              const p = clientToSvg(e.clientX, e.clientY);
                              cursorPosRef.current = { x: p.x, y: p.y };
                              const becameMoved = !seatDrag.moved && Math.hypot(dx, dy) > 4;
                              // v1.25.1: ghost position via direct DOM
                              // attribute writes — no React state, no
                              // re-render. The ghost tracks the cursor
                              // at native rate even on canvases with
                              // many tables.
                              if (seatDrag.moved || becameMoved) {
                                const gx = p.x - seatDrag.offsetX;
                                const gy = p.y - seatDrag.offsetY;
                                // v1.27.1: single transform attribute on
                                // the ghost group — much cheaper than
                                // five separate cx/cy/x/y writes (each
                                // of which invalidates SVG layout).
                                if (ghostGroupRef.current) {
                                  ghostGroupRef.current.setAttribute(
                                    "transform",
                                    `translate(${gx} ${gy})`,
                                  );
                                }
                                // v1.25.1: throttle the O(n*m) seat hit-
                                // test to once per animation frame.
                                if (findSeatAtRafRef.current === null) {
                                  findSeatAtRafRef.current = requestAnimationFrame(() => {
                                    findSeatAtRafRef.current = null;
                                    setDragOverSeatId(findSeatAt(p.x, p.y));
                                  });
                                }
                              }
                              if (becameMoved) {
                                setDraggingGuestId(seatDrag.guestId);
                                setSeatDrag({ ...seatDrag, moved: true });
                              }
                            }}
                            onPointerUp={(e) => {
                              if (!seatDrag) return;
                              if (e.pointerId !== seatDrag.pointerId) return;
                              const ds = seatDrag;
                              // v1.25.1: cancel any pending RAF hit-test
                              // so it doesn't fire after seatDrag is null.
                              if (findSeatAtRafRef.current !== null) {
                                cancelAnimationFrame(findSeatAtRafRef.current);
                                findSeatAtRafRef.current = null;
                              }
                              setSeatDrag(null);
                              setDraggingGuestId(null);
                              setDragOverSeatId(null);
                              if (!ds.moved) {
                                // v1.27.7: plain click on a seated
                                // guest dot opens the GuestDetailPanel
                                // in the sidebar. Closes any focused
                                // table — selection is mutually
                                // exclusive between the two.
                                setFocusedId(null);
                                setFocusedGuestId(ds.guestId);
                                return;
                              }
                              const p = clientToSvg(e.clientX, e.clientY);
                              const overId = findSeatAt(p.x, p.y);
                              if (overId && overId !== ds.fromSeatId) {
                                dropOnSeat(overId, ds.guestId);
                              } else if (overId === null) {
                                // Dropped outside any seat — unseat.
                                dropOnPanel(ds.guestId);
                              }
                            }}
                            onPointerCancel={() => {
                              if (findSeatAtRafRef.current !== null) {
                                cancelAnimationFrame(findSeatAtRafRef.current);
                                findSeatAtRafRef.current = null;
                              }
                              setSeatDrag(null);
                              setDraggingGuestId(null);
                              setDragOverSeatId(null);
                            }}
                            style={{ cursor: seatDrag?.fromSeatId === seat.id ? "grabbing" : "grab" }}
                          />
                        )}
                        {/* v1.20.6: drop-zone — only renders during a
                            drag, sits ABOVE the drag-source so dragOver
                            events hit it (not the source). */}
                        {canEdit && draggingGuestId && (
                          <circle
                            cx={layout.cx}
                            cy={layout.cy}
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
                          cx={layout.cx}
                          cy={layout.cy}
                          r={3.5 * dotScale}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={isDragOver ? 2 : 1}
                          pointerEvents="none"
                        />
                        {/* v1.22.8: white RSVP glyph inside the dot
                            (✓ / ? / ~ / ✗). v1.22.10: use
                            dominantBaseline="central" for proper
                            vertical centering across font sizes —
                            pre-fix the fudge offset (cy + 1.4*dotScale)
                            was inconsistent across S/M/L/XL. */}
                        {occupied && dotScale >= 1.4 && (
                          <text
                            x={layout.cx}
                            y={layout.cy}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={4.8 * dotScale}
                            fontWeight={700}
                            fill="white"
                            pointerEvents="none"
                            style={{ userSelect: "none" }}
                          >
                            {seatGlyphForRsvp(guestRsvp!)}
                          </text>
                        )}
                        {occupied && (
                          <text
                            x={layout.labelX}
                            y={layout.labelY}
                            textAnchor={layout.labelAnchor}
                            fontSize={9 * labelScale}
                            fill="var(--color-ink-secondary)"
                            pointerEvents="none"
                          >
                            {label}
                          </text>
                        )}
                      </g>
                    );
                  });
                })()}
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
          {/* v1.22.10: alignment guides during table-drag. When the
              dragged table's centre lines up with another table's
              centre on either axis (within 4px), draw a faint dashed
              line all the way across the canvas to help the user
              snap rows/columns of tables into formation. Only the
              tables being lined up against the dragged one are
              considered — keeps the lines uncluttered. */}
          {drag?.id && (() => {
            const draggedPos = positions[drag.id];
            if (!draggedPos) return null;
            const TOLERANCE = 4;
            const lines: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = [];
            for (const t of initialTables) {
              if (t.id === drag.id) continue;
              const otherPos = positions[t.id] ?? { x: t.posX, y: t.posY };
              if (Math.abs(otherPos.x - draggedPos.x) <= TOLERANCE) {
                lines.push({ key: `vx-${t.id}`, x1: otherPos.x, y1: 0, x2: otherPos.x, y2: CANVAS_H });
              }
              if (Math.abs(otherPos.y - draggedPos.y) <= TOLERANCE) {
                lines.push({ key: `vy-${t.id}`, x1: 0, y1: otherPos.y, x2: CANVAS_W, y2: otherPos.y });
              }
            }
            return lines.map((l) => (
              <line
                key={l.key}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="var(--color-marigold-500)"
                strokeWidth={1}
                strokeDasharray="6 6"
                opacity={0.7}
                pointerEvents="none"
              />
            ));
          })()}
          {/* v1.22.10: ghost dot for canvas seat-drag.
              v1.27.1: single <g transform> with children at (0, 0).
              Per-move work shrinks to one attribute write; the
              browser composites the translation cheaply, often on
              the GPU when paired with `will-change: transform`. */}
          {seatDrag?.moved && (
            <g
              ref={ghostGroupRef}
              pointerEvents="none"
              opacity={0.7}
              transform="translate(0 0)"
              style={{ willChange: "transform" }}
            >
              <circle
                cx={0}
                cy={0}
                r={3.5 * dotScale}
                fill={dotFillForRsvp(seatDrag.rsvp)}
                stroke={dotStrokeForRsvp(seatDrag.rsvp)}
                strokeWidth={1.5}
              />
              {dotScale >= 1.4 && (
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={4.8 * dotScale}
                  fontWeight={700}
                  fill="white"
                >
                  {seatGlyphForRsvp(seatDrag.rsvp)}
                </text>
              )}
              <text
                x={0}
                y={3.5 * dotScale + 4 + 0.8 * 9 * labelScale}
                textAnchor="middle"
                fontSize={9 * labelScale}
                fill="var(--color-ink-secondary)"
              >
                {seatDrag.firstName.length > 14
                  ? `${seatDrag.firstName.slice(0, 13)}…`
                  : seatDrag.firstName}
              </text>
            </g>
          )}
        </svg>
        </div>
      </div>

      <aside className="lg:w-80 flex-shrink-0 flex flex-col gap-3 lg:max-h-full overflow-auto">
        {/* v1.23.2: every sidebar section wrapped in CollapsiblePanel
            with state persisted to localStorage. Selected table only
            renders when a table is focused; all the others always
            render but start collapsed where listed below. */}
        {focusedTable && (
          <CollapsiblePanel
            storageKey="wh_seating_panel_focus"
            title={`Selected: ${focusedTable.name}`}
            defaultOpen
            rightSlot={
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusedId(null);
                }}
                aria-label="Close focus"
                className="text-ink-tertiary hover:text-ink-primary text-base leading-none px-1"
              >
                ×
              </button>
            }
          >
            <FocusPanelBody
              table={focusedTable}
              unseatedGuests={unseatedGuests}
              canEdit={canEdit}
              onClose={() => setFocusedId(null)}
            />
          </CollapsiblePanel>
        )}
        {/* v1.27.7: GuestDetailPanel — shows when the planner clicks
            (no drag) a seated guest dot. Mutually exclusive with the
            table FocusPanel above; the click handler swaps focus. */}
        {focusedGuest && (
          <CollapsiblePanel
            storageKey="wh_seating_panel_guest_focus"
            title={`Guest: ${focusedGuest.firstName}`}
            defaultOpen
            rightSlot={
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusedGuestId(null);
                }}
                aria-label="Close guest detail"
                className="text-ink-tertiary hover:text-ink-primary text-base leading-none px-1"
              >
                ×
              </button>
            }
          >
            <GuestDetailPanel
              guest={focusedGuest}
              allGuestGroups={allGuestGroups}
              onClose={() => setFocusedGuestId(null)}
            />
          </CollapsiblePanel>
        )}
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
        <CollapsiblePanel
          storageKey="wh_seating_panel_guests"
          title="Guests"
          defaultOpen
        >
          <AllGuestsPanelBody
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
        </CollapsiblePanel>
        <CollapsiblePanel
          storageKey="wh_seating_panel_settings"
          title="Canvas settings"
          defaultOpen={false}
        >
          <div className="p-3 text-xs text-ink-tertiary space-y-3">
            <p>
              {canEdit
                ? isCoarsePointer
                  ? "Tap a table to focus. Drag-to-reposition is desktop-only — switch to a desktop browser to rearrange tables."
                  : "Drag tables to reposition. Click a table to focus. Arrow keys nudge the focused table; hold ⇧ for bigger steps."
                : "Click a table to view its seating. Editing is read-only for your role."}
            </p>
            {/* v1.22.6: snap-to-grid toggle. Persists via localStorage. */}
            {canEdit && (
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-ink-secondary">
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={(e) => setSnapToGrid(e.target.checked)}
                  className="accent-moss-500"
                />
                <span className="uppercase tracking-wider font-bold">Snap to grid on drop</span>
              </label>
            )}
            {/* v1.22.7: scale toggles unified to S/M/L/XL. */}
            <div className="space-y-2.5 pt-2 border-t border-border-soft">
              <ScaleToggle
                label="Seat dot size"
                value={dotScale}
                options={SCALE_OPTIONS}
                onChange={setDotScale}
              />
              <ScaleToggle
                label="Seat label size"
                value={labelScale}
                options={SCALE_OPTIONS}
                onChange={setLabelScale}
              />
              <ScaleToggle
                label="Grid size"
                value={gridSize}
                options={GRID_OPTIONS}
                onChange={setGridSize}
              />
            </div>
          </div>
        </CollapsiblePanel>
      </aside>
    </div>
  );
}

// v1.22.7: shared S/M/L(/XL) toggle for the side panel sizing
// controls. Same visual shape as the M/W/D toggle in CountdownCard
// so the design language is consistent.
function ScaleToggle<T extends number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ label: string; value: T }>;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <strong className="block text-ink-secondary text-[11px] uppercase tracking-wider mb-1.5">
        {label}
      </strong>
      <div className="inline-flex gap-px bg-canvas border border-border-soft rounded-full p-0.5">
        {options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "text-xs px-3 py-0.5 rounded-full font-semibold transition-colors",
              value === opt.value
                ? "bg-moss-500 text-white"
                : "text-ink-tertiary hover:text-ink-primary",
            ].join(" ")}
            aria-pressed={value === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// v1.23.2: renamed FocusPanel → FocusPanelBody. Outer card chrome
// + close button now live on the wrapping CollapsiblePanel; this
// component only emits the inner content (capacity row, seat list,
// delete action).
function FocusPanelBody({
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
  const confirm = useConfirm();
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

  async function onDeleteTable() {
    if (!(await confirm({ title: `Delete table "${table.name}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      await deleteTable(table.id);
      onClose();
    });
  }

  // v1.22.6: capacity +/- buttons. Shrink fails server-side if any of
  // the trailing seats are still assigned. v1.22.9: action returns a
  // result object instead of throwing — Next.js production mode
  // redacts thrown server-action errors and surfaces them as the
  // generic "Server Components render" overlay rather than reaching
  // the catch block. Returning a typed result avoids the redaction.
  function onCapacity(delta: 1 | -1) {
    const next = table.capacity + delta;
    if (next < 1 || next > 40) return;
    startTransition(async () => {
      try {
        const res = await updateTableCapacity(table.id, next);
        if (!res.ok) notify("error", res.error);
      } catch (err) {
        // Unexpected errors only — validation lives in the result.
        notify(
          "error",
          err instanceof Error ? err.message : "Couldn't change capacity",
        );
      }
    });
  }

  return (
    <>
      <div className="px-4 pt-3 pb-2 border-b border-border-soft">
        <div className="text-[11px] text-ink-tertiary">
          {table.shape.toLowerCase()} · {filled}/{table.capacity} seated
        </div>
        {/* v1.22.7: capacity edit row — pre-fix the +/- were 16px
            inline buttons that were almost invisible. Now a clearly
            labelled row with proper hit targets. Shrink fails server-
            side if any trailing seats are occupied (notify-on-error). */}
        {canEdit && (
          <div className="mt-2 flex items-center justify-between gap-2 bg-canvas/60 rounded-md px-3 py-2">
            <span className="text-[11px] uppercase tracking-wider font-bold text-ink-secondary">
              Seats
            </span>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCapacity(-1)}
                disabled={pending || table.capacity <= 1}
                className="w-7 h-7 rounded-md border border-border-soft bg-surface text-ink-primary text-base font-semibold leading-none hover:border-moss-500 hover:bg-moss-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface flex items-center justify-center"
                aria-label="Remove a seat"
                title="Remove a seat (must be empty)"
              >
                −
              </button>
              <span className="text-sm font-semibold text-ink-primary tabular-nums w-6 text-center">
                {table.capacity}
              </span>
              <button
                type="button"
                onClick={() => onCapacity(1)}
                disabled={pending || table.capacity >= 40}
                className="w-7 h-7 rounded-md border border-border-soft bg-surface text-ink-primary text-base font-semibold leading-none hover:border-moss-500 hover:bg-moss-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface flex items-center justify-center"
                aria-label="Add a seat"
                title="Add a seat"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
      <ul className="divide-y divide-border-soft max-h-[360px] overflow-auto">
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
      {/* v1.23.0 mounted per-table notes + checklist here. v1.23.1
          moved both to a global panel above the canvas (user feedback:
          "should be global, always visible, not per table"). */}
      {canEdit && (
        <div className="flex justify-end px-4 py-2.5 border-t border-border-soft">
          <Button variant="ghost" size="sm" onClick={onDeleteTable} disabled={pending}>
            Delete table
          </Button>
        </div>
      )}
    </>
  );
}

// v1.20.6: replaces the pre-v1.20.6 UnseatedPanel. Shows ALL non-archived
// guests with their RSVP state at a glance + currently-seated table
// label. Each row is draggable (when canEdit); the panel itself is a
// drop target for unseating. Declined guests are hidden by default —
// they don't get seats, but the toggle exists so the user can scan
// for "did anyone I know declined?" if needed.
// v1.23.2: renamed AllGuestsPanel → AllGuestsPanelBody. Outer card
// chrome is now provided by the wrapping CollapsiblePanel.
function AllGuestsPanelBody({
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
    <div
      className="p-3"
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
      <div className="flex items-baseline justify-end mb-2 gap-2">
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
      </div>
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
    </div>
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
