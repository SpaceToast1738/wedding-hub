"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { saveMenuCard, type MenuSavePayload } from "../actions";
import { CardChrome } from "./CardChrome";
import {
  formatGBPFromPence,
  newRowId,
  penceToPoundsString,
  poundsStringToPence,
} from "./bookCardUi";

// v1.32.0: MENU card editor — food service composition. View/Edit
// flow mirrors the v1.31.1 BUILD card. Live counts of guest
// selections per option arrive as a server-computed prop
// (`optionCounts`) so the client doesn't need access to raw guest
// data; counts refresh on save via revalidatePath.

const SERVICE_TYPE_OPTIONS = ["Plated", "Buffet", "Family-style", "Canapés"];

const DIETARY_PRESETS = ["V", "VG", "GF", "DF", "Nuts", "Shellfish", "Halal", "Kosher"];

type Option = {
  id: string;
  label: string;
  description: string | null;
  dietary: string[];
  isVegetarianMain: boolean;
  isKidsMeal: boolean;
  order: number;
};

type Course = {
  id: string;
  courseLabel: string;
  order: number;
  options: Option[];
};

type CardData = {
  id: string;
  serviceType: string | null;
  serviceTime: string | null;
  pricePerHeadPence: number | null;
  confirmedHeadcount: number | null;
  notes: string | null;
  courses: Course[];
};

type MenuCardProps = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  card: CardData;
  /** courseId → optionId → number of guests selected */
  optionCounts: Record<string, Record<string, number>>;
  /** dietary tag → number of selecting guests */
  allergenAggregate: Record<string, number>;
  /** Confirmed total (from card or fallback to attending guests) */
  totalConfirmed: number;
};

