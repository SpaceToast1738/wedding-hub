"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { updateCeremonySeating } from "../actions";

type Config = {
  leftRows: number;
  leftSeatsRow: number;
  rightRows: number;
  rightSeatsRow: number;
  notes: string;
};

// v1.23.0: ceremony seating layout. Two-pane:
//   - Form (top): rows + seats-per-row for left + right + notes
//   - SVG (below): visual layout — left grid, aisle, right grid, an
//     altar block at the front. No drag-and-drop in this version;
//     just shows the planner what they're working with.
export function CeremonyClient({
  initial,
  canEdit,
}: {
  initial: Config;
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

  function onSave() {
    const fd = new FormData();
    fd.set("leftRows", String(config.leftRows));
    fd.set("leftSeatsRow", String(config.leftSeatsRow));
    fd.set("rightRows", String(config.rightRows));
    fd.set("rightSeatsRow", String(config.rightSeatsRow));
    fd.set("notes", config.notes);
    startTransition(async () => {
      try {
        await updateCeremonySeating(fd);
        setSavedConfig(config);
        notify("success", "Ceremony layout saved");
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't save");
      }
    });
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
          />
          <p className="text-[11px] text-ink-tertiary italic mt-2">
            Per-seat assignments aren&rsquo;t available yet — drag-and-drop coming in a later release.
          </p>
        </section>
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

// SVG render of the ceremony layout. No interaction — just shows the
// planner what their numbers produce. ALTAR block at top, AISLE down
// the middle, two grids of seat dots either side.
function CeremonySvg({
  leftRows,
  leftSeatsRow,
  rightRows,
  rightSeatsRow,
}: {
  leftRows: number;
  leftSeatsRow: number;
  rightRows: number;
  rightSeatsRow: number;
}) {
  const SEAT = 14;
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

  // Position helpers — rows count downward from the altar.
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
            <circle
              key={`L-${r}-${s}`}
              cx={leftStartX + s * (SEAT + SEAT_GAP) + SEAT / 2}
              cy={seatStartY + r * (SEAT + ROW_GAP) + SEAT / 2}
              r={SEAT / 2}
              fill="var(--color-moss-100)"
              stroke="var(--color-moss-700)"
              strokeWidth={1}
            />
          )),
        )}
        {/* Right side seats */}
        {Array.from({ length: rightRows }).map((_, r) =>
          Array.from({ length: rightSeatsRow }).map((_, s) => (
            <circle
              key={`R-${r}-${s}`}
              cx={rightStartX + s * (SEAT + SEAT_GAP) + SEAT / 2}
              cy={seatStartY + r * (SEAT + ROW_GAP) + SEAT / 2}
              r={SEAT / 2}
              fill="var(--color-moss-100)"
              stroke="var(--color-moss-700)"
              strokeWidth={1}
            />
          )),
        )}
      </svg>
    </div>
  );
}
