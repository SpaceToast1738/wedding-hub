"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

// v1.99.0: shared widget every per-kind editor renders inside
// <CardChrome> in place of its handwritten body JSX. Owns the
// reorder + hide UX so the per-kind editors stay focused on
// authoring the individual sections.
//
// Architecture:
//   • Caller passes `components` — an ordered list of section nodes
//     in the kind's DEFAULT order, each with a stable string id.
//   • Caller also passes `savedOrder` (from BookSubsection.
//     componentOrder) and `hiddenIds` (from .hiddenComponents).
//   • Effective render order = savedOrder first, then any default-
//     order IDs not yet in savedOrder. That auto-appends newly-added
//     components for cards that haven't touched their layout, so
//     adding a section to a kind in a future release doesn't need a
//     data migration.
//   • View mode (`editMode: false`) filters out hidden components.
//     Edit mode renders everything; hidden sections wear a faded
//     outline + "hidden in view mode" hint so the couple can find
//     them to re-show.
//   • Each section in edit mode gets a small header strip with
//     ↑/↓ + 👁/🚫 buttons. ↑ on first row + ↓ on last row are
//     disabled. `alwaysVisible: true` on a component suppresses the
//     hide toggle entirely (e.g. WEDDING_PARTY matrix — hiding it
//     leaves an empty card).

export type CardComponent = {
  /** Stable identifier persisted in BookSubsection.componentOrder.
   *  Should be short kebab-case ("photos", "stats", "ingredients-
   *  steps"). Length-capped at 60 chars by the server action. */
  id: string;
  /** Human label for the per-section header strip in edit mode. */
  label: string;
  /** Pre-rendered section body. The caller decides what to show in
   *  view vs edit modes; ReorderableCardBody just paints chrome
   *  around it. */
  node: ReactNode;
  /** When true, the hide toggle is suppressed — the section always
   *  renders. Use for components that don't make sense to hide
   *  (e.g. the matrix on WEDDING_PARTY, the body on TEXT). */
  alwaysVisible?: boolean;
};

type Props = {
  components: CardComponent[];
  savedOrder: string[];
  hiddenIds: string[];
  editMode: boolean;
  pending?: boolean;
  onReorder: (next: string[]) => void;
  onToggleHidden: (componentId: string, hidden: boolean) => void;
  // Design-pass fix: hidden components used to vanish in view mode
  // with zero trace — nobody remembers weeks later that a card has a
  // hidden photos section, and non-editors have no way to know hidden
  // content exists at all. When the viewer can edit, view mode now
  // surfaces a small muted footer note naming how many sections are
  // hidden. Optional + defaults to false so callers outside this
  // design pass's file ownership (BookSetupCard, SubsectionEditor)
  // keep their current (silent) behaviour until they opt in.
  canEdit?: boolean;
};

/** Compute the effective render order. Saved order wins for IDs
 *  it covers; default-order IDs not in the saved order get
 *  appended at the bottom in their default order. Unknown IDs in
 *  the saved list (e.g. a removed component kept in old data) are
 *  silently dropped — the renderer can't show what it doesn't
 *  have a node for. */
export function effectiveOrder(
  componentIds: string[],
  savedOrder: string[],
): string[] {
  const idSet = new Set(componentIds);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of savedOrder) {
    if (idSet.has(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  for (const id of componentIds) {
    if (!seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  return out;
}

export function ReorderableCardBody({
  components,
  savedOrder,
  hiddenIds,
  editMode,
  pending = false,
  onReorder,
  onToggleHidden,
  canEdit = false,
}: Props) {
  const byId = new Map(components.map((c) => [c.id, c]));
  const order = effectiveOrder(
    components.map((c) => c.id),
    savedOrder,
  );

  // View-mode short circuit — no chrome, just the visible sections in
  // effective order. Keeps the read path light.
  if (!editMode) {
    // Only sections this card actually has a node for count — a
    // hiddenIds entry left over from a removed component shouldn't
    // inflate the count.
    const hiddenCount = order.filter((id) => hiddenIds.includes(id)).length;
    return (
      <div className="space-y-4">
        {order
          .filter((id) => !hiddenIds.includes(id))
          .map((id) => {
            const c = byId.get(id);
            if (!c) return null;
            return <div key={c.id}>{c.node}</div>;
          })}
        {/* Design-pass fix: hidden sections used to vanish with no
            trace — this is the same "quiet stat line" template as the
            Sorted N/M tiles and captured-percentage rollups elsewhere
            on these cards, just for hidden-content awareness instead
            of progress. */}
        {canEdit && hiddenCount > 0 && (
          <p className="text-[11px] text-ink-tertiary italic">
            {hiddenCount} hidden section{hiddenCount === 1 ? "" : "s"} — edit to show
          </p>
        )}
      </div>
    );
  }

  function move(id: string, delta: -1 | 1) {
    const idx = order.indexOf(id);
    if (idx === -1) return;
    const j = idx + delta;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    onReorder(next);
  }

  return (
    <div className="space-y-4">
      {order.map((id, i) => {
        const c = byId.get(id);
        if (!c) return null;
        const hidden = hiddenIds.includes(c.id);
        const canHide = !c.alwaysVisible;
        const isFirst = i === 0;
        const isLast = i === order.length - 1;
        return (
          <div
            key={c.id}
            className={[
              "relative",
              hidden ? "opacity-50" : "",
            ].join(" ")}
          >
            {/* v1.99.0: per-section reorder strip. Sits flush with
                the section node so it reads as a chrome accent
                rather than a separate row. */}
            <div className="flex items-center gap-1 mb-1 text-[10px] uppercase tracking-wider text-ink-secondary">
              <span className="font-bold">{c.label}</span>
              {hidden && (
                <span className="italic text-ink-tertiary/70 normal-case font-normal">
                  — hidden in view mode
                </span>
              )}
              <span className="ml-auto">
                <ComponentRowMenu
                  label={c.label}
                  canHide={canHide}
                  hidden={hidden}
                  isFirst={isFirst}
                  isLast={isLast}
                  pending={pending}
                  onMoveUp={() => move(c.id, -1)}
                  onMoveDown={() => move(c.id, 1)}
                  onToggleHidden={() => onToggleHidden(c.id, !hidden)}
                />
              </span>
            </div>
            {c.node}
          </div>
        );
      })}
    </div>
  );
}

// Design-pass fix: this row used to be three bare-glyph buttons
// (▲ ▼ 👁/🚫) at ~20px hit areas, explained only by hover tooltips.
// One properly-sized trigger + a text-labeled dropdown reads clearly
// without a mouse-hover tooltip and gives each action a real tap
// target.
function ComponentRowMenu({
  label,
  canHide,
  hidden,
  isFirst,
  isLast,
  pending,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
}: {
  label: string;
  canHide: boolean;
  hidden: boolean;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleHidden: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block normal-case tracking-normal">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${label} section options`}
        className="!px-2"
      >
        ⋯
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 z-20 w-40 rounded-md border border-border-soft bg-surface shadow-lg py-1 text-xs font-normal"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onMoveUp();
              setOpen(false);
            }}
            disabled={pending || isFirst}
            className="w-full text-left px-3 py-2 text-ink-secondary hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Move up
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onMoveDown();
              setOpen(false);
            }}
            disabled={pending || isLast}
            className="w-full text-left px-3 py-2 text-ink-secondary hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Move down
          </button>
          {canHide && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onToggleHidden();
                setOpen(false);
              }}
              disabled={pending}
              className="w-full text-left px-3 py-2 text-ink-secondary hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {hidden ? "Show in view mode" : "Hide from view mode"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
