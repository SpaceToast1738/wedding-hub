"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { setCeremonyRowGroup, updateCeremonySeating } from "../actions";
import {
  allocateAll,
  resolveSeat,
  type AssignmentLite,
  type GroupAllocation,
  type GroupLite,
  type LayoutLite,
  type SeatFill,
} from "@/lib/ceremony-fill";

type Config = {
  leftRows: number;
  leftSeatsRow: number;
  rightRows: number;
  rightSeatsRow: number;
  notes: string;
};

type RowAssignment = AssignmentLite & {
  notes: string | null;
};

type GroupSummary = GroupLite;

// v1.23.0: ceremony seating layout (rows + seats-per-row + altar).
// v1.46.0: per-row group tinting. Each row can be assigned to a
// GuestGroup; every seat in the row picks up the group's colour.
// Glyph (first letter of the group name) overlays each seat for
// colour-blind accessibility — same pattern as the reception canvas
// uses for RSVP status. Assignments are couple-only via the panel
// below the SVG.
export function CeremonyClient({
  initial,
  initialAssignments,
  groups,
  canEdit,
}: {
  initial: Config;
  initialAssignments: RowAssignment[];
  groups: GroupSummary[];
  canEdit: boolean;
}) {
  const [config, setConfig] = useState(initial);
  const [savedConfig, setSavedConfig] = useState(initial);
  const [pending, startTransition] = useTransition();

  const dirty =
    config.leftRows !== savedConfig.leftRows ||
    config.leftSeatsRow !== savedConfig.leftSeatsRow ||
    config.rightRows !== savedConfig.rightRows ||
    config.rightSeatsRow !== savedConfig.rightSeatsRow ||
    config.notes !== savedConfig.notes;

  // Index assignments by (side, rowIndex) for fast lookup from the
  // canvas + the assignments panel.
  const byRow = new Map<string, RowAssignment>();
  for (const a of initialAssignments) byRow.set(`${a.side}-${a.rowIndex}`, a);
  const groupById = new Map<string, GroupSummary>();
  for (const g of groups) groupById.set(g.id, g);

  // v1.47.0: pre-compute per-group allocations (member-count packed
  // across assigned rows aisle-outward). The canvas + legend + Row
  // Assignments panel all read from these.
  const layout: LayoutLite = {
    leftSeatsRow: config.leftSeatsRow,
    rightSeatsRow: config.rightSeatsRow,
  };
  const allocations = allocateAll(groups, initialAssignments, layout);

  function onSave() {
    const fd = new FormData();
    fd.set("leftRows", String(config.leftRows));
    fd.set("leftSeatsRow", String(config.leftSeatsRow));
    fd.set("rightRows", String(config.rightRows));
    fd.set("rightSeatsRow", String(config.rightSeatsRow));
    fd.set("notes", config.notes);
    startTransition(async () => {
      try {
        const res = await updateCeremonySeating(fd);
        if (res.ok) {
          setSavedConfig(config);
          notify("success", "Ceremony layout saved");
        } else {
          notify("error", res.error);
        }
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  function onAssign(side: "LEFT" | "RIGHT", rowIndex: number, guestGroupId: string | null) {
    startTransition(async () => {
      try {
        const res = await setCeremonyRowGroup({ side, rowIndex, guestGroupId });
        if (res.ok) {
          notify("success", guestGroupId ? "Row assigned" : "Row cleared");
        } else {
          notify("error", res.error);
        }
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't update");
      }
    });
  }

  // v1.47.0: resolve a single seat's fill via the pure helper.
  // Returns "neutral" for unassigned rows, "filled" for actual
  // member seats, "spare" for assigned-but-empty seats. The canvas
  // distinguishes the three by opacity + glyph presence.
  function seatFill(side: "LEFT" | "RIGHT", rowIndex: number, seatIndex: number): SeatFill {
    return resolveSeat(side, rowIndex, seatIndex, layout, initialAssignments, groups, allocations);
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        {/* Configuration form */}
        <section className="bg-surface border border-border-soft rounded-md shadow-sm p-4">
          <h2 className="text-sm font-semibold text-ink-primary mb-3">
            Layout
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumberField
              label="Left rows"
              value={config.leftRows}
              min={1}
              max={40}
              disabled={!canEdit || pending}
              onChange={(v) => setConfig((c) => ({ ...c, leftRows: v }))}
            />
            <NumberField
              label="Left seats / row"
              value={config.leftSeatsRow}
              min={1}
              max={20}
              disabled={!canEdit || pending}
              onChange={(v) => setConfig((c) => ({ ...c, leftSeatsRow: v }))}
            />
            <NumberField
              label="Right rows"
              value={config.rightRows}
              min={1}
              max={40}
              disabled={!canEdit || pending}
              onChange={(v) => setConfig((c) => ({ ...c, rightRows: v }))}
            />
            <NumberField
              label="Right seats / row"
              value={config.rightSeatsRow}
              min={1}
              max={20}
              disabled={!canEdit || pending}
              onChange={(v) => setConfig((c) => ({ ...c, rightSeatsRow: v }))}
            />
          </div>
          <div className="mt-4">
            <label className="block text-[11px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
              Notes
            </label>
            {canEdit ? (
              <textarea
                value={config.notes}
                onChange={(e) => setConfig((c) => ({ ...c, notes: e.target.value }))}
                rows={3}
                placeholder="Front-row reserved family · accessibility seats by aisle · order of seating · standing-room-only at the back…"
                className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-ink-secondary font-sans">
                {config.notes || <span className="italic text-ink-tertiary">No notes yet.</span>}
              </pre>
            )}
          </div>
          {canEdit && dirty && (
            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfig(savedConfig)}
                disabled={pending}
              >
                Reset
              </Button>
              <Button variant="primary" size="sm" onClick={onSave} disabled={pending}>
                Save
              </Button>
            </div>
          )}
        </section>

        {/* Visual layout */}
        <section className="bg-surface border border-border-soft rounded-md shadow-sm p-4">
          <h2 className="text-sm font-semibold text-ink-primary mb-3">
            Visual layout
          </h2>
          <CeremonySvg
            leftRows={config.leftRows}
            leftSeatsRow={config.leftSeatsRow}
            rightRows={config.rightRows}
            rightSeatsRow={config.rightSeatsRow}
            seatFill={seatFill}
          />
          <Legend groups={groups} assignments={initialAssignments} allocations={allocations} />
        </section>

        {/* Row assignments — couple-only. v1.46.0; v1.47.0 surfaces
            per-row fill counts so the couple sees "8 of 12 seated
            here, 4 spill to row 2". */}
        {canEdit && (
          <RowAssignmentsPanel
            leftRows={config.leftRows}
            rightRows={config.rightRows}
            leftSeatsPerRow={config.leftSeatsRow}
            rightSeatsPerRow={config.rightSeatsRow}
            byRow={byRow}
            groups={groups}
            allocations={allocations}
            pending={pending}
            onAssign={onAssign}
          />
        )}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.max(min, Math.min(max, Math.round(n))));
        }}
        className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500 disabled:opacity-60"
      />
    </label>
  );
}

