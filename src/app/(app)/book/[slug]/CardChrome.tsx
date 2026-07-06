"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  deleteBookSubsection,
  setBookSubsectionVisibility,
  updateBookSubsection,
} from "../actions";
import { CardLinkedTasksPanel, type LinkedTaskRow } from "./CardLinkedTasksPanel";
import type { UserOpt } from "@/app/(app)/tasks/AddTaskToggle";

// v1.26.0: shared chrome for the four new card kinds (FIELD, RECIPE,
// SHOT_LIST, OUTFIT). Renders an `<article>` with the same anchor /
// title / visibility-badge / delete affordances every card has — so
// each per-kind editor only worries about its own body content.
//
// TEXT cards still use the older SubsectionEditor unchanged because
// it has bespoke body-textarea + dirty-tracking that's awkward to
// generalise.

// Design-pass fix: with 13 near-identical white cards in a mixed
// grid, the only thing telling them apart was a tiny uppercase kind
// badge — reading every card's badge just to orient yourself doesn't
// scale. A coloured left accent (grouped into 3 families) lets kind
// recognition happen at a glance instead. Keyed off `kindBadge`
// (every CardChrome caller already passes this) rather than a typed
// BookCardKind enum, so the accent applies automatically to the 9
// per-kind editors outside this design pass's file ownership too —
// no prop-signature change needed on their end.
const KIND_ACCENT: Record<string, string> = {
  // Content-oriented — reference material, low workflow-tracking.
  Notes: "border-l-moss-300",
  Field: "border-l-moss-300",
  Recipe: "border-l-moss-300",
  "Lodging guide": "border-l-moss-300",
  // Logistics — physical/production planning.
  DIY: "border-l-marigold-500",
  Menu: "border-l-marigold-500",
  Bar: "border-l-marigold-500",
  Setup: "border-l-marigold-500",
  Stay: "border-l-marigold-500",
  // Trackers — progress/status per person or per shot.
  "Shot list": "border-l-info",
  Outfit: "border-l-info",
  "Wedding party": "border-l-info",
};
const DEFAULT_KIND_ACCENT = "border-l-border-soft";

