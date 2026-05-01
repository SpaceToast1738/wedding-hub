"use client";

import { BookBarCard } from "./BookBarCard";
import { BookBuildCard } from "./BookBuildCard";
import { BookFieldsCard } from "./BookFieldsCard";
import { BookLegalCard } from "./BookLegalCard";
import { BookLodgingCard } from "./BookLodgingCard";
import { BookMenuCard } from "./BookMenuCard";
import { BookOutfitCardEditor } from "./BookOutfitCard";
import { BookRecipeCard } from "./BookRecipeCard";
import { BookSetupCard } from "./BookSetupCard";
import { BookShotListCard } from "./BookShotListCard";
import { BookStayCard } from "./BookStayCard";
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
  // v1.37.0: TEXT cards now author HTML via Tiptap. `body` stays one
  // release as a recoverability buffer; new edits write `bodyHtml`.
  bodyHtml: string | null;
  fields: unknown;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  kind: "TEXT" | "FIELD" | "RECIPE" | "SHOT_LIST" | "OUTFIT" | "BUILD" | "MENU" | "BAR" | "SETUP" | "LEGAL" | "STAY" | "LODGING_GUIDE";
  fieldDefs: Array<{
    id: string;
    label: string;
    type: string;
    options: string[];
    order: number;
    // v1.38.0 (P7b/B): richer FIELD authoring metadata.
    group: string | null;
    helpText: string | null;
    required: boolean;
    min: number | null;
    max: number | null;
    dateMin: Date | null;
    dateMax: Date | null;
  }>;
  // v1.38.0: RECIPE gains structured `recipeSteps` rows + `servingsBase`.
  // Legacy `steps` Json column stays one release as a buffer; the
  // editor reads `recipeSteps` exclusively.
  recipe: {
    ingredients: unknown;
    steps: unknown; // legacy json; not used by the editor
    notes: string | null;
    servingsBase: number | null;
    recipeSteps: Array<{
      id: string;
      instruction: string;
      durationMinutes: number | null;
      dayBefore: boolean;
      order: number;
    }>;
  } | null;
  // v1.38.0: SHOT_LIST gains category + estimatedMinutes + guestIds.
  // The page-level fetch threads in `guests` for the linked-guest
  // multi-select picker.
  shotList: {
    id: string;
    shots: Array<{
      id: string;
      title: string;
      category: string | null;
      estimatedMinutes: number | null;
      withWhom: string[];
      guestIds: string[];
      location: string | null;
      notes: string | null;
      captured: boolean;
      capturedAt: Date | null;
      order: number;
    }>;
    guests: Array<{ id: string; name: string }>;
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
  // v1.36.0: STAY card eager-loaded data + global guest list for the
  // linked-guest picker.
  stayCard: {
    id: string;
    propertyName: string | null;
    propertyContact: string | null;
    bookingReference: string | null;
    checkInDate: Date | null;
    checkOutDate: Date | null;
    costPence: number | null;
    paidBy: string | null;
    paid: boolean;
    occupants: string[];
    guestIds: string[];
    notes: string | null;
    guests: Array<{ id: string; name: string }>;
  } | null;
  // v1.36.0: LODGING_GUIDE card eager-loaded data.
  lodgingCard: {
    id: string;
    notes: string | null;
    items: Array<{
      id: string;
      name: string;
      distanceFromVenue: string | null;
      priceRangeLabel: string | null;
      phone: string | null;
      website: string | null;
      groupRateCode: string | null;
      notes: string | null;
      order: number;
    }>;
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

// v1.51.0: per-card linked tasks shape. Loaded by the parent page
// from the parallel Task ↔ BookSubsection m2m. Optional so older
// callers that don't pass the prop still type-check; they just
// don't render the inline panel.
export type LinkedTaskRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: Date | null;
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
  linkedTasks?: LinkedTaskRow[];
}) {
  const body = renderCardBody(sub, canEdit, isCouple);
  // v1.51.0: inline panel renders directly below every kind's body.
  // Hidden when no tasks are linked (empty cards stay clean).
  return (
    <>
      {body}
      {linkedTasks.length > 0 && <CardLinkedTasksPanel tasks={linkedTasks} />}
    </>
  );
}

