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
  initialCategory = null,
  existingCategories = [],
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
  // v1.91.0: optional grouping label rendered as a small chip on the
  // card header and editable inline (matches the title's onBlur save
  // pattern). When `canEdit`, the chip becomes an editable input.
  initialCategory?: string | null;
  // Distinct category strings on this section — surface as the
  // datalist for autofill.
  existingCategories?: string[];
}) {
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [vis, setVis] = useState(visibility);
  const [category, setCategory] = useState(initialCategory ?? "");
  const [savedCategory, setSavedCategory] = useState(initialCategory ?? "");
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

  function saveCategory() {
    const next = category.trim();
    if (next === savedCategory) return;
    const fd = new FormData();
    fd.set("title", savedTitle);
    fd.set("category", next);
    startTransition(async () => {
      try {
        await updateBookSubsection(subsectionId, fd);
        setSavedCategory(next);
        setCategory(next);
      } catch (err) {
        setCategory(savedCategory);
        notify("error", err instanceof Error ? err.message : "Couldn't save category");
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
    <article
      id={slug}
      className="bg-surface border border-border-soft rounded-md shadow-sm p-5 scroll-mt-24"
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
      {/* v1.91.0: category strip — editable inline when canEdit.
          Free text + datalist of existing categories on this section
          for one-click autofill. Saves onBlur (same pattern as title). */}
      {canEdit ? (
        <div className="flex items-center gap-2 -mt-2 mb-3">
          <span className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">
            Category
          </span>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onBlur={saveCategory}
            disabled={pending}
            list="card-chrome-category-options"
            placeholder="— uncategorised —"
            className="text-xs bg-transparent border-b border-dashed border-border-soft hover:border-border-strong focus:border-moss-500 px-1 py-0.5 text-ink-secondary outline-none flex-1 min-w-0 max-w-xs"
          />
          {existingCategories.length > 0 && (
            <datalist id="card-chrome-category-options">
              {existingCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          )}
        </div>
      ) : savedCategory ? (
        <div className="-mt-2 mb-3">
          <span className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">
            {savedCategory}
          </span>
        </div>
      ) : null}
      {children}
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
