"use client";

import { useState, useTransition, type ReactNode } from "react";
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
}) {
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [vis, setVis] = useState(visibility);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  function saveTitle() {
    if (!title.trim()) {
      setTitle(savedTitle);
      return;
    }
    if (title === savedTitle) return;
    const fd = new FormData();
    fd.set("title", title);
    fd.set("body", ""); // updateBookSubsection currently expects body too
    startTransition(async () => {
      try {
        await updateBookSubsection(subsectionId, fd);
        setSavedTitle(title);
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
      className="bg-surface border border-border-soft rounded-md shadow-sm p-5 scroll-mt-24 flex flex-col flex-1"
    >
      <div className="flex items-start gap-2 mb-3">
        {canEdit ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            disabled={pending}
            className="!text-base !font-semibold !border-transparent hover:!border-border-soft focus:!border-moss-500 !p-1 flex-1"
          />
        ) : (
          <h3 className="text-base font-semibold text-ink-primary flex-1">{title}</h3>
        )}
        <span className="text-[10px] uppercase tracking-wider text-ink-tertiary border border-border-soft rounded-full px-2 py-0.5 flex-shrink-0">
          {kindBadge}
        </span>
        {vis === "COUPLE_ONLY" && (
          <span className="text-[10px] uppercase tracking-wider text-marigold-700 bg-marigold-100 border border-marigold-700/20 rounded-full px-2 py-0.5 flex-shrink-0">
            🔒 Couple
          </span>
        )}
      </div>
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
      {canEdit && (
        <div className="flex justify-end gap-1 mt-3 pt-3 border-t border-border-soft">
          {isCouple && (
            <Button variant="ghost" size="sm" onClick={toggleVisibility} disabled={pending}>
              {vis === "COUPLE_ONLY" ? "Make public" : "Make couple-only"}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
            Delete
          </Button>
        </div>
      )}
    </article>
  );
}
