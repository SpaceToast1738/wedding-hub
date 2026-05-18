"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { notify } from "@/lib/notify";
import { recipeRollups } from "@/lib/book-cards";
import { saveRecipeCard, type RecipeSavePayload } from "../actions";
import { CardChrome } from "./CardChrome";
import type { LinkedTaskRow } from "./CardLinkedTasksPanel";
import type { UserOpt } from "@/app/(app)/tasks/AddTaskToggle";
import { FieldLabel, Label, newRowId } from "./bookCardUi";

// v1.26.0: RECIPE card editor.
// v1.38.0 (P7b/B): structured steps (instruction + duration + day-
// before tag) replace the legacy plain-string list. `servingsBase`
// header field lets the user record the recipe's intended yield;
// the time-budget rollup splits day-before prep from active time.

type Step = {
  id: string;
  instruction: string;
  durationMinutes: number | null;
  dayBefore: boolean;
  order: number;
};

type CardProps = {
  subsectionId: string;
  slug: string;
  title: string;
  ingredients: string[];
  steps: Step[];
  servingsBase: number | null;
  notes: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  linkedTasks?: LinkedTaskRow[];
  users?: UserOpt[];
};

function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return mins === 0 ? `${h}h` : `${h}h ${mins}m`;
}

export function BookRecipeCard({
  subsectionId,
  slug,
  title,
  ingredients: initialIngredients,
  steps: initialSteps,
  servingsBase: initialServingsBase,
  notes: initialNotes,
  visibility,
  canEdit,
  isCouple,
  linkedTasks = [],
  users = [],
}: CardProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [ingredients, setIngredients] = useState<string[]>(initialIngredients);
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [servingsBase, setServingsBase] = useState<string>(
    initialServingsBase != null ? String(initialServingsBase) : "",
  );
  const [notes, setNotes] = useState<string>(initialNotes);
  // v1.38.0: scaling control — view-mode multiplier for ingredient
  // amounts. The text passes through as-is (ingredient list is free
  // text), so the scaling is a *visual hint* — the strings show
  // "×N" beside them. Couple eyeballs the multiplier mentally; we
  // don't try to parse "50ml" → 100ml because the formats are too
  // wild.
  const [scale, setScale] = useState(1);

  // Re-sync from props when the parent fetches fresh.
  useEffect(() => {
    setIngredients(initialIngredients);
    setSteps(initialSteps);
    setServingsBase(initialServingsBase != null ? String(initialServingsBase) : "");
    setNotes(initialNotes);
  }, [initialIngredients, initialSteps, initialServingsBase, initialNotes]);

  function cancel() {
    setIngredients(initialIngredients);
    setSteps(initialSteps);
    setServingsBase(initialServingsBase != null ? String(initialServingsBase) : "");
    setNotes(initialNotes);
    setEditing(false);
  }

  function save() {
    // Ingredient + step text validation client-side; server re-checks.
    const trimmedIngredients = ingredients.map((i) => i.trim()).filter((i) => i.length > 0);
    for (let i = 0; i < steps.length; i++) {
      if (!steps[i]!.instruction.trim()) {
        notify("error", `Step #${i + 1} needs an instruction.`);
        return;
      }
    }
    const sb = servingsBase.trim() === "" ? null : Number(servingsBase);
    if (sb != null && (!Number.isFinite(sb) || sb < 1)) {
      notify("error", "Servings base must be ≥ 1");
      return;
    }
    const payload: RecipeSavePayload = {
      ingredients: trimmedIngredients,
      notes: notes.trim() || null,
      servingsBase: sb,
      steps: steps.map((s) => ({
        id: s.id,
        instruction: s.instruction.trim(),
        durationMinutes: s.durationMinutes,
        dayBefore: s.dayBefore,
      })),
    };
    startTransition(async () => {
      const res = await saveRecipeCard(subsectionId, payload);
      if (res.ok) {
        notify("success", "Saved");
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  const r = recipeRollups(steps);
  const baseServings = initialServingsBase ?? null;
  const scaledServings = baseServings != null ? baseServings * scale : null;

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Recipe"
      linkedTasks={linkedTasks}
      users={users}
    >
      {/* Header strip: servings + active / day-before time */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        <Stat
          label="Serves"
          value={
            baseServings != null
              ? scale === 1
                ? String(baseServings)
                : `${baseServings} → ${scaledServings} (×${scale})`
              : "—"
          }
        />
        <Stat
          label="Active time"
          value={r.activeMinutes != null ? formatMinutes(r.activeMinutes) : "—"}
        />
        <Stat
          label="Day-before"
          value={
            r.dayBeforeCount === 0
              ? "—"
              : r.dayBeforeMinutes != null
                ? `${r.dayBeforeCount} step${r.dayBeforeCount === 1 ? "" : "s"} · ${formatMinutes(r.dayBeforeMinutes)}`
                : `${r.dayBeforeCount} step${r.dayBeforeCount === 1 ? "" : "s"}`
          }
        />
      </div>

      {/* View-mode scaling slider — only shown when servingsBase is set
          and not editing. */}
      {!editing && baseServings != null && (
        <div className="flex items-center gap-2 mb-3 text-[11px] text-ink-tertiary">
          <span>Scale:</span>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScale(n)}
              className={[
                "rounded-sm border px-2 py-0.5",
                scale === n
                  ? "bg-moss-50 border-moss-300 text-moss-700"
                  : "bg-canvas border-border-soft text-ink-tertiary hover:text-ink-primary",
              ].join(" ")}
            >
              ×{n}
            </button>
          ))}
        </div>
      )}

      {editing ? (
        <EditBody
          ingredients={ingredients}
          setIngredients={setIngredients}
          steps={steps}
          setSteps={setSteps}
          servingsBase={servingsBase}
          setServingsBase={setServingsBase}
          notes={notes}
          setNotes={setNotes}
          pending={pending}
        />
      ) : (
        <ViewBody ingredients={ingredients} steps={steps} notes={notes} scale={scale} />
      )}

      {canEdit && (
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border-soft">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={save} disabled={pending}>
                Save changes
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      )}
    </CardChrome>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas/40 border border-border-soft rounded-md px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
        {label}
      </div>
      <div className="text-sm text-ink-primary truncate font-medium">{value || "—"}</div>
    </div>
  );
}

