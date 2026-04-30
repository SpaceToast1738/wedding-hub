"use client";

import { BookBarCard } from "./BookBarCard";
import { BookBuildCard } from "./BookBuildCard";
import { BookFieldsCard } from "./BookFieldsCard";
import { BookLegalCard } from "./BookLegalCard";
import { BookMenuCard } from "./BookMenuCard";
import { BookOutfitCardEditor } from "./BookOutfitCard";
import { BookRecipeCard } from "./BookRecipeCard";
import { BookSetupCard } from "./BookSetupCard";
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
  kind: "TEXT" | "FIELD" | "RECIPE" | "SHOT_LIST" | "OUTFIT" | "BUILD" | "MENU" | "BAR" | "SETUP" | "LEGAL";
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
  // v1.35.0: OUTFIT rework — card-level fields hold the person +
  // fitting timeline + cost; items are per-item composition. `files`
  // is the global file list the per-card photo picker reads from.
  outfitCard: {
    id: string;
    personName: string | null;
    role: string | null;
    fittingDate: Date | null;
    alterationsDueBy: Date | null;
    pickupDate: Date | null;
    costPence: number | null;
    paidBy: string | null;
    paid: boolean;
    fileIds: string[];
    notes: string | null;
    items: Array<{
      id: string;
      itemLabel: string;
      description: string | null;
      supplier: string | null;
      status: string | null;
      notes: string | null;
      order: number;
    }>;
    files: Array<{ id: string; name: string; mimeType: string }>;
  } | null;
  // v1.32.0: MENU card eager-loaded data + server-computed live counts.
  menuCard: {
    id: string;
    serviceType: string | null;
    serviceTime: string | null;
    pricePerHeadPence: number | null;
    confirmedHeadcount: number | null;
    notes: string | null;
    courses: Array<{
      id: string;
      courseLabel: string;
      order: number;
      options: Array<{
        id: string;
        label: string;
        description: string | null;
        dietary: string[];
        isVegetarianMain: boolean;
        isKidsMeal: boolean;
        order: number;
      }>;
    }>;
    /** courseId → optionId → guest pick count, computed server-side. */
    optionCounts: Record<string, Record<string, number>>;
    allergenAggregate: Record<string, number>;
    totalConfirmed: number;
  } | null;
  // v1.32.0: BAR card eager-loaded data.
  barCard: {
    id: string;
    barType: string | null;
    tabLimitPence: number | null;
    toastDrink: string | null;
    corkagePence: number | null;
    notes: string | null;
    items: Array<{
      id: string;
      category: string;
      name: string;
      quantityPlanned: number | null;
      unit: string | null;
      supplier: string | null;
      costPence: number | null;
      notes: string | null;
      order: number;
      // v1.32.2: per-head pricing + timing label.
      pricePerHeadPence: number | null;
      timing: string | null;
    }>;
    /** Server-supplied confirmed-adult count (from /guests RSVPs). */
    confirmedAdults: number | null;
  } | null;
  // v1.34.0: LEGAL card eager-loaded data + wedding date for the
  // expiry-before-wedding flag + file list for the per-item picker.
  legalCard: {
    id: string;
    regulator: string | null;
    regulatorContact: string | null;
    dueByDate: Date | null;
    notes: string | null;
    items: Array<{
      id: string;
      label: string;
      requiredFor: string | null;
      obtained: boolean;
      obtainedAt: Date | null;
      expiresAt: Date | null;
      fileId: string | null;
      file: { id: string; name: string } | null;
      notes: string | null;
      order: number;
    }>;
    weddingDate: Date | null;
    files: Array<{ id: string; name: string; mimeType: string }>;
  } | null;
  // v1.33.0: SETUP card eager-loaded data + supplier names for the
  // `source` autocomplete on each item row.
  setupCard: {
    id: string;
    space: string | null;
    setupStartsAt: string | null;
    setupOwner: string | null;
    notes: string | null;
    items: Array<{
      id: string;
      name: string;
      quantity: number | null;
      location: string | null;
      source: string | null;
      packed: boolean;
      placed: boolean;
      packDownPlan: string | null;
      notes: string | null;
      order: number;
    }>;
    supplierNames: string[];
  } | null;
  // v1.31.0: BUILD card eager-loaded data.
  // v1.31.1: + budgetLineId + budgetLine snapshot.
  buildCard: {
    id: string;
    quantityNeeded: number | null;
    targetDate: Date | null;
    status: string | null;
    prototypeDone: boolean;
    prototypeNotes: string | null;
    estimatedMinutesPerUnit: number | null;
    notes: string | null;
    budgetLineId: string | null;
    budgetLine: {
      id: string;
      description: string;
      estimated: number | null;
    } | null;
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
    case "OUTFIT": {
      const oc = sub.outfitCard ?? {
        id: "",
        personName: null,
        role: null,
        fittingDate: null,
        alterationsDueBy: null,
        pickupDate: null,
        costPence: null,
        paidBy: null,
        paid: false,
        fileIds: [],
        notes: null,
        items: [],
        files: [],
      };
      return (
        <BookOutfitCardEditor
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
          card={{
            id: oc.id,
            personName: oc.personName,
            role: oc.role,
            fittingDate: oc.fittingDate,
            alterationsDueBy: oc.alterationsDueBy,
            pickupDate: oc.pickupDate,
            costPence: oc.costPence,
            paidBy: oc.paidBy,
            paid: oc.paid,
            fileIds: oc.fileIds,
            notes: oc.notes,
            items: oc.items,
          }}
          files={oc.files}
        />
      );
    }
    case "MENU": {
      const mc = sub.menuCard ?? {
        id: "",
        serviceType: null,
        serviceTime: null,
        pricePerHeadPence: null,
        confirmedHeadcount: null,
        notes: null,
        courses: [],
        optionCounts: {},
        allergenAggregate: {},
        totalConfirmed: 0,
      };
      return (
        <BookMenuCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
          card={{
            id: mc.id,
            serviceType: mc.serviceType,
            serviceTime: mc.serviceTime,
            pricePerHeadPence: mc.pricePerHeadPence,
            confirmedHeadcount: mc.confirmedHeadcount,
            notes: mc.notes,
            courses: mc.courses,
          }}
          optionCounts={mc.optionCounts}
          allergenAggregate={mc.allergenAggregate}
          totalConfirmed={mc.totalConfirmed}
        />
      );
    }
    case "BAR": {
      const bc = sub.barCard ?? {
        id: "",
        barType: null,
        tabLimitPence: null,
        toastDrink: null,
        corkagePence: null,
        notes: null,
        items: [],
        confirmedAdults: null,
      };
      return (
        <BookBarCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
          card={{
            id: bc.id,
            barType: bc.barType,
            tabLimitPence: bc.tabLimitPence,
            toastDrink: bc.toastDrink,
            corkagePence: bc.corkagePence,
            notes: bc.notes,
            items: bc.items,
          }}
          confirmedAdults={bc.confirmedAdults}
        />
      );
    }
    case "LEGAL": {
      const lc = sub.legalCard ?? {
        id: "",
        regulator: null,
        regulatorContact: null,
        dueByDate: null,
        notes: null,
        items: [],
        weddingDate: null,
        files: [],
      };
      return (
        <BookLegalCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
          card={{
            id: lc.id,
            regulator: lc.regulator,
            regulatorContact: lc.regulatorContact,
            dueByDate: lc.dueByDate,
            notes: lc.notes,
            items: lc.items,
          }}
          weddingDate={lc.weddingDate}
          files={lc.files}
        />
      );
    }
    case "SETUP": {
      const sc = sub.setupCard ?? {
        id: "",
        space: null,
        setupStartsAt: null,
        setupOwner: null,
        notes: null,
        items: [],
        supplierNames: [],
      };
      return (
        <BookSetupCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
          card={{
            id: sc.id,
            space: sc.space,
            setupStartsAt: sc.setupStartsAt,
            setupOwner: sc.setupOwner,
            notes: sc.notes,
            items: sc.items,
          }}
          supplierNames={sc.supplierNames}
        />
      );
    }
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
        budgetLineId: null,
        budgetLine: null,
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
