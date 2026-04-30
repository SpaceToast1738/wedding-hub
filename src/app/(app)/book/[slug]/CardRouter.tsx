"use client";

import { BookBuildCard } from "./BookBuildCard";
import { BookFieldsCard } from "./BookFieldsCard";
import { BookOutfitCardEditor } from "./BookOutfitCard";
import { BookRecipeCard } from "./BookRecipeCard";
import { BookShotListCard } from "./BookShotListCard";
import { SubsectionEditor } from "./SubsectionEditor";

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
//
// v1.30.5: the per-card LinkedTasksPanel was extracted to its own
// file (LinkedTasksPanel.tsx) and relocated to the section page —
// task↔Book links now snap to the section, not the subsection.

type Sub = {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  fields: unknown;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  kind: "TEXT" | "FIELD" | "RECIPE" | "SHOT_LIST" | "OUTFIT" | "BUILD";
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
  // v1.31.0: BUILD card eager-loaded data.
  buildCard: {
    id: string;
    quantityNeeded: number | null;
    targetDate: Date | null;
    status: string | null;
    prototypeDone: boolean;
    prototypeNotes: string | null;
    estimatedMinutesPerUnit: number | null;
    notes: string | null;
    materials: Array<{
      id: string;
      name: string;
      quantity: number | null;
      unit: string | null;
      supplier: string | null;
      costPence: number | null;
      ordered: boolean;
      arrived: boolean;
      notes: string | null;
      order: number;
    }>;
    sessions: Array<{
      id: string;
      date: Date;
      minutes: number;
      unitsCompleted: number | null;
      notes: string | null;
    }>;
  } | null;
};

export function CardRouter({
  sub,
  canEdit,
  isCouple,
}: {
  sub: Sub;
  canEdit: boolean;
  isCouple: boolean;
}) {
  switch (sub.kind) {
    case "TEXT":
      return (
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
    case "FIELD":
      return (
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
    case "RECIPE":
      return (
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
    case "SHOT_LIST":
      return (
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
    case "OUTFIT":
      return (
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
    case "BUILD": {
      // Defensive default if buildCard is missing — shouldn't happen
      // because createBookSubsection seeds it, but legacy rows pre-
      // dating the seeder fix would render with empty defaults.
      const bc = sub.buildCard ?? {
        id: "",
        quantityNeeded: null,
        targetDate: null,
        status: null,
        prototypeDone: false,
        prototypeNotes: null,
        estimatedMinutesPerUnit: null,
        notes: null,
        materials: [],
        sessions: [],
      };
      return (
        <BookBuildCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
          card={bc}
        />
      );
    }
    default: {
      // Exhaustiveness guard. If a new kind is added to the schema
      // without a matching CardRouter branch, TS catches it here.
      const exhaust: never = sub.kind;
      void exhaust;
      return null;
    }
  }
}
