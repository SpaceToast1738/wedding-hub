"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { updateCeremonySeating } from "../actions";
import { reorderGuestGroup } from "../../settings/guest-group-actions";
import {
  allocateCeremony,
  type GroupLite,
  type LayoutLite,
  type SeatFill,
  type SeatKey,
} from "@/lib/ceremony-allocate";

type Config = {
  leftRows: number;
  leftSeatsRow: number;
  rightRows: number;
  rightSeatsRow: number;
  notes: string;
};

type GroupSummary = GroupLite;
type AllocResult = ReturnType<typeof allocateCeremony>;

const SIDE_LABELS: Record<"BRIDE" | "GROOM" | "BOTH", string> = {
  BRIDE: "Bride",
  GROOM: "Groom",
  BOTH: "Both",
};

// v1.23.0: ceremony seating layout (rows + seats-per-row + altar).
// v1.46.0: per-row group tinting (manual assignments).
// v1.47.0: aisle-outward fill from member counts.
// v1.48.0: auto-fill from ordered group list. Couple manages
// `GuestGroup.order` + `GuestGroup.side`; allocator walks the list
// in order, fills BRIDE groups on the LEFT, GROOM on the RIGHT,
// BOTH on whichever side has more remaining seats. The Row
// Assignments panel from v1.46.0 is replaced by a Group Order
// panel showing each group's fill status + reorder buttons.
export function CeremonyClient({
  initial,
  groups,
  canEdit,
}: {
  initial: Config;
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

  // v1.48.0: run the allocator. Recomputes when layout numbers
  // change (the form's local state) or when groups change (server
  // refetch on revalidate). The allocator is a pure function so
  // it's cheap to re-run on every render.
  const layout: LayoutLite = {
    leftRows: config.leftRows,
    leftSeatsRow: config.leftSeatsRow,
    rightRows: config.rightRows,
    rightSeatsRow: config.rightSeatsRow,
  };
  const result = allocateCeremony(groups, layout);

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

  function onReorder(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const res = await reorderGuestGroup({ id, direction });
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
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
            fills={result.fills}
          />
          <Legend groups={groups} result={result} />
        </section>

        {/* Group order — couple-only. v1.48.0 replaces v1.46.0's
            Row Assignments panel. The couple reorders groups; the
            allocator walks the list in order. */}
        {canEdit && (
          <GroupOrderPanel
            groups={groups}
            result={result}
            pending={pending}
            onReorder={onReorder}
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
// the middle, two grids of seat dots either side. v1.48.0: each
// seat looks up its fill in the allocator's `fills` map. Filled
// seats render full colour + glyph; unassigned stay neutral.
function CeremonySvg({
  leftRows,
  leftSeatsRow,
  rightRows,
  rightSeatsRow,
  fills,
}: {
  leftRows: number;
  leftSeatsRow: number;
  rightRows: number;
  rightSeatsRow: number;
  fills: Map<SeatKey, SeatFill>;
}) {
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
              fill={fills.get(`LEFT-${r}-${s}` as SeatKey)}
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
              fill={fills.get(`RIGHT-${r}-${s}` as SeatKey)}
            />
          )),
        )}
      </svg>
    </div>
  );
}

// One seat dot. Two states:
//   • filled (fill !== undefined) → group colour + white glyph
//   • neutral (fill === undefined) → moss palette
function SeatDot({
  cx,
  cy,
  r,
  fill,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: SeatFill | undefined;
}) {
  if (!fill) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="var(--color-moss-100)"
        stroke="var(--color-moss-700)"
        strokeWidth={1}
      />
    );
  }
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

