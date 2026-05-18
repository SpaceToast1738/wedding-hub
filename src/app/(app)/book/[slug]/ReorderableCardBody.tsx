"use client";

import type { ReactNode } from "react";

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
}: Props) {
  const byId = new Map(components.map((c) => [c.id, c]));
  const order = effectiveOrder(
    components.map((c) => c.id),
    savedOrder,
  );

  // View-mode short circuit — no chrome, just the visible sections in
  // effective order. Keeps the read path light.
  if (!editMode) {
    return (
      <div className="space-y-4">
        {order
          .filter((id) => !hiddenIds.includes(id))
          .map((id) => {
            const c = byId.get(id);
            if (!c) return null;
            return <div key={c.id}>{c.node}</div>;
          })}
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
            <div className="flex items-center gap-1 mb-1 text-[10px] uppercase tracking-wider text-ink-tertiary">
              <span className="font-bold">{c.label}</span>
              {hidden && (
                <span className="italic text-ink-tertiary/70 normal-case font-normal">
                  — hidden in view mode
                </span>
              )}
              <span className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(c.id, -1)}
                  disabled={pending || isFirst}
                  aria-label={`Move ${c.label} up`}
                  title="Move up"
                  className="px-1.5 py-0.5 rounded-sm text-ink-tertiary hover:text-ink-primary disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(c.id, 1)}
                  disabled={pending || isLast}
                  aria-label={`Move ${c.label} down`}
                  title="Move down"
                  className="px-1.5 py-0.5 rounded-sm text-ink-tertiary hover:text-ink-primary disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ▼
                </button>
                {canHide && (
                  <button
                    type="button"
                    onClick={() => onToggleHidden(c.id, !hidden)}
                    disabled={pending}
                    aria-pressed={hidden}
                    aria-label={hidden ? `Show ${c.label}` : `Hide ${c.label}`}
                    title={hidden ? "Show in view mode" : "Hide from view mode"}
                    className={[
                      "px-1.5 py-0.5 rounded-sm transition-colors",
                      hidden
                        ? "text-marigold-700 hover:text-marigold-900"
                        : "text-ink-tertiary hover:text-ink-primary",
                    ].join(" ")}
                  >
                    {hidden ? "🚫" : "👁"}
                  </button>
                )}
              </span>
            </div>
            {c.node}
          </div>
        );
      })}
    </div>
  );
}