// SVG render of the ceremony layout. ALTAR block at top, AISLE down
// the middle, two grids of seat dots either side. v1.46.0 tinted
// whole rows by group colour; v1.47.0 packs each group's members
// aisle-outward across its assigned rows so the canvas shows actual
// fill rather than blanket tinting. Three seat states:
//   • filled  — full colour + white-on-tint glyph
//   • spare   — faded tint (no glyph) — assigned but no member
//   • neutral — moss-100 fill, no glyph — unassigned row
function CeremonySvg({
  leftRows,
  leftSeatsRow,
  rightRows,
  rightSeatsRow,
  seatFill,
}: {
  leftRows: number;
  leftSeatsRow: number;
  rightRows: number;
  rightSeatsRow: number;
  seatFill: (side: "LEFT" | "RIGHT", rowIndex: number, seatIndex: number) => SeatFill;
}) {
  // Bumped seat size from 14 → 18 to accommodate the in-circle
  // glyph at a legible point size.
  const SEAT = 18;
  const SEAT_GAP = 4;
  const ROW_GAP = 8;
  const AISLE = 60;
  const SIDE_PAD = 16;
  const ALTAR_H = 38;
  const ALTAR_GAP = 20;

  const leftWidth = leftSeatsRow * SEAT + (leftSeatsRow - 1) * SEAT_GAP;
  const rightWidth = rightSeatsRow * SEAT + (rightSeatsRow - 1) * SEAT_GAP;
  const w = SIDE_PAD * 2 + leftWidth + AISLE + rightWidth;
  const maxRows = Math.max(leftRows, rightRows);
  const seatsHeight = maxRows * SEAT + (maxRows - 1) * ROW_GAP;
  const h = ALTAR_H + ALTAR_GAP + seatsHeight + 16;

  const altarY = 4;
  const seatStartY = altarY + ALTAR_H + ALTAR_GAP;
  const leftStartX = SIDE_PAD;
  const rightStartX = SIDE_PAD + leftWidth + AISLE;
  const aisleCenterX = SIDE_PAD + leftWidth + AISLE / 2;

  return (
    <div className="w-full overflow-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full max-w-full block"
        style={{ background: "var(--color-canvas)" }}
      >
        {/* Altar */}
        <rect
          x={SIDE_PAD + leftWidth - 4}
          y={altarY}
          width={AISLE + 8}
          height={ALTAR_H}
          rx={6}
          fill="var(--color-marigold-100)"
          stroke="var(--color-marigold-700)"
          strokeWidth={1.5}
        />
        <text
          x={aisleCenterX}
          y={altarY + ALTAR_H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fontWeight={700}
          fill="var(--color-marigold-700)"
          style={{ letterSpacing: "0.08em" }}
        >
          ALTAR
        </text>
        {/* Aisle guideline */}
        <line
          x1={aisleCenterX}
          y1={altarY + ALTAR_H + 2}
          x2={aisleCenterX}
          y2={h - 6}
          stroke="var(--color-border-soft)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
        {/* Left side seats */}
        {Array.from({ length: leftRows }).map((_, r) =>
          Array.from({ length: leftSeatsRow }).map((_, s) => (
            <SeatDot
              key={`L-${r}-${s}`}
              cx={leftStartX + s * (SEAT + SEAT_GAP) + SEAT / 2}
              cy={seatStartY + r * (SEAT + ROW_GAP) + SEAT / 2}
              r={SEAT / 2}
              fill={seatFill("LEFT", r, s)}
            />
          )),
        )}
        {/* Right side seats */}
        {Array.from({ length: rightRows }).map((_, r) =>
          Array.from({ length: rightSeatsRow }).map((_, s) => (
            <SeatDot
              key={`R-${r}-${s}`}
              cx={rightStartX + s * (SEAT + SEAT_GAP) + SEAT / 2}
              cy={seatStartY + r * (SEAT + ROW_GAP) + SEAT / 2}
              r={SEAT / 2}
              fill={seatFill("RIGHT", r, s)}
            />
          )),
        )}
      </svg>
    </div>
  );
}

// One seat dot — three visual states driven by SeatFill:
//   • filled  → full group colour + white glyph
//   • spare   → group colour at 30% opacity, no glyph (reserved
//               but the group ran out of members)
//   • neutral → moss palette, no glyph (unassigned row)
function SeatDot({
  cx,
  cy,
  r,
  fill,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: SeatFill;
}) {
  if (fill.kind === "neutral") {
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="var(--color-moss-100)"
          stroke="var(--color-moss-700)"
          strokeWidth={1}
        />
      </g>
    );
  }
  if (fill.kind === "spare") {
    const colour = fill.colour ?? "var(--color-moss-100)";
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={colour}
          fillOpacity={0.3}
          stroke={colour}
          strokeWidth={1}
          strokeDasharray="2 2"
        >
          <title>{fill.groupName} (reserved, no member)</title>
        </circle>
      </g>
    );
  }
  // filled
  const colour = fill.colour ?? "var(--color-moss-700)";
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={colour} stroke={colour} strokeWidth={1}>
        <title>{fill.groupName}</title>
      </circle>
      {fill.glyph && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={r}
          fontWeight={700}
          fill="white"
          style={{ pointerEvents: "none" }}
          aria-hidden="true"
        >
          {fill.glyph}
        </text>
      )}
    </g>
  );
}