// Legend below the canvas. One row per group with swatch + name +
// side chip + member count + fill status (seated / shortfall).
function Legend({
  groups,
  result,
}: {
  groups: GroupSummary[];
  result: AllocResult;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-[11px] text-ink-tertiary italic mt-3">
        No guest groups exist yet — add some in Settings → Guest groups.
      </p>
    );
  }
  return (
    <>
      {result.duplicateGuests > 0 && (
        <p className="mt-3 text-[11px] text-marigold-700">
          ⚠ {result.duplicateGuests} {result.duplicateGuests === 1 ? "guest" : "guests"} appear in
          multiple groups — they are only allocated to the first group (by order). Fix memberships in{" "}
          <a href="/settings" className="underline">Settings → Guest groups</a>.
        </p>
      )}
      <ul className="mt-2 space-y-1 text-[12px]">
        {groups.map((g) => {
          const alloc = result.perGroup.get(g.id);
          const seated = alloc?.filledSeats.length ?? 0;
          const unique = alloc?.uniqueCount ?? g.members.length;
          const dupes = alloc?.duplicateCount ?? 0;
          const shortfall = alloc?.shortfall ?? 0;
          return (
            <li key={g.id} className="flex items-baseline gap-2 flex-wrap">
              <span
                className="inline-block w-3 h-3 rounded-full border border-border-soft flex-shrink-0"
                style={{ background: g.colour ?? "var(--color-moss-100)" }}
                aria-hidden="true"
              />
              <span className="text-ink-secondary font-medium">{g.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-ink-tertiary font-semibold">
                {SIDE_LABELS[g.side]}
              </span>
              <span className="text-ink-tertiary text-[11px]">
                {seated} of {unique} {unique === 1 ? "guest" : "guests"} seated
              </span>
              {dupes > 0 && (
                <span className="text-[11px] text-marigold-700">
                  · {dupes} in earlier group
                </span>
              )}
              {shortfall > 0 && (
                <span className="text-[11px] text-marigold-700 font-semibold">
                  · {shortfall} won&apos;t fit
                </span>
              )}
            </li>
          );
        })}
        {(result.unfilledLeft > 0 || result.unfilledRight > 0) && (
          <li className="text-[11px] text-ink-tertiary italic pt-1">
            {result.unfilledLeft + result.unfilledRight} seats empty —{" "}
            {result.unfilledLeft} left · {result.unfilledRight} right
          </li>
        )}
      </ul>
    </>
  );
}

// Couple-only group-order editor. Listed in `order` ascending.
// Up/down buttons swap the order with the adjacent group; the
// allocator re-runs on next render. Member count is informational —
// edit memberships in Settings → Guest groups.
function GroupOrderPanel({
  groups,
  result,
  pending,
  onReorder,
}: {
  groups: GroupSummary[];
  result: AllocResult;
  pending: boolean;
  onReorder: (id: string, direction: "up" | "down") => void;
}) {
  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm p-4">
      <h2 className="text-sm font-semibold text-ink-primary mb-1">
        Group order
      </h2>
      <p className="text-[11px] text-ink-tertiary mb-3">
        The allocator fills seats in this order — first group takes
        the front aisle, next takes whatever&apos;s next, and so on.{" "}
        <strong>Bride</strong> groups fill left only; <strong>Groom</strong> right
        only; <strong>Both</strong> takes whichever side has more space. Edit
        membership + colour + side in{" "}
        <a href="/settings" className="text-moss-700 underline">Settings → Guest groups</a>.
      </p>
      {groups.length === 0 ? (
        <p className="text-xs text-ink-tertiary italic">
          No guest groups yet. Add one in Settings to start filling
          the canvas.
        </p>
      ) : (
        <ol className="divide-y divide-border-soft">
          {groups.map((g, idx) => {
            const alloc = result.perGroup.get(g.id);
            const seated = alloc?.filledSeats.length ?? 0;
            const unique = alloc?.uniqueCount ?? g.members.length;
            const dupes = alloc?.duplicateCount ?? 0;
            const shortfall = alloc?.shortfall ?? 0;
            const hasIssue = shortfall > 0 || dupes > 0;
            return (
              <li key={g.id} className="py-2 flex items-center gap-2 text-sm">
                <span className="text-[11px] text-ink-tertiary tabular-nums w-6 flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onReorder(g.id, "up")}
                    disabled={pending || idx === 0}
                    aria-label="Move up"
                    title="Move up — fills sooner"
                    className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-0.5"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => onReorder(g.id, "down")}
                    disabled={pending || idx === groups.length - 1}
                    aria-label="Move down"
                    title="Move down — fills later"
                    className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-0.5"
                  >
                    ▼
                  </button>
                </span>
                {g.colour && (
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full border border-border-soft flex-shrink-0"
                    style={{ background: g.colour }}
                    aria-hidden="true"
                  />
                )}
                <span className="flex-1 min-w-0 truncate text-ink-primary font-medium">
                  {g.name}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider font-semibold flex-shrink-0 ${
                    g.side === "BRIDE"
                      ? "text-rose-700"
                      : g.side === "GROOM"
                        ? "text-moss-700"
                        : "text-ink-tertiary"
                  }`}
                >
                  {SIDE_LABELS[g.side]}
                </span>
                <span
                  className={`text-[11px] tabular-nums flex-shrink-0 ${
                    hasIssue ? "text-marigold-700 font-semibold" : "text-ink-tertiary"
                  }`}
                  title={
                    shortfall > 0
                      ? `${shortfall} guests can't fit`
                      : dupes > 0
                        ? `${dupes} guests already in an earlier group`
                        : `${seated} of ${unique} guests seated`
                  }
                >
                  {seated}/{unique}
                  {dupes > 0 && <span className="ml-0.5 opacity-60">({dupes}↑)</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