function renderCardBody(sub: Sub, canEdit: boolean, isCouple: boolean) {
  switch (sub.kind) {
    case "TEXT":
      return (
        <SubsectionEditor
          sub={{
            id: sub.id,
            slug: sub.slug,
            title: sub.title,
            body: sub.body,
            bodyHtml: sub.bodyHtml,
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
          steps={sub.recipe?.recipeSteps ?? []}
          servingsBase={sub.recipe?.servingsBase ?? null}
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
          guests={sub.shotList?.guests ?? []}
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
    case "STAY": {
      const sc = sub.stayCard ?? {
        id: "",
        propertyName: null,
        propertyContact: null,
        bookingReference: null,
        checkInDate: null,
        checkOutDate: null,
        costPence: null,
        paidBy: null,
        paid: false,
        occupants: [],
        guestIds: [],
        notes: null,
        guests: [],
      };
      return (
        <BookStayCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
          card={{
            id: sc.id,
            propertyName: sc.propertyName,
            propertyContact: sc.propertyContact,
            bookingReference: sc.bookingReference,
            checkInDate: sc.checkInDate,
            checkOutDate: sc.checkOutDate,
            costPence: sc.costPence,
            paidBy: sc.paidBy,
            paid: sc.paid,
            occupants: sc.occupants,
            guestIds: sc.guestIds,
            notes: sc.notes,
          }}
          guests={sc.guests}
        />
      );
    }
    case "LODGING_GUIDE": {
      const lg = sub.lodgingCard ?? { id: "", notes: null, items: [] };
      return (
        <BookLodgingCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
          card={{ id: lg.id, notes: lg.notes, items: lg.items }}
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

// v1.51.0: per-card linked tasks panel. Renders directly below the
// card body for any subsection with at least one task linked via
// the bookSubsections m2m. Layout mirrors the section-level
// LinkedTasksPanel but compacted — fewer columns, no search, and
// hugs the card visually so the relationship is unambiguous.
function CardLinkedTasksPanel({ tasks }: { tasks: LinkedTaskRow[] }) {
  function statusLabel(s: string): string {
    return s === "OPEN"
      ? "Open"
      : s === "IN_PROGRESS"
        ? "Doing"
        : s === "WAITING"
          ? "Waiting"
          : s === "DONE"
            ? "Done"
            : s === "ARCHIVED"
              ? "Archived"
              : s;
  }
  function statusClass(s: string): string {
    if (s === "DONE") return "text-moss-700 bg-moss-50 border-moss-300";
    if (s === "OPEN") return "text-marigold-700 bg-marigold-100/40 border-marigold-700/30";
    if (s === "IN_PROGRESS") return "text-info bg-canvas border-border-soft";
    if (s === "WAITING") return "text-ink-tertiary bg-canvas border-border-soft";
    return "text-ink-tertiary bg-canvas border-border-soft";
  }
  function typeBadge(t: string): string {
    return t === "QUESTION" ? "Q" : t === "DECISION" ? "D" : "·";
  }
  function dueLabel(d: Date | null): string {
    if (!d) return "";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  }
  return (
    <section className="mt-2 -mx-px border-x border-b border-border-soft bg-canvas/40 rounded-b-md">
      <header className="px-4 py-1.5 border-b border-border-soft flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-ink-tertiary">
          Linked tasks
        </span>
        <span className="text-[10px] text-ink-tertiary tabular-nums">
          {tasks.length}
        </span>
        <a
          href="/tasks"
          className="ml-auto text-[10px] text-moss-700 hover:underline"
        >
          Manage →
        </a>
      </header>
      <ul className="divide-y divide-border-soft text-sm">
        {tasks.map((t) => (
          <li key={t.id} className="px-4 py-1.5 flex items-center gap-2">
            <span className="text-[10px] font-mono text-ink-tertiary w-4 text-center">
              {typeBadge(t.type)}
            </span>
            <span className="flex-1 min-w-0 truncate text-ink-primary">{t.title}</span>
            <span
              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${statusClass(t.status)}`}
            >
              {statusLabel(t.status)}
            </span>
            {t.dueDate && (
              <span className="text-[10px] text-ink-tertiary tabular-nums whitespace-nowrap">
                {dueLabel(t.dueDate)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
