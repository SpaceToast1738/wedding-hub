"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { updateBookRecipe } from "../actions";
import { CardChrome } from "./CardChrome";

// v1.26.0: RECIPE card editor. The whole card is one editable form
// — ingredients list, steps list, notes — saved as a single payload.
// Each list is row + delete-x; new entries via the "+ Add" button at
// the bottom of each list. Reorder via ↑/↓ (mirrors photography
// shot-list pattern, kept simple — no drag handle).
//
// Save behaviour: dirty-tracked. Save button shows when anything
// differs from the saved snapshot. Reset reverts.

export function BookRecipeCard({
  subsectionId,
  slug,
  title,
  ingredients: initialIngredients,
  steps: initialSteps,
  notes: initialNotes,
  visibility,
  canEdit,
  isCouple,
}: {
  subsectionId: string;
  slug: string;
  title: string;
  ingredients: string[];
  steps: string[];
  notes: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
}) {
  const [ingredients, setIngredients] = useState<string[]>(initialIngredients);
  const [steps, setSteps] = useState<string[]>(initialSteps);
  const [notes, setNotes] = useState<string>(initialNotes);
  const [savedIngredients, setSavedIngredients] = useState(initialIngredients);
  const [savedSteps, setSavedSteps] = useState(initialSteps);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [pending, startTransition] = useTransition();

  const dirty =
    JSON.stringify(ingredients) !== JSON.stringify(savedIngredients) ||
    JSON.stringify(steps) !== JSON.stringify(savedSteps) ||
    notes !== savedNotes;

  function save() {
    startTransition(async () => {
      const res = await updateBookRecipe(
        subsectionId,
        ingredients,
        steps,
        notes.trim() === "" ? null : notes,
      );
      if (res.ok) {
        setSavedIngredients(ingredients);
        setSavedSteps(steps);
        setSavedNotes(notes);
        notify("success", "Recipe saved");
      } else {
        notify("error", res.error);
      }
    });
  }

  function reset() {
    setIngredients(savedIngredients);
    setSteps(savedSteps);
    setNotes(savedNotes);
  }

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Recipe"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <RecipeList
          heading="Ingredients"
          items={ingredients}
          onChange={setIngredients}
          canEdit={canEdit}
          placeholder="e.g. 50ml gin"
        />
        <RecipeList
          heading="Steps"
          items={steps}
          onChange={setSteps}
          canEdit={canEdit}
          placeholder="e.g. Stir over ice"
        />
      </div>
      <div className="mt-3">
        <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
          Notes
        </strong>
        {canEdit ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Garnish, allergens, swaps…"
            rows={2}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
          />
        ) : (
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">
            {savedNotes || <span className="text-ink-tertiary italic">—</span>}
          </p>
        )}
      </div>
      {canEdit && dirty && (
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="ghost" size="sm" onClick={reset} disabled={pending}>
            Reset
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={pending}>
            Save
          </Button>
        </div>
      )}
    </CardChrome>
  );
}

function RecipeList({
  heading,
  items,
  onChange,
  canEdit,
  placeholder,
}: {
  heading: string;
  items: string[];
  onChange: (next: string[]) => void;
  canEdit: boolean;
  placeholder: string;
}) {
  function update(i: number, value: string) {
    const next = [...items];
    next[i] = value;
    onChange(next);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function move(i: number, delta: -1 | 1) {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  }
  function add() {
    onChange([...items, ""]);
  }
  return (
    <div>
      <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
        {heading}
      </strong>
      {items.length === 0 && !canEdit ? (
        <p className="text-xs text-ink-tertiary italic">—</p>
      ) : (
        <ol className="space-y-1 mb-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5 text-sm">
              <span className="text-[10px] text-ink-tertiary tabular-nums w-5 flex-shrink-0">
                {i + 1}.
              </span>
              {canEdit ? (
                <>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => update(i, e.target.value)}
                    placeholder={placeholder}
                    maxLength={500}
                    className="flex-1 text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
                  />
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-40 px-1"
                    aria-label="Move up"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                    className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-40 px-1"
                    aria-label="Move down"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-[10px] text-ink-tertiary hover:text-danger px-1"
                    aria-label="Remove"
                    title="Remove"
                  >
                    ×
                  </button>
                </>
              ) : (
                <span className="flex-1 text-ink-primary">{item}</span>
              )}
            </li>
          ))}
        </ol>
      )}
      {canEdit && (
        <Button variant="ghost" size="sm" onClick={add}>
          + Add
        </Button>
      )}
    </div>
  );
}