export function CardChrome({
  subsectionId,
  slug,
  initialTitle,
  visibility,
  canEdit,
  isCouple,
  kindBadge,
  children,
  linkedTasks = [],
  users = [],
  actions,
  hideHousekeeping = false,
  headerChips,
  mediaBlock,
}: {
  subsectionId: string;
  slug: string;
  initialTitle: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  // Small label shown next to the visibility chip — e.g. "Field",
  // "Recipe", "Shot list", "Outfit". Lets the user see at a glance
  // which kind of card this is without opening it.
  kindBadge: string;
  children: ReactNode;
  // v1.92.0: render the LinkedTasksPanel INSIDE the card (between
  // children and the action footer) instead of as a sibling below.
  // Both default to empty so callers that don't thread tasks just
  // omit the panel.
  linkedTasks?: LinkedTaskRow[];
  users?: UserOpt[];
  // v1.96.4: per-kind action buttons (Edit / Cancel + Save). Rendered
  // on the right of the chrome footer alongside Make-couple-only /
  // Delete so the card has a single action row, not two.
  actions?: ReactNode;
  // v1.96.4: hide the housekeeping buttons (Make couple-only +
  // Delete) — useful for transient edit-mode states where they
  // don't belong.
  hideHousekeeping?: boolean;
  // v1.97.0: kind-specific chip(s) rendered inline in the title row
  // alongside the kindBadge and the 🔒 Couple chip. e.g. OUTFIT
  // passes the BRIDE / GROOM / BEST MAN role chip here so it sits
  // next to the title instead of on its own sub-line.
  headerChips?: ReactNode;
  // v1.97.0: media slot rendered between the title row and the body
  // children. Where the card's photo gallery lives. Hidden when not
  // provided so cards without photos render unchanged.
  mediaBlock?: ReactNode;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [vis, setVis] = useState(visibility);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  // Design-pass fix: the housekeeping actions (Make couple-only,
  // Delete) used to render as two always-visible ghost buttons next
  // to Edit — three visible actions competing for attention on a card
  // whose primary job is "Edit". Folded into one small menu so the
  // default view reads as one primary action (Edit) + one secondary
  // options trigger.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function saveTitle() {
    if (!title.trim()) {
      setTitle(savedTitle);
      return;
    }
    if (title === savedTitle) return;
    const fd = new FormData();
    fd.set("title", title);
    // v1.95.4: do NOT post `body` or `bodyHtml` here. Pre-fix this
    // posted `body=""` which sent updateBookSubsection into the
    // legacy-body branch and wiped both `body` AND `bodyHtml` on
    // every title rename. Harmless for the non-TEXT kinds that
    // currently use CardChrome (their body columns are already
    // null), but a footgun the moment any card ever ends up
    // routing both flows. Updating only title now leaves the body
    // columns untouched.
    startTransition(async () => {
      try {
        await updateBookSubsection(subsectionId, fd);
        setSavedTitle(title);
        // Design-pass fix: this used to save with zero visual
        // confirmation — the title is the one CardChrome field that
        // commits instantly with no Cancel/Save pair around it, so a
        // brief "Saved" toast is the only signal the blur actually
        // persisted.
        notify("success", "Saved");
      } catch (err) {
        setTitle(savedTitle);
        notify("error", err instanceof Error ? err.message : "Couldn't save title");
      }
    });
  }

  function toggleVisibility() {
    if (!isCouple) return;
    const next = vis === "COUPLE_ONLY" ? "EVERYONE" : "COUPLE_ONLY";
    const prev = vis;
    setVis(next);
    setMenuOpen(false);
    startTransition(async () => {
      try {
        await setBookSubsectionVisibility(subsectionId, next);
      } catch (err) {
        setVis(prev);
        notify("error", err instanceof Error ? err.message : "Couldn't change visibility");
      }
    });
  }

  async function onDelete() {
    setMenuOpen(false);
    if (!(await confirm({ title: `Delete card "${savedTitle}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      try {
        await deleteBookSubsection(subsectionId);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't delete");
      }
    });
  }

  return (
    // v1.95.2: flex-col + flex-1 so the article grows to fill the
    // grid wrapper's row height. Pre-fix when one of a 2-col-row's
    // cards was tall, the shorter one stayed at its natural height
    // and the row's background showed empty space below. Now the
    // article fills the row and the inner `flex-1` content wrap
    // pushes the linked-tasks panel + action footer to the bottom.
    <article
      id={slug}
      className={[
        "bg-surface border border-border-soft rounded-md shadow-sm p-5 scroll-mt-24 flex flex-col flex-1",
        // Design-pass fix: 13 card kinds used to be visually
        // identical white boxes distinguished only by the small
        // kindBadge chip below. A per-kind-family left accent lets
        // the reader recognise a card's kind at a glance in a mixed
        // grid instead of reading every badge.
        "border-l-4",
        KIND_ACCENT[kindBadge] ?? DEFAULT_KIND_ACCENT,
      ].join(" ")}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {canEdit ? (
          // Design-pass fix: the title input used to look like plain
          // text until hovered (transparent border, no other cue) —
          // canEdit users had no persistent signal it was even
          // editable. The small ✎ glyph stays visible regardless of
          // hover; the border itself still brightens on hover/focus
          // as a secondary affordance.
          <div className="relative flex-1 min-w-0 flex items-center gap-1.5">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              disabled={pending}
              className="!text-base !font-semibold !border-transparent hover:!border-border-soft focus:!border-moss-500 !p-1 flex-1 min-w-0"
            />
            <span aria-hidden className="text-ink-tertiary text-xs flex-shrink-0" title="Click to rename">
              ✎
            </span>
          </div>
        ) : (
          <h3 className="text-base font-semibold text-ink-primary flex-1 min-w-0">{title}</h3>
        )}
        {/* v1.97.0: kind-specific chips (e.g. BRIDE / GROOM on OUTFIT)
            sit inline with the title instead of on their own sub-row. */}
        {headerChips}
        <span className="text-[10px] uppercase tracking-wider text-ink-secondary border border-border-soft rounded-full px-2 py-0.5 flex-shrink-0">
          {kindBadge}
        </span>
        {vis === "COUPLE_ONLY" && (
          <span className="text-[10px] uppercase tracking-wider text-marigold-700 bg-marigold-100 border border-marigold-700/20 rounded-full px-2 py-0.5 flex-shrink-0 inline-flex items-center gap-1">
            <Lock aria-hidden className="w-3 h-3" />
            Couple
          </span>
        )}
      </div>
      {/* v1.97.0: media slot — photos render at the top of the card
          (above stats / items / notes / linked-tasks). Hidden when
          the caller doesn't pass anything so non-gallery cards
          render unchanged. */}
      {mediaBlock && <div className="mb-4">{mediaBlock}</div>}
      {/* v1.95.2: content body grows to absorb any extra row height,
          pushing the linked-tasks panel + footer below it. Internal
          per-kind layout (space-y, grids) renders naturally at the
          top of this wrapper; the empty space ends up between the
          end of the content and the linked-tasks panel. */}
      <div className="flex-1">{children}</div>
      {/* v1.92.0: linked-tasks panel rendered inside the card so it
          reads as part of the card, not a separate appendage. Renders
          when the panel has anything to show (tasks or the +Task button). */}
      {(linkedTasks.length > 0 || canEdit) && (
        <CardLinkedTasksPanel
          tasks={linkedTasks}
          subsectionId={subsectionId}
          canEdit={canEdit}
          users={users}
        />
      )}
      {/* v1.96.4: footer combines housekeeping (Make couple-only +
          Delete) with the per-kind action slot (Edit / Cancel + Save)
          on a single row. Pre-fix each editor rendered its own Edit
          row above this footer — two rows where one would do. The
          `hideHousekeeping` flag suppresses the options menu during
          transient states (edit mode) so the visual focus stays on
          Cancel / Save (or Done).
          Design-pass fix: Make-couple-only + Delete used to render as
          two separate always-visible ghost buttons here — three
          visible actions (those two, plus Edit) on a card whose one
          primary job is "Edit". Collapsed into a single "⋯ Options"
          menu so the default footer reads as one primary action +
          one secondary options trigger. */}
      {canEdit && (!hideHousekeeping || actions) && (
        <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border-soft">
          {!hideHousekeeping && (
            <div ref={menuRef} className="relative inline-block">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMenuOpen((v) => !v)}
                disabled={pending}
                aria-haspopup="true"
                aria-expanded={menuOpen}
                aria-label="Card options"
              >
                ⋯ Options
              </Button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1 z-20 w-44 rounded-md border border-border-soft bg-surface shadow-lg py-1 text-xs"
                >
                  {isCouple && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={toggleVisibility}
                      disabled={pending}
                      className="w-full text-left px-3 py-2 text-ink-secondary hover:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {vis === "COUPLE_ONLY" ? "Make public" : "Make couple-only"}
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={onDelete}
                    disabled={pending}
                    className="w-full text-left px-3 py-2 text-danger hover:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete card
                  </button>
                </div>
              )}
            </div>
          )}
          {actions}
        </div>
      )}
    </article>
  );
}