export function BookMenuCard({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  isCouple,
  card,
  optionCounts,
  allergenAggregate,
  totalConfirmed,
}: MenuCardProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => buildDraft(card));
  useEffect(() => {
    setDraft(buildDraft(card));
  }, [card]);

  function cancel() {
    setDraft(buildDraft(card));
    setEditing(false);
  }

  function save() {
    // Local validation — every course needs a label, every option needs a label.
    for (let cIdx = 0; cIdx < draft.courses.length; cIdx++) {
      const c = draft.courses[cIdx]!;
      if (!c.courseLabel.trim()) {
        notify("error", `Course #${cIdx + 1} needs a label.`);
        return;
      }
      for (let oIdx = 0; oIdx < c.options.length; oIdx++) {
        if (!c.options[oIdx]!.label.trim()) {
          notify("error", `${c.courseLabel}: option #${oIdx + 1} needs a label.`);
          return;
        }
      }
    }
    const payload: MenuSavePayload = {
      serviceType: draft.serviceType || null,
      serviceTime: draft.serviceTime || null,
      pricePerHeadPence: draft.pricePerHeadPence,
      confirmedHeadcount: draft.confirmedHeadcount,
      notes: draft.notes || null,
      courses: draft.courses.map((c) => ({
        id: c.id,
        courseLabel: c.courseLabel.trim(),
        options: c.options.map((o) => ({
          id: o.id,
          label: o.label.trim(),
          description: o.description?.trim() || null,
          dietary: o.dietary,
          isVegetarianMain: o.isVegetarianMain,
          isKidsMeal: o.isKidsMeal,
        })),
      })),
    };
    startTransition(async () => {
      const res = await saveMenuCard(subsectionId, payload);
      if (res.ok) {
        notify("success", "Saved");
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  const totalPricePence =
    draft.pricePerHeadPence != null && totalConfirmed > 0
      ? draft.pricePerHeadPence * totalConfirmed
      : 0;

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Menu"
    >
      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat label="Service" value={card.serviceType ?? "—"} />
        <Stat label="Confirmed" value={`${totalConfirmed}`} />
        <Stat label="Per head" value={formatGBPFromPence(card.pricePerHeadPence)} />
        <Stat label="Total" value={formatGBPFromPence(totalPricePence)} />
      </div>

      {/* Allergens — aggregate across all options the guests have picked */}
      {Object.keys(allergenAggregate).length > 0 && (
        <div className="mb-4">
          <strong className="block text-[11px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
            Dietary tags across selections
          </strong>
          <div className="flex flex-wrap gap-1">
            {Object.entries(allergenAggregate)
              .sort((a, b) => b[1] - a[1])
              .map(([tag, count]) => (
                <span
                  key={tag}
                  className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-info/10 border border-info/30 text-info"
                >
                  {tag} · {count}
                </span>
              ))}
          </div>
        </div>
      )}

      {editing ? (
        <EditBody draft={draft} setDraft={setDraft} pending={pending} />
      ) : (
        <ViewBody card={card} optionCounts={optionCounts} />
      )}

      {canEdit && (
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border-soft">
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

// ── View body ────────────────────────────────────────────────────

function ViewBody({
  card,
  optionCounts,
}: {
  card: CardData;
  optionCounts: Record<string, Record<string, number>>;
}) {
  if (card.courses.length === 0) {
    return <p className="text-xs text-ink-tertiary italic">No courses set yet.</p>;
  }
  return (
    <div className="space-y-4">
      {card.courses.map((course) => (
        <div key={course.id}>
          <div className="flex items-baseline gap-2 mb-1.5">
            <strong className="text-sm font-semibold text-ink-primary">
              {course.courseLabel}
            </strong>
            <span className="text-[10px] text-ink-tertiary tabular-nums">
              {course.options.length} option{course.options.length === 1 ? "" : "s"}
            </span>
          </div>
          {course.options.length === 0 ? (
            <p className="text-xs text-ink-tertiary italic">No options yet.</p>
          ) : (
            <ul className="divide-y divide-border-soft border border-border-soft rounded-md">
              {course.options.map((option) => {
                const count = optionCounts[course.id]?.[option.id] ?? 0;
                return (
                  <li key={option.id} className="px-3 py-2 flex items-baseline gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm text-ink-primary font-medium">
                          {option.label}
                        </span>
                        {option.isVegetarianMain && (
                          <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-moss-50 border border-moss-300 text-moss-700">
                            Veg main
                          </span>
                        )}
                        {option.isKidsMeal && (
                          <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-marigold-100 border border-marigold-700/30 text-marigold-700">
                            Kids
                          </span>
                        )}
                        {option.dietary.map((d) => (
                          <span
                            key={d}
                            className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-canvas border border-border-soft text-ink-tertiary"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                      {option.description && (
                        <p className="text-xs text-ink-secondary mt-0.5">{option.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-ink-secondary tabular-nums w-16 text-right">
                      {count} pick{count === 1 ? "" : "s"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
      {card.notes && (
        <div className="pt-2">
          <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
            Notes
          </strong>
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">{card.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Edit body ────────────────────────────────────────────────────

type Draft = {
  serviceType: string;
  serviceTime: string;
  pricePerHeadPence: number | null;
  confirmedHeadcount: number | null;
  notes: string;
  courses: Course[];
};

function buildDraft(card: CardData): Draft {
  return {
    serviceType: card.serviceType ?? "",
    serviceTime: card.serviceTime ?? "",
    pricePerHeadPence: card.pricePerHeadPence,
    confirmedHeadcount: card.confirmedHeadcount,
    notes: card.notes ?? "",
    courses: card.courses.map((c) => ({
      id: c.id,
      courseLabel: c.courseLabel,
      order: c.order,
      options: c.options.map((o) => ({ ...o })),
    })),
  };
}

function EditBody({
  draft,
  setDraft,
  pending,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  pending: boolean;
}) {
  function patch(p: Partial<Draft>) {
    setDraft({ ...draft, ...p });
  }
  function patchCourse(idx: number, p: Partial<Course>) {
    const next = [...draft.courses];
    next[idx] = { ...next[idx]!, ...p };
    setDraft({ ...draft, courses: next });
  }
  function addCourse() {
    setDraft({
      ...draft,
      courses: [
        ...draft.courses,
        {
          id: newRowId(),
          courseLabel: "",
          order: draft.courses.length,
          options: [],
        },
      ],
    });
  }
  function removeCourse(idx: number) {
    setDraft({ ...draft, courses: draft.courses.filter((_, i) => i !== idx) });
  }
  function moveCourse(idx: number, delta: -1 | 1) {
    const j = idx + delta;
    if (j < 0 || j >= draft.courses.length) return;
    const next = [...draft.courses];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    setDraft({ ...draft, courses: next });
  }
  function patchOption(courseIdx: number, optIdx: number, p: Partial<Option>) {
    const next = [...draft.courses];
    const courseNext = { ...next[courseIdx]! };
    const opts = [...courseNext.options];
    opts[optIdx] = { ...opts[optIdx]!, ...p };
    courseNext.options = opts;
    next[courseIdx] = courseNext;
    setDraft({ ...draft, courses: next });
  }
  function addOption(courseIdx: number) {
    const next = [...draft.courses];
    const courseNext = { ...next[courseIdx]! };
    courseNext.options = [
      ...courseNext.options,
      {
        id: newRowId(),
        label: "",
        description: null,
        dietary: [],
        isVegetarianMain: false,
        isKidsMeal: false,
        order: courseNext.options.length,
      },
    ];
    next[courseIdx] = courseNext;
    setDraft({ ...draft, courses: next });
  }
  function removeOption(courseIdx: number, optIdx: number) {
    const next = [...draft.courses];
    const courseNext = { ...next[courseIdx]! };
    courseNext.options = courseNext.options.filter((_, i) => i !== optIdx);
    next[courseIdx] = courseNext;
    setDraft({ ...draft, courses: next });
  }

  const [pricePerHeadStr, setPricePerHeadStr] = useState(
    penceToPoundsString(draft.pricePerHeadPence),
  );
  function commitPrice(s: string) {
    patch({ pricePerHeadPence: poundsStringToPence(s) });
  }

  return (
    <div className="space-y-4">
      {/* Header fields */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Field label="Service type" hint="Plated, buffet, family-style, canapés…">
          <select
            value={draft.serviceType}
            onChange={(e) => patch({ serviceType: e.target.value })}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          >
            <option value="">— pick —</option>
            {SERVICE_TYPE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Service time" hint="Free text, e.g. ‘1:30pm wedding breakfast'.">
          <input
            type="text"
            value={draft.serviceTime}
            onChange={(e) => patch({ serviceTime: e.target.value })}
            disabled={pending}
            placeholder="e.g. 1:30pm wedding breakfast"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </Field>
        <Field label="Price per head" hint="What the caterer charges per cover.">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-tertiary text-sm pointer-events-none">£</span>
            <input
              type="text"
              inputMode="decimal"
              value={pricePerHeadStr}
              onChange={(e) => setPricePerHeadStr(e.target.value)}
              onBlur={() => commitPrice(pricePerHeadStr)}
              disabled={pending}
              placeholder="0.00"
              className="w-full text-sm bg-surface border border-border-soft rounded-sm pl-5 pr-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 tabular-nums text-right"
            />
          </div>
        </Field>
        <Field label="Confirmed headcount" hint="Override the auto-count if you've already confirmed numbers.">
          <input
            type="number"
            min={0}
            value={draft.confirmedHeadcount ?? ""}
            onChange={(e) =>
              patch({ confirmedHeadcount: e.target.value === "" ? null : Number(e.target.value) })
            }
            disabled={pending}
            placeholder="auto from RSVPs"
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          />
        </Field>
      </div>

      {/* Courses */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <strong className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold">
            Courses ({draft.courses.length})
          </strong>
          <Button variant="ghost" size="sm" onClick={addCourse} disabled={pending}>
            + Add course
          </Button>
        </div>
        {draft.courses.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">
            Add a course (e.g. Starter, Main, Dessert).
          </p>
        ) : (
          <div className="space-y-3">
            {draft.courses.map((c, courseIdx) => (
              <CourseEditCard
                key={c.id}
                course={c}
                isFirst={courseIdx === 0}
                isLast={courseIdx === draft.courses.length - 1}
                pending={pending}
                onRename={(courseLabel) => patchCourse(courseIdx, { courseLabel })}
                onRemove={() => removeCourse(courseIdx)}
                onMoveUp={() => moveCourse(courseIdx, -1)}
                onMoveDown={() => moveCourse(courseIdx, 1)}
                onPatchOption={(optIdx, p) => patchOption(courseIdx, optIdx, p)}
                onAddOption={() => addOption(courseIdx)}
                onRemoveOption={(optIdx) => removeOption(courseIdx, optIdx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <Field label="Notes" hint="Anything the caterer should know — allergens, swaps, timings.">
        <textarea
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          disabled={pending}
          rows={3}
          placeholder="e.g. 4 kids meals (under 10). Vegan main is a hard count."
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
        />
      </Field>
    </div>
  );
}

function CourseEditCard({
  course,
  isFirst,
  isLast,
  pending,
  onRename,
  onRemove,
  onMoveUp,
  onMoveDown,
  onPatchOption,
  onAddOption,
  onRemoveOption,
}: {
  course: Course;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  onRename: (label: string) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPatchOption: (optIdx: number, p: Partial<Option>) => void;
  onAddOption: () => void;
  onRemoveOption: (optIdx: number) => void;
}) {
  return (
    <div className="border border-border-soft rounded-md overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-canvas/40 border-b border-border-soft">
        <input
          value={course.courseLabel}
          onChange={(e) => onRename(e.target.value)}
          disabled={pending}
          placeholder="Course label (e.g. Starter)"
          className="flex-1 text-sm font-semibold bg-transparent border-0 outline-none text-ink-primary focus:bg-surface focus:px-2 focus:rounded-sm"
        />
        <button
          type="button"
          onClick={onMoveUp}
          disabled={pending || isFirst}
          className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-1"
          aria-label="Move course up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={pending || isLast}
          className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-1"
          aria-label="Move course down"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete course "${course.courseLabel || "(untitled)"}" and its options?`)) onRemove();
          }}
          disabled={pending}
          className="text-[10px] text-ink-tertiary hover:text-danger px-1"
          aria-label="Delete course"
        >
          ×
        </button>
      </div>
      <ul className="divide-y divide-border-soft">
        {course.options.map((option, optIdx) => (
          <OptionEditRow
            key={option.id}
            option={option}
            pending={pending}
            onChange={(p) => onPatchOption(optIdx, p)}
            onRemove={() => onRemoveOption(optIdx)}
          />
        ))}
      </ul>
      <div className="px-3 py-2 bg-canvas/20">
        <Button variant="ghost" size="sm" onClick={onAddOption} disabled={pending}>
          + Add option
        </Button>
      </div>
    </div>
  );
}

function OptionEditRow({
  option,
  pending,
  onChange,
  onRemove,
}: {
  option: Option;
  pending: boolean;
  onChange: (p: Partial<Option>) => void;
  onRemove: () => void;
}) {
  const [dietaryStr, setDietaryStr] = useState(option.dietary.join(", "));
  useEffect(() => {
    setDietaryStr(option.dietary.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option.id]);

  function commitDietary(s: string) {
    const tags = s.split(",").map((t) => t.trim()).filter(Boolean);
    onChange({ dietary: tags });
  }

  return (
    <li className="px-3 py-2.5 bg-surface">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={option.label}
          onChange={(e) => onChange({ label: e.target.value })}
          disabled={pending}
          placeholder="Option label (e.g. Tomato soup)"
          className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
        <input
          value={dietaryStr}
          onChange={(e) => setDietaryStr(e.target.value)}
          onBlur={() => commitDietary(dietaryStr)}
          disabled={pending}
          placeholder={`Dietary tags (e.g. ${DIETARY_PRESETS.slice(0, 3).join(", ")})`}
          className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
      </div>
      <input
        value={option.description ?? ""}
        onChange={(e) => onChange({ description: e.target.value })}
        disabled={pending}
        placeholder="Short description (optional)"
        className="w-full mt-2 text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <div className="flex items-center justify-between mt-2 text-xs">
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={option.isVegetarianMain}
              onChange={(e) => onChange({ isVegetarianMain: e.target.checked })}
              disabled={pending}
            />
            <span className="text-ink-secondary">Vegetarian main</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={option.isKidsMeal}
              onChange={(e) => onChange({ isKidsMeal: e.target.checked })}
              disabled={pending}
            />
            <span className="text-ink-secondary">Kids meal</span>
          </label>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          className="text-[10px] text-ink-tertiary hover:text-danger px-1"
          aria-label="Remove option"
        >
          × Remove
        </button>
      </div>
    </li>
  );
}

// ── Shared layout helpers ─────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas/40 border border-border-soft rounded-md px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
        {label}
      </div>
      <div className="text-sm text-ink-primary tabular-nums truncate font-medium">
        {value || "—"}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-tertiary">{hint}</p>}
    </div>
  );
}
