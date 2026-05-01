"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { setCeremonyRowGroup, updateCeremonySeating } from "../actions";

type Config = {
  leftRows: number;
  leftSeatsRow: number;
  rightRows: number;
  rightSeatsRow: number;
  notes: string;
};

type RowAssignment = {
  side: "LEFT" | "RIGHT";
  rowIndex: number;
  guestGroupId: string | null;
  notes: string | null;
};

type GroupSummary = {
  id: string;
  name: string;
  colour: string | null;
  memberCount: number;
};

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

  // Build per-side row→group resolution for the SVG. Returns the
  // group's colour + glyph (first letter, uppercased) or null when
  // no assignment exists.
  function rowFill(side: "LEFT" | "RIGHT", rowIndex: number): { colour: string | null; glyph: string | null; groupName: string | null } {
    const a = byRow.get(`${side}-${rowIndex}`);
    if (!a || !a.guestGroupId) return { colour: null, glyph: null, groupName: null };
    const g = groupById.get(a.guestGroupId);
    if (!g) return { colour: null, glyph: null, groupName: null };
    const glyph = g.name.trim().slice(0, 1).toUpperCase() || null;
    return { colour: g.colour, glyph, groupName: g.name };
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
            rowFill={rowFill}
          />
          <Legend groups={groups} assignments={initialAssignments} />
        </section>

        {/* Row assignments — couple-only. v1.46.0 */}
        {canEdit && (
          <RowAssignmentsPanel
            leftRows={config.leftRows}
            rightRows={config.rightRows}
            byRow={byRow}
            groups={groups}
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
// the middle, two grids of seat dots either side. Each row is
// optionally tinted with the assigned guest group's colour; a glyph
// (first letter of the group name) overlays the dot for
// colour-blind accessibility.
function CeremonySvg({
  leftRows,
  leftSeatsRow,
  rightRows,
  rightSeatsRow,
  rowFill,
}: {
  leftRows: number;
  leftSeatsRow: number;
  rightRows: number;
  rightSeatsRow: number;
  rowFill: (side: "LEFT" | "RIGHT", rowIndex: number) => { colour: string | null; glyph: string | null; groupName: string | null };
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
        {Array.from({ length: leftRows }).map((_, r) => {
          const fill = rowFill("LEFT", r);
          return Array.from({ length: leftSeatsRow }).map((_, s) => (
            <SeatDot
              key={`L-${r}-${s}`}
              cx={leftStartX + s * (SEAT + SEAT_GAP) + SEAT / 2}
              cy={seatStartY + r * (SEAT + ROW_GAP) + SEAT / 2}
              r={SEAT / 2}
              colour={fill.colour}
              glyph={fill.glyph}
              groupName={fill.groupName}
            />
          ));
        })}
        {/* Right side seats */}
        {Array.from({ length: rightRows }).map((_, r) => {
          const fill = rowFill("RIGHT", r);
          return Array.from({ length: rightSeatsRow }).map((_, s) => (
            <SeatDot
              key={`R-${r}-${s}`}
              cx={rightStartX + s * (SEAT + SEAT_GAP) + SEAT / 2}
              cy={seatStartY + r * (SEAT + ROW_GAP) + SEAT / 2}
              r={SEAT / 2}
              colour={fill.colour}
              glyph={fill.glyph}
              groupName={fill.groupName}
            />
          ));
        })}
      </svg>
    </div>
  );
}

// One seat dot with optional colour + glyph. Falls back to the
// neutral moss palette when the row is unassigned.
function SeatDot({
  cx,
  cy,
  r,
  colour,
  glyph,
  groupName,
}: {
  cx: number;
  cy: number;
  r: number;
  colour: string | null;
  glyph: string | null;
  groupName: string | null;
}) {
  const fill = colour ?? "var(--color-moss-100)";
  const stroke = colour ?? "var(--color-moss-700)";
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={1}>
        {groupName && <title>{groupName}</title>}
      </circle>
      {glyph && (
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
          {glyph}
        </text>
      )}
    </g>
  );
}

// Legend below the canvas. Lists every group used in row assignments
// with its swatch + name + (rows used count + member count).
function Legend({
  groups,
  assignments,
}: {
  groups: GroupSummary[];
  assignments: RowAssignment[];
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
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
      {usedGroups.map((g) => {
        const rowsUsed = assignments.filter((a) => a.guestGroupId === g.id).length;
        return (
          <div key={g.id} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full border border-border-soft"
              style={{ background: g.colour ?? "var(--color-moss-100)" }}
              aria-hidden="true"
            />
            <span className="text-ink-secondary font-medium">{g.name}</span>
            <span className="text-ink-tertiary text-[11px]">
              {rowsUsed} {rowsUsed === 1 ? "row" : "rows"} · {g.memberCount} {g.memberCount === 1 ? "guest" : "guests"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Row-by-row assignment editor. Two columns (left + right side),
// each showing every row 0..N-1 with the assigned group name + a
// dropdown to (re)assign or clear.
function RowAssignmentsPanel({
  leftRows,
  rightRows,
  byRow,
  groups,
  pending,
  onAssign,
}: {
  leftRows: number;
  rightRows: number;
  byRow: Map<string, RowAssignment>;
  groups: GroupSummary[];
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
            byRow={byRow}
            groups={groups}
            pending={pending}
            onAssign={onAssign}
          />
          <RowList
            side="RIGHT"
            label="Right side"
            rowCount={rightRows}
            byRow={byRow}
            groups={groups}
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
  byRow,
  groups,
  pending,
  onAssign,
}: {
  side: "LEFT" | "RIGHT";
  label: string;
  rowCount: number;
  byRow: Map<string, RowAssignment>;
  groups: GroupSummary[];
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
          return (
            <li key={r} className="py-1.5 flex items-center gap-2 text-sm">
              <span className="text-[11px] text-ink-tertiary tabular-nums w-12">
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
