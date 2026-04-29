"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookFieldsCard } from "./BookFieldsCard";
import { BookOutfitCardEditor } from "./BookOutfitCard";
import { BookRecipeCard } from "./BookRecipeCard";
import { BookShotListCard } from "./BookShotListCard";
import { SubsectionEditor } from "./SubsectionEditor";

// v1.30.0: per-card linked tasks panel. Renders below each card so
// the user can see the open questions / decisions / tasks attached to
// that specific Wedding Book card. Search box (client-side) scoped to
// the card's tasks. Empty list collapses the panel entirely so empty
// cards stay visually clean.
type LinkedTask = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  bookSubsectionId: string | null;
};

function LinkedTasksPanel({ tasks }: { tasks: LinkedTask[] }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return tasks;
    const t = search.trim().toLowerCase();
    return tasks.filter((x) => x.title.toLowerCase().includes(t));
  }, [tasks, search]);
  if (tasks.length === 0) return null;
  return (
    <div className="mt-2 mb-4 bg-canvas/40 border border-border-soft rounded-md">
      <div className="px-3 py-2 border-b border-border-soft flex items-baseline gap-2">
        <strong className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
          Linked tasks
        </strong>
        <span className="text-[10px] text-ink-tertiary tabular-nums">
          {filtered.length}/{tasks.length}
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="ml-auto text-[11px] bg-surface text-ink-primary border border-border-soft rounded-sm px-1.5 py-0.5 outline-none focus:border-moss-500 max-w-[140px]"
        />
        <Link
          href="/tasks"
          className="text-[10px] text-info hover:underline"
        >
          Manage →
        </Link>
      </div>
      {filtered.length === 0 ? (
        <p className="px-3 py-2 text-xs text-ink-tertiary italic">No matches.</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {filtered.map((t) => (
            <li key={t.id} className="flex items-baseline gap-2 px-3 py-1.5 text-xs">
              <span className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider w-14 flex-shrink-0">
                {t.type === "TASK" ? "Task" : t.type === "QUESTION" ? "Q" : "Decision"}
              </span>
              <span className={[
                "flex-1 min-w-0 truncate",
                t.status === "DONE" ? "text-ink-tertiary line-through" : "text-ink-primary",
              ].join(" ")}>
                {t.title}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-ink-tertiary">
                {t.status.toLowerCase().replace("_", " ")}
              </span>
              {t.dueDate && (
                <span className="text-[10px] text-ink-tertiary tabular-nums">
                  {t.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// v1.26.0: kind discriminator → per-kind editor. Each subsection
// arrives from the server with all its per-kind data eager-loaded
// (fieldDefs / recipe / shotList / outfitCard) so the editors are
// pure presentational components — no N+1 fetches inside the client.
//
// Defensive defaults: if a per-kind row is missing for a non-TEXT
// card (shouldn't happen — createBookSubsection seeds them — but
// would happen for any pre-v1.26.0 row mass-converted to a non-TEXT
// kind via SQL), the editor renders with empty defaults rather than
// crashing.

type Sub = {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  fields: unknown;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  kind: "TEXT" | "FIELD" | "RECIPE" | "SHOT_LIST" | "OUTFIT";
  fieldDefs: Array<{
    id: string;
    label: string;
    type: string;
    options: string[];
    order: number;
  }>;
  recipe: {
    ingredients: unknown;
    steps: unknown;
    notes: string | null;
  } | null;
  shotList: {
    id: string;
    shots: Array<{
      id: string;
      title: string;
      withWhom: string[];
      location: string | null;
      notes: string | null;
      captured: boolean;
      capturedAt: Date | null;
      order: number;
    }>;
  } | null;
  outfitCard: {
    id: string;
    outfits: Array<{
      id: string;
      personName: string;
      role: string | null;
      items: string[];
      supplier: string | null;
      status: string | null;
      notes: string | null;
      order: number;
    }>;
  } | null;
};

export function CardRouter({
  sub,
  canEdit,
  isCouple,
  linkedTasks = [],
}: {
  sub: Sub;
  canEdit: boolean;
  isCouple: boolean;
  // v1.30.0: tasks/questions/decisions linked to this specific
  // subsection. Surfaced via the LinkedTasksPanel below the card.
  linkedTasks?: LinkedTask[];
}) {
  let card: React.ReactNode;
  switch (sub.kind) {
    case "TEXT":
      card = (
        <SubsectionEditor
          sub={{
            id: sub.id,
            slug: sub.slug,
            title: sub.title,
            body: sub.body,
            visibility: sub.visibility,
          }}
          canEdit={canEdit}
          isCouple={isCouple}
        />
      );
      break;
    case "FIELD":
      card = (
        <BookFieldsCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          fieldDefs={sub.fieldDefs}
          values={
            sub.fields && typeof sub.fields === "object"
              ? (sub.fields as Record<string, string | number | null>)
              : {}
          }
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
        />
      );
      break;
    case "RECIPE":
      card = (
        <BookRecipeCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          ingredients={Array.isArray(sub.recipe?.ingredients) ? (sub.recipe!.ingredients as string[]) : []}
          steps={Array.isArray(sub.recipe?.steps) ? (sub.recipe!.steps as string[]) : []}
          notes={sub.recipe?.notes ?? ""}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
        />
      );
      break;
    case "SHOT_LIST":
      card = (
        <BookShotListCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          shotListId={sub.shotList?.id ?? ""}
          shots={sub.shotList?.shots ?? []}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
        />
      );
      break;
    case "OUTFIT":
      card = (
        <BookOutfitCardEditor
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          cardId={sub.outfitCard?.id ?? ""}
          outfits={sub.outfitCard?.outfits ?? []}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
        />
      );
      break;
    default: {
      // Exhaustiveness guard. If a new kind is added to the schema
      // without a matching CardRouter branch, TS catches it here.
      const exhaust: never = sub.kind;
      void exhaust;
      card = null;
    }
  }
  return (
    <>
      {card}
      <LinkedTasksPanel tasks={linkedTasks} />
    </>
  );
}
