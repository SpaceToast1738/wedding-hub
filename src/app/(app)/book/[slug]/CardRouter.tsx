"use client";

import { BookBarCard } from "./BookBarCard";
import { BookBuildCard } from "./BookBuildCard";
import { BookFieldsCard } from "./BookFieldsCard";
import { BookLodgingCard } from "./BookLodgingCard";
import { BookMenuCard } from "./BookMenuCard";
import { BookOutfitCardEditor } from "./BookOutfitCard";
import { BookRecipeCard } from "./BookRecipeCard";
import { BookSetupCard } from "./BookSetupCard";
import { BookShotListCard } from "./BookShotListCard";
import { BookStayCard } from "./BookStayCard";
import { BookDressCodeCard } from "./BookDressCodeCard";
import { BookWeddingPartyCard } from "./BookWeddingPartyCard";
import { SubsectionEditor } from "./SubsectionEditor";
import { SummarizeCardButton } from "@/app/(app)/ai/SummarizeCardButton";
import type { GalleryDisplay, GallerySize, HeaderPosition } from "@/components/ui/ImageGallery";
import type { UserOpt } from "@/app/(app)/tasks/AddTaskToggle";

// v1.99.4: shared narrowing helpers — server returns these gallery
// columns as plain strings; the typed unions live in the ImageGallery
// module. Each helper falls through to a safe default for unexpected
// values (defensive against rogue DB values or pre-migration rows).
function narrowSize(v: string): GallerySize {
  return v === "xs" || v === "sm" || v === "lg" || v === "xl" ? v : "md";
}
function narrowDisplay(v: string): GalleryDisplay {
  return v === "slideshow" || v === "mosaic" ? v : "gallery";
}
function narrowHeaderPosition(v: string): HeaderPosition {
  return v === "tl" || v === "t" || v === "tr" ||
         v === "l"  || v === "r" ||
         v === "bl" || v === "b" || v === "br"
    ? v
    : "c";
}
// v1.92.0: re-export so existing imports (`import { LinkedTaskRow }
// from "./CardRouter"`) continue to compile; the canonical location
// is now CardLinkedTasksPanel.tsx.
export type { LinkedTaskRow } from "./CardLinkedTasksPanel";
import { CardLinkedTasksPanel } from "./CardLinkedTasksPanel";
import type { LinkedTaskRow } from "./CardLinkedTasksPanel";

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
  // v1.96.1: photo gallery on TEXT cards. Lives directly on
  // BookSubsection (sibling to body / bodyHtml); ignored for non-
  // TEXT kinds which use their own per-kind fileIds columns.
  fileIds: string[];
  // v1.96.4: per-card photo gallery size. Persisted on
  // BookSubsection.photoSize; default 'md' from the schema.
  photoSize: string;
  // v1.97.0 / v1.99.4: photo body-section mode (gallery / slideshow /
  // mosaic — "header" dropped, header is additive via headerFileId)
  // and mode-specific knobs. Live on BookSubsection alongside
  // fileIds / photoSize / wide.
  photoDisplay: string;
  headerFileId: string | null;
  // v1.99.4: 9-point hero positioning (tl|t|tr|l|c|r|bl|b|br).
  headerPosition: string;
  slideshowAuto: boolean;
  // v1.99.0: per-card body layout — order of component IDs +
  // hidden-component IDs. Empty arrays = use the kind's default.
  componentOrder: string[];
  hiddenComponents: string[];
  fields: unknown;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  kind: "TEXT" | "FIELD" | "RECIPE" | "SHOT_LIST" | "OUTFIT" | "BUILD" | "MENU" | "BAR" | "SETUP" | "STAY" | "LODGING_GUIDE" | "DRESS_CODE" | "WEDDING_PARTY";
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
  // v1.35.0: OUTFIT rework — card-level fields hold person identity
  // + cost; items hold lifecycle + per-item Payment reciprocal.
  // v1.93.0: dropped fittingDate / alterationsDueBy / pickupDate /
  // paid / paidBy (dates → Tasks; paid tracking → Payment.bookOutfitId).
  // alreadyOwned boolean dropped — folded into the item's status enum.
  outfitCard: {
    id: string;
    personName: string | null;
    role: string | null;
    costPence: number | null;
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
      // v1.93.1: optional per-item cost in pence.
      costPence: number | null;
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
  // v1.91.0: DRESS_CODE card eager-loaded data.
  dressCodeCard: {
    id: string;
    dressCode: string | null;
    summary: string | null;
    bodyHtml: string | null;
    colourGuidance: string | null;
    footwear: string | null;
    weather: string | null;
    accessories: string | null;
    fileIds: string[];
    files: Array<{ id: string; name: string; mimeType: string }>;
  } | null;
  // v1.92.0: WEDDING_PARTY card eager-loaded data — members + items
  // + sparse cells.
  weddingPartyCard: {
    id: string;
    groupLabel: string | null;
    notes: string | null;
    members: Array<{ id: string; name: string; role: string | null; order: number }>;
    items: Array<{ id: string; label: string; notes: string | null; order: number }>;
    cells: Array<{ memberId: string; itemId: string; status: string; notes: string | null }>;
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

// v1.92.0: LinkedTaskRow is re-exported above from
// CardLinkedTasksPanel.tsx (lifted in v1.92.0 so each editor can
// render the panel inside its own <article>).

export function CardRouter({
  sub,
  canEdit,
  isCouple,
  showMoney = true,
  budgetCategories = [],
  linkedTasks = [],
  users = [],
  files = [],
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
  /** v1.96.1: full file list — fuels the TEXT-card photo picker.
   *  Other kinds embed their files into the per-kind sub data
   *  (sub.outfitCard.files / sub.dressCodeCard.files / …) and
   *  don't need this top-level list. */
  files?: Array<{ id: string; name: string; mimeType: string }>;
}) {
  // v1.92.0: the four kinds the user is actively iterating on (TEXT,
  // OUTFIT, DRESS_CODE, WEDDING_PARTY) render the linked-tasks panel
  // inline inside their own <article> via CardChrome / direct
  // include. The remaining 10 kinds continue to render it as a
  // sibling below the body (the v1.51.0 default) until they're each
  // migrated to inline in a follow-up release.
  const inlineKinds = new Set([
    "TEXT", "OUTFIT", "DRESS_CODE", "WEDDING_PARTY",
    // v1.92.0: FIELD + RECIPE editors already forward props to
    // CardChrome (which renders the panel inline). Adding them here
    // suppresses the duplicate sibling render.
    "FIELD", "RECIPE",
  ]);
  const body = renderCardBody(sub, canEdit, isCouple, showMoney, budgetCategories, linkedTasks, users, files);
  if (inlineKinds.has(sub.kind)) return body;
  return (
    <>
      {body}
      {(linkedTasks.length > 0 || canEdit) && (
        <SiblingLinkedTasksPanel tasks={linkedTasks} subsectionId={sub.id} canEdit={canEdit} users={users} />
      )}
    </>
  );
}

// v1.92.0: thin wrapper around CardLinkedTasksPanel for the 10 kinds
// that haven't been migrated to inline rendering. Wraps with the
// "appended below" v1.51.0 styling so untouched cards don't regress.
function SiblingLinkedTasksPanel(props: {
  tasks: LinkedTaskRow[];
  subsectionId: string;
  canEdit: boolean;
  users: UserOpt[];
}) {
  return (
    <div className="-mt-2 px-4">
      <CardLinkedTasksPanel {...props} />
    </div>
  );
}

function renderCardBody(
  sub: Sub,
  canEdit: boolean,
  isCouple: boolean,
  showMoney: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  budgetCategories: Array<{ id: string; name: string }>,
  linkedTasks: LinkedTaskRow[],
  users: UserOpt[],
  // v1.96.1: full file list for the TEXT-card photo picker. Other
  // kinds embed their files into their per-kind sub data; this
  // top-level param is TEXT-specific.
  files: Array<{ id: string; name: string; mimeType: string }>,
) {
  // v1.78.0: budgetCategories is loaded by the page and passed
  // through here for the per-card "Link to budget" pickers (MENU /
  // BAR / OUTFIT / STAY). The UI for those pickers ships in v1.78.1
  // — the data layer + auto-resync server actions are in this
  // release so existing links keep updating.
  switch (sub.kind) {
    case "TEXT":
      return (
        <>
          <SubsectionEditor
            sub={{
              id: sub.id,
              slug: sub.slug,
              title: sub.title,
              body: sub.body,
              bodyHtml: sub.bodyHtml,
              visibility: sub.visibility,
              // v1.96.1: TEXT card photo gallery.
              fileIds: sub.fileIds,
              // v1.96.5: gallery thumb size lives on BookSubsection
              // (the v1.96.4 column). Narrow the DB string to the
              // GallerySize union with a defensive 'md' fallback —
              // matches the OUTFIT case below.
              // v1.98.1: union widened to xs / sm / md / lg / xl.
              photoSize: narrowSize(sub.photoSize),
              // v1.97.0 / v1.99.4: body mode (gallery/slideshow/mosaic)
              // + hero pin + 9-point hero position + slideshow auto.
              photoDisplay: narrowDisplay(sub.photoDisplay),
              headerFileId: sub.headerFileId,
              headerPosition: narrowHeaderPosition(sub.headerPosition),
              slideshowAuto: sub.slideshowAuto,
              // v1.99.0: per-card body layout.
              componentOrder: sub.componentOrder,
              hiddenComponents: sub.hiddenComponents,
            }}
            canEdit={canEdit}
            isCouple={isCouple}
            linkedTasks={linkedTasks}
            users={users}
            files={files}
          />
          {canEdit && (
            <SummarizeCardButton
              subsectionId={sub.id}
              hasContent={Boolean(sub.bodyHtml || sub.body)}
            />
          )}
        </>
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
          linkedTasks={linkedTasks}
          users={users}
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
          linkedTasks={linkedTasks}
          users={users}
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
        costPence: null,
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
            costPence: oc.costPence,
            fileIds: oc.fileIds,
            notes: oc.notes,
            items: oc.items,
            // v1.96.4 / v1.99.4: gallery props live on BookSubsection
            // (sibling to wide / fileIds). Narrow via the v1.99.4
            // shared helpers defined at the top of this module.
            photoSize: narrowSize(sub.photoSize),
            photoDisplay: narrowDisplay(sub.photoDisplay),
            headerFileId: sub.headerFileId,
            headerPosition: narrowHeaderPosition(sub.headerPosition),
            slideshowAuto: sub.slideshowAuto,
            // v1.99.0: per-card body layout.
            componentOrder: sub.componentOrder,
            hiddenComponents: sub.hiddenComponents,
          }}
          files={oc.files}
          linkedTasks={linkedTasks}
          users={users}
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
            // v1.99.1: per-card body layout.
            componentOrder: sub.componentOrder,
            hiddenComponents: sub.hiddenComponents,
            // v1.99.4: gallery props — full v1.97.0 + v1.99.4 surface.
            photoSize: narrowSize(sub.photoSize),
            photoDisplay: narrowDisplay(sub.photoDisplay),
            headerFileId: sub.headerFileId,
            headerPosition: narrowHeaderPosition(sub.headerPosition),
            slideshowAuto: sub.slideshowAuto,
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
          // v1.99.4: gallery props threaded through alongside the
          // build-card payload. `bc` is spread + augmented so its
          // existing fields (materials / sessions / fileIds / files /
          // budgetLine) pass through unchanged.
          card={{
            ...bc,
            photoSize: narrowSize(sub.photoSize),
            photoDisplay: narrowDisplay(sub.photoDisplay),
            headerFileId: sub.headerFileId,
            headerPosition: narrowHeaderPosition(sub.headerPosition),
            slideshowAuto: sub.slideshowAuto,
          }}
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
            // v1.99.4: gallery props.
            photoSize: narrowSize(sub.photoSize),
            photoDisplay: narrowDisplay(sub.photoDisplay),
            headerFileId: sub.headerFileId,
            headerPosition: narrowHeaderPosition(sub.headerPosition),
            slideshowAuto: sub.slideshowAuto,
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
    case "WEDDING_PARTY": {
      // v1.92.0: matrix tracker. Defensive default if the per-kind
      // row hasn't been seeded (shouldn't happen — createBookSubsection
      // seeds it — but matches every other branch's fallback shape).
      const wp = sub.weddingPartyCard ?? {
        id: "",
        groupLabel: null,
        notes: null,
        members: [],
        items: [],
        cells: [],
      };
      return (
        <BookWeddingPartyCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          visibility={sub.visibility}
          canEdit={canEdit}
          isCouple={isCouple}
          card={{
            id: wp.id,
            groupLabel: wp.groupLabel,
            notes: wp.notes,
            members: wp.members,
            items: wp.items,
            // Cast Cell.status from string → the four-value union the
            // editor expects. Server-side `setWeddingPartyCell`
            // restricts to the same 4 values via Zod.
            cells: wp.cells.map((c) => ({
              memberId: c.memberId,
              itemId: c.itemId,
              status: c.status as "NEED" | "HAVE" | "ALREADY_OWN" | "N_A",
              notes: c.notes,
            })),
            // v1.99.1: per-card body layout.
            componentOrder: sub.componentOrder,
            hiddenComponents: sub.hiddenComponents,
          }}
          linkedTasks={linkedTasks}
          users={users}
        />
      );
    }
    case "DRESS_CODE": {
      // v1.91.0: couple-internal dress-code reference card. Defensive
      // defaults when the per-kind row hasn't been seeded (shouldn't
      // happen — createBookSubsection seeds it — but consistent with
      // every other branch's fallback shape).
      const dc = sub.dressCodeCard ?? {
        id: "",
        dressCode: null,
        summary: null,
        bodyHtml: null,
        colourGuidance: null,
        footwear: null,
        weather: null,
        accessories: null,
        fileIds: [],
        files: [],
      };
      return (
        <BookDressCodeCard
          subsectionId={sub.id}
          slug={sub.slug}
          title={sub.title}
          visibility={sub.visibility}
          canEdit={canEdit}
          card={{
            id: dc.id,
            dressCode: dc.dressCode,
            summary: dc.summary,
            bodyHtml: dc.bodyHtml,
            colourGuidance: dc.colourGuidance,
            footwear: dc.footwear,
            weather: dc.weather,
            accessories: dc.accessories,
            fileIds: dc.fileIds,
            // v1.99.4: gallery props.
            photoSize: narrowSize(sub.photoSize),
            photoDisplay: narrowDisplay(sub.photoDisplay),
            headerFileId: sub.headerFileId,
            headerPosition: narrowHeaderPosition(sub.headerPosition),
            slideshowAuto: sub.slideshowAuto,
          }}
          files={dc.files}
          linkedTasks={linkedTasks}
          users={users}
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

// v1.92.0: CardLinkedTasksPanel + CardInlineTaskRow lifted into
// CardLinkedTasksPanel.tsx so multiple editors can render the
// inline panel within their own <article>.