function ViewBody({
  ingredients,
  steps,
  notes,
  scale,
}: {
  ingredients: string[];
  steps: Step[];
  notes: string;
  scale: number;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
          Ingredients
          {scale !== 1 && (
            <span className="ml-1 text-ink-secondary normal-case font-normal">
              (×{scale})
            </span>
          )}
        </strong>
        {ingredients.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">—</p>
        ) : (
          <ul className="space-y-0.5 text-sm text-ink-primary list-disc pl-5">
            {ingredients.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
          Steps
        </strong>
        {steps.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">—</p>
        ) : (
          <ol className="space-y-1.5 text-sm text-ink-primary">
            {steps.map((s, i) => (
              <li key={s.id} className="flex items-baseline gap-2">
                <span className="text-[10px] text-ink-tertiary tabular-nums w-5 flex-shrink-0">
                  {i + 1}.
                </span>
                <span className="flex-1">
                  {s.instruction}
                  {s.durationMinutes != null && s.durationMinutes > 0 && (
                    <span className="ml-1 text-[10px] text-ink-tertiary">
                      · {formatMinutes(s.durationMinutes)}
                    </span>
                  )}
                  {s.dayBefore && (
                    <span className="ml-1 text-[10px] uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-marigold-100 border border-marigold-700/30 text-marigold-700">
                      day before
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {notes && (
        <div className="sm:col-span-2">
          <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
            Notes
          </strong>
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">{notes}</p>
        </div>
      )}
    </div>
  );
}

function EditBody({
  ingredients,
  setIngredients,
  steps,
  setSteps,
  servingsBase,
  setServingsBase,
  notes,
  setNotes,
  pending,
}: {
  ingredients: string[];
  setIngredients: (v: string[]) => void;
  steps: Step[];
  setSteps: (v: Step[]) => void;
  servingsBase: string;
  setServingsBase: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  pending: boolean;
}) {
  function patchStep(idx: number, p: Partial<Step>) {
    const next = [...steps];
    next[idx] = { ...next[idx]!, ...p };
    setSteps(next);
  }
  function addStep() {
    setSteps([
      ...steps,
      {
        id: newRowId(),
        instruction: "",
        durationMinutes: null,
        dayBefore: false,
        order: steps.length,
      },
    ]);
  }
  function removeStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx));
  }
  function moveStep(idx: number, delta: -1 | 1) {
    const j = idx + delta;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    setSteps(next);
  }
  function updateIngredient(i: number, v: string) {
    const next = [...ingredients];
    next[i] = v;
    setIngredients(next);
  }
  function removeIngredient(i: number) {
    setIngredients(ingredients.filter((_, idx) => idx !== i));
  }
  function moveIngredient(i: number, delta: -1 | 1) {
    const j = i + delta;
    if (j < 0 || j >= ingredients.length) return;
    const next = [...ingredients];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setIngredients(next);
  }

  return (
    <div className="space-y-4">
      <FieldLabel className="max-w-[180px]">
        <Label>Servings base</Label>
        <input
          type="number"
          value={servingsBase}
          onChange={(e) => setServingsBase(e.target.value)}
          placeholder="e.g. 8"
          min={1}
          max={1000}
          disabled={pending}
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 tabular-nums"
        />
      </FieldLabel>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
            Ingredients ({ingredients.length})
          </strong>
          <ol className="space-y-1 mb-2">
            {ingredients.map((item, i) => (
              <li key={i} className="flex items-center gap-1.5 text-sm">
                <span className="text-[10px] text-ink-tertiary tabular-nums w-5 flex-shrink-0">
                  {i + 1}.
                </span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateIngredient(i, e.target.value)}
                  placeholder="e.g. 50ml gin"
                  maxLength={500}
                  disabled={pending}
                  className="flex-1 text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
                />
                <button
                  type="button"
                  onClick={() => moveIngredient(i, -1)}
                  disabled={pending || i === 0}
                  className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-1"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveIngredient(i, 1)}
                  disabled={pending || i === ingredients.length - 1}
                  className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-1"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  disabled={pending}
                  className="text-[10px] text-ink-tertiary hover:text-danger px-1"
                  aria-label="Remove"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          <Button variant="ghost" size="sm" onClick={() => setIngredients([...ingredients, ""])} disabled={pending}>
            + Add ingredient
          </Button>
        </div>
        <div>
          <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
            Steps ({steps.length})
          </strong>
          <ol className="space-y-2 mb-2">
            {steps.map((s, i) => (
              <li key={s.id} className="bg-canvas/30 border border-border-soft rounded-md p-2 space-y-1.5">
                <div className="flex items-start gap-1.5 text-sm">
                  <span className="text-[10px] text-ink-tertiary tabular-nums w-5 flex-shrink-0 mt-1.5">
                    {i + 1}.
                  </span>
                  <MentionableTextarea
                    value={s.instruction}
                    onChange={(e) => patchStep(i, { instruction: e.target.value })}
                    placeholder="e.g. Stir over ice"
                    rows={Math.max(1, s.instruction.split("\n").length)}
                    maxLength={2000}
                    disabled={pending}
                    className="flex-1 text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500 resize-y"
                  />
                </div>
                <div className="flex items-center gap-2 pl-7 flex-wrap">
                  <FieldLabel className="max-w-[120px]">
                    <Label>Minutes</Label>
                    <input
                      type="number"
                      value={s.durationMinutes ?? ""}
                      onChange={(e) =>
                        patchStep(i, {
                          durationMinutes: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder="—"
                      min={0}
                      max={2880}
                      disabled={pending}
                      className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500 tabular-nums"
                    />
                  </FieldLabel>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={s.dayBefore}
                      onChange={(e) => patchStep(i, { dayBefore: e.target.checked })}
                      disabled={pending}
                    />
                    <span>Day before</span>
                  </label>
                  <span className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveStep(i, -1)}
                      disabled={pending || i === 0}
                      className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-1"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(i, 1)}
                      disabled={pending || i === steps.length - 1}
                      className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-1"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
                      disabled={pending}
                      className="text-[10px] text-ink-tertiary hover:text-danger px-1"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ol>
          <Button variant="ghost" size="sm" onClick={addStep} disabled={pending}>
            + Add step
          </Button>
        </div>
      </div>
      <FieldLabel>
        <Label>Notes</Label>
        <MentionableTextarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Garnish, allergens, swaps…"
          rows={2}
          disabled={pending}
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
        />
      </FieldLabel>
    </div>
  );
}
