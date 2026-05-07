"use client";

import { useState, useTransition } from "react";
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
import { setTaskStatus } from "@/app/(app)/tasks/actions";
import { AddTaskToggle, type UserOpt } from "@/app/(app)/tasks/AddTaskToggle";

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
      website: string | null;
      status: string | null;
      notes: string | null;
      order: number;
      // v1.78.0: paid-on-card reciprocal — payments linked to this
      // outfit-item, summed for the chip render.
      paidPence: number;
    }>;
    files: Array<{ id: string; name: string; mimeType: string }>;
    // v1.78.0: linked BudgetLine for the auto-sync chip.
    budgetLine: { id: string; description: string; category: { id: string; name: string } } | null;
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
    // v1.78.0: linked BudgetLine.
    budgetLine: { id: string; description: string; category: { id: string; name: string } } | null;
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
      website: string | null;
      costPence: number | null;
      notes: string | null;
      order: number;
      // v1.32.2: per-head pricing + timing label.
      pricePerHeadPence: number | null;
      timing: string | null;
    }>;
    /** Server-supplied confirmed-adult count (from /guests RSVPs). */
    confirmedAdults: number | null;
    // v1.78.0: linked BudgetLine.
    budgetLine: { id: string; description: string; category: { id: string; name: string } } | null;
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
      website: string | null;
      packed: boolean;
      placed: boolean;
      packDownPlan: string | null;
      notes: string | null;
      order: number;
    }>;
    supplierNames: string[];
    // v1.63.0: photo gallery — File ids + the resolvable file list.
    fileIds: string[];
    files: Array<{ id: string; name: string; mimeType: string }>;
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
    // v1.63.0: photo gallery.
    fileIds: string[];
    files: Array<{ id: string; name: string; mimeType: string }>;
    // v1.78.0: linked BudgetLine.
    budgetLine: { id: string; description: string; category: { id: string; name: string } } | null;
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
  // v1.78.0: + paidPence per material (sum of linked Payment.amount).
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
      website: string | null;
      costPence: number | null;
      ordered: boolean;
      arrived: boolean;
      notes: string | null;
      order: number;
      // v1.78.0: paid-on-card reciprocal — sum of Payment.amount values
      // linked to this material via Payment.bookBuildMaterialId.
      paidPence: number;
    }>;
    sessions: Array<{
      id: string;
      date: Date;
      minutes: number;
      unitsCompleted: number | null;
      notes: string | null;
    }>;
    // v1.63.0: photo gallery.
    fileIds: string[];
    files: Array<{ id: string; name: string; mimeType: string }>;
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
  showMoney = true,
  budgetCategories = [],
  linkedTasks = [],
  users = [],
}: {
  sub: Sub;
  canEdit: boolean;
  isCouple: boolean;
  /** v1.76.0: gates monetary fields on BUILD / MENU / BAR / OUTFIT /
   *  STAY card bodies. When false, costs / per-head prices / totals
   *  hide in view mode and inputs hide (with passthrough hidden) in
   *  edit mode. Defaults to true for callers that don't pass it. */
  showMoney?: boolean;
  /** v1.78.0: budget categories for the Link-to-budget picker on
   *  cost-bearing cards. Empty array (default) means no picker. */
  budgetCategories?: Array<{ id: string; name: string }>;
  linkedTasks?: LinkedTaskRow[];
  users?: UserOpt[];
}) {
  const body = renderCardBody(sub, canEdit, isCouple, showMoney, budgetCategories);
  // v1.51.0: inline panel renders directly below every kind's body.
  // v1.71.0: always shown when canEdit (so "Add task" is available).
  return (
    <>
      {body}
      {(linkedTasks.length > 0 || canEdit) && (
        <CardLinkedTasksPanel
          tasks={linkedTasks}
          subsectionId={sub.id}
          canEdit={canEdit}
          users={users}
        />
      )}
    </>
  );
}