// Legend below the canvas. Lists every group used in row assignments
// with its swatch + name + members + reserved seats + spare-or-shortfall.
// v1.47.0: legend now reflects actual allocation, not just row count.
function Legend({
  groups,
  assignments,
  allocations,
}: {
  groups: GroupSummary[];
  assignments: RowAssignment[];
  allocations: Map<string, GroupAllocation>;
}) {
  const usedGroupIds = new Set(
    assignments.map((a) => a.guestGroupId).filter((id): id is string => Boolean(id)),
  );
  const usedGroups = groups.filter((g) => usedGroupIds.has(g.id));
  if (usedGroups.length === 0) {
    return (
      <p className="text-[11px] text-ink-tertiary italic mt-3">
        No row assignments yet — assign rows below to colour-code them.
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-1 text-[12px]">
      {usedGroups.map((g) => {
        const a = allocations.get(g.id);
        const reserved = a?.totalAssignedSeats ?? 0;
        const filled = a?.totalFilledSeats ?? 0;
        const surplus = a?.surplus ?? 0;
        const shortfall = a?.shortfall ?? 0;
        return (
          <li key={g.id} className="flex items-baseline gap-2 flex-wrap">
            <span
              className="inline-block w-3 h-3 rounded-full border border-border-soft flex-shrink-0"
              style={{ background: g.colour ?? "var(--color-moss-100)" }}
              aria-hidden="true"
            />
            <span className="text-ink-secondary font-medium">{g.name}</span>
            <span className="text-ink-tertiary text-[11px]">
              {filled} of {g.memberCount} {g.memberCount === 1 ? "guest" : "guests"} seated · {reserved} {reserved === 1 ? "seat" : "seats"} reserved
            </span>
            {surplus > 0 && (
              <span className="text-[11px] text-ink-tertiary italic">
                · {surplus} spare
              </span>
            )}
            {shortfall > 0 && (
              <span className="text-[11px] text-marigold-700 font-semibold">
                · {shortfall} won&apos;t fit — assign more rows
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Row-by-row assignment editor. Two columns (left + right side),
// each showing every row 0..N-1 with the assigned group name + a
// dropdown to (re)assign or clear. v1.47.0: each row also shows
// "X of Y seated" so the couple can see how much of the row's
// capacity the assigned group actually uses.
function RowAssignmentsPanel({
  leftRows,
  rightRows,
  leftSeatsPerRow,
  rightSeatsPerRow,
  byRow,
  groups,
  allocations,
  pending,
  onAssign,
}: {
  leftRows: number;
  rightRows: number;
  leftSeatsPerRow: number;
  rightSeatsPerRow: number;
  byRow: Map<string, RowAssignment>;
  groups: GroupSummary[];
  allocations: Map<string, GroupAllocation>;
  pending: boolean;
  onAssign: (side: "LEFT" | "RIGHT", rowIndex: number, guestGroupId: string | null) => void;
}) {
  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm p-4">
      <h2 className="text-sm font-semibold text-ink-primary mb-1">
        Row assignments
      </h2>
      <p className="text-[11px] text-ink-tertiary mb-3">
        Assign each row to a guest group. Every seat in the row picks
        up the group&apos;s colour on the canvas above. Unassigned rows
        stay neutral. Manage groups + colours in{" "}
        <a href="/settings" className="text-moss-700 underline">Settings → Guest groups</a>.
      </p>
      {groups.length === 0 ? (
        <p className="text-xs text-ink-tertiary italic">
          No guest groups exist yet — add one in Settings to start
          colour-coding rows.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          <RowList
            side="LEFT"
            label="Left side"
            rowCount={leftRows}
            seatsPerRow={leftSeatsPerRow}
            byRow={byRow}
            groups={groups}
            allocations={allocations}
            pending={pending}
            onAssign={onAssign}
          />
          <RowList
            side="RIGHT"
            label="Right side"
            rowCount={rightRows}
            seatsPerRow={rightSeatsPerRow}
            byRow={byRow}
            groups={groups}
            allocations={allocations}
            pending={pending}
            onAssign={onAssign}
          />
        </div>
      )}
    </section>
  );
}

function RowList({
  side,
  label,
  rowCount,
  seatsPerRow,
  byRow,
  groups,
  allocations,
  pending,
  onAssign,
}: {
  side: "LEFT" | "RIGHT";
  label: string;
  rowCount: number;
  seatsPerRow: number;
  byRow: Map<string, RowAssignment>;
  groups: GroupSummary[];
  allocations: Map<string, GroupAllocation>;
  pending: boolean;
  onAssign: (side: "LEFT" | "RIGHT", rowIndex: number, guestGroupId: string | null) => void;
}) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
        {label}
      </h3>
      <ul className="divide-y divide-border-soft">
        {Array.from({ length: rowCount }).map((_, r) => {
          const a = byRow.get(`${side}-${r}`);
          const groupId = a?.guestGroupId ?? "";
          const group = groupId ? groups.find((g) => g.id === groupId) : null;
          const filledHere = group ? (allocations.get(group.id)?.rowFills.get(`${side}-${r}`) ?? 0) : 0;
          return (
            <li key={r} className="py-1.5 flex items-center gap-2 text-sm">
              <span className="text-[11px] text-ink-tertiary tabular-nums w-12 flex-shrink-0">
                Row {r + 1}
                {r === 0 && <span className="ml-0.5 text-ink-tertiary">(front)</span>}
              </span>
              {group?.colour && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full border border-border-soft flex-shrink-0"
                  style={{ background: group.colour }}
                  aria-hidden="true"
                />
              )}
              <select
                value={groupId}
                onChange={(e) => onAssign(side, r, e.target.value || null)}
                disabled={pending}
                className="flex-1 min-w-0 text-[12px] bg-canvas border border-border-soft rounded-sm px-1.5 py-0.5 text-ink-secondary outline-none disabled:opacity-50"
              >
                <option value="">— Unassigned —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {group && (
                <span
                  className="text-[10px] text-ink-tertiary tabular-nums flex-shrink-0"
                  title={`${filledHere} of ${seatsPerRow} seats filled in this row`}
                >
                  {filledHere}/{seatsPerRow}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