function renderCardBody(
  sub: Sub,
  canEdit: boolean,
  isCouple: boolean,
  showMoney: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  budgetCategories: Array<{ id: string; name: string }>,
) {
  // v1.78.0: budgetCategories is loaded by the page and passed
  // through here for the per-card "Link to budget" pickers (MENU /
  // BAR / OUTFIT / STAY). The UI for those pickers ships in v1.78.1
  // — the data layer + auto-resync server actions are in this
  // release so existing links keep updating.
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
          showMoney={showMoney}
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
          showMoney={showMoney}
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
          showMoney={showMoney}
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
        fileIds: [],
        files: [],
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
            fileIds: sc.fileIds ?? [],
          }}
          supplierNames={sc.supplierNames}
          files={sc.files ?? []}
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
        // v1.63.0: photo gallery default for legacy rows.
        fileIds: [],
        files: [],
      };
      return (
        <BookBuildCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
          showMoney={showMoney}
          card={bc}
          files={bc.files}
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
        fileIds: [],
        files: [],
      };
      return (
        <BookStayCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
          showMoney={showMoney}
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
            fileIds: sc.fileIds ?? [],
          }}
          guests={sc.guests}
          files={sc.files ?? []}
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

// v1.51.0: per-card linked tasks panel.
// v1.71.0: interactive status toggle + AddTaskToggle affordance.
function CardInlineTaskRow({ task, canEdit }: { task: LinkedTaskRow; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState(task.status);
  const isDone = optimisticStatus === "DONE" || optimisticStatus === "ARCHIVED";

  function statusClass(s: string): string {
    if (s === "DONE") return "text-moss-700 bg-moss-50 border-moss-300";
    if (s === "OPEN") return "text-marigold-700 bg-marigold-100/40 border-marigold-700/30";
    if (s === "IN_PROGRESS") return "text-info bg-canvas border-border-soft";
    return "text-ink-tertiary bg-canvas border-border-soft";
  }
  function statusLabel(s: string): string {
    if (s === "OPEN") return "Open";
    if (s === "IN_PROGRESS") return "Doing";
    if (s === "WAITING") return "Waiting";
    if (s === "DONE") return "Done";
    if (s === "ARCHIVED") return "Archived";
    return s;
  }

  function toggle() {
    if (!canEdit) return;
    const next = isDone ? "OPEN" : "DONE";
    setOptimisticStatus(next);
    startTransition(async () => {
      await setTaskStatus(task.id, next as "OPEN" | "DONE");
    });
  }

  return (
    <li className="px-4 py-1.5 flex items-center gap-2">
      {canEdit ? (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`flex-shrink-0 w-3.5 h-3.5 rounded-sm border transition-colors ${
            isDone
              ? "bg-moss-500 border-moss-500 text-white"
              : "border-border-soft bg-surface hover:border-moss-400"
          } flex items-center justify-center disabled:opacity-50`}
          title={isDone ? "Mark as open" : "Mark as done"}
        >
          {isDone && (
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 3l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      ) : (
        <span className="text-[10px] font-mono text-ink-tertiary w-4 text-center">
          {task.type === "QUESTION" ? "Q" : task.type === "DECISION" ? "D" : "·"}
        </span>
      )}
      <span className={`flex-1 min-w-0 truncate text-sm ${isDone ? "text-ink-tertiary line-through" : "text-ink-primary"}`}>
        {task.title}
      </span>
      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border flex-shrink-0 ${statusClass(optimisticStatus)}`}>
        {statusLabel(optimisticStatus)}
      </span>
      {task.dueDate && (
        <span className="text-[10px] text-ink-tertiary tabular-nums whitespace-nowrap flex-shrink-0">
          {task.dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
        </span>
      )}
    </li>
  );
}

function CardLinkedTasksPanel({
  tasks,
  subsectionId,
  canEdit,
  users,
}: {
  tasks: LinkedTaskRow[];
  subsectionId: string;
  canEdit: boolean;
  users: UserOpt[];
}) {
  return (
    <section className="mt-2 -mx-px border-x border-b border-border-soft bg-canvas/40 rounded-b-md">
      <header className="px-4 py-1.5 border-b border-border-soft flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-ink-tertiary">
          Linked tasks
        </span>
        {tasks.length > 0 && (
          <span className="text-[10px] text-ink-tertiary tabular-nums">{tasks.length}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            <AddTaskToggle
              users={users}
              defaultBookSubsectionIds={[subsectionId]}
              buttonLabel="+ Task"
              showType={false}
            />
          )}
          <a href="/tasks" className="text-[10px] text-moss-700 hover:underline">
            Manage →
          </a>
        </div>
      </header>
      {tasks.length === 0 ? (
        <p className="px-4 py-2 text-xs text-ink-tertiary italic">No linked tasks yet.</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {tasks.map((t) => (
            <CardInlineTaskRow key={t.id} task={t} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </section>
  );
}
