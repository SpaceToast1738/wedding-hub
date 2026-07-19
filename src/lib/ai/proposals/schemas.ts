// v2.1.0 phase 2: proposal payload schemas.
//
// A single source of truth for what a proposal of each kind must
// look like. Used by (a) the propose_* tools when the AI creates a
// proposal — validated before the AiProposal row is written; and
// (b) applyProposal when the human clicks Apply — re-validated so a
// tampered payload can never sneak into createTask / createEvent.
//
// Keep the shapes small and forgiving. The AI often omits optional
// fields; the apply-time defaults live here.

import { z } from "zod";

export const PROPOSAL_KINDS = [
  "task.create",
  "task.update",
  "event.create",
  "event.update",
  "guest.create",
  "guest.update",
  "guest.set_rsvp",
  "guest.archive",
  "household.update",
  "book.card.append",
  "book.card.replace_text",
  "book.card.rename",
  "book.card.create",
  "book.section.create",
  "book.field.set",
  "book.recipe.update",
  "book.shot.add",
  "book.shot.update",
  "book.outfit.update",
  "book.build.update",
  "book.menu.update",
  "book.bar.update",
  "book.setup.update",
  "book.stay.update",
  "book.lodging.update",
  "book.dresscode.update",
  "book.weddingparty.set_cell",
  "book.weddingparty.add_member",
  "book.weddingparty.add_item",
  "book.weddingparty.update_header",
  "supplier.create",
  "supplier.update",
  "supplier.log_communication",
  "supplier.contact.add",
  "budget.category.create",
  "budget.line.create",
  "budget.line.update",
  "payment.create",
  "payment.update",
  "payment.set_status",
  "question.answer",
  "song.add",
  "custom_field.set",
  "seat.assign",
  // v2.8.0: destructive kinds — see the "destructive kinds" section
  // below for the shared payload conventions.
  "task.delete",
  "event.delete",
  "guest.hard_delete",
  "supplier.delete",
  "supplier.contact_remove",
  "payment.delete",
  "budget.line.delete",
  "budget.category.delete",
  "book.card.delete",
  "book.section.delete",
  "song.remove",
  "seating.table.delete",
  // v2.8.1 (Tier 2): additive write kinds. guest.move_household, the
  // seat/table editors, song-request assignment, supplier contract
  // records, and budget-line components. No migrations, no deletes.
  "guest.move_household",
  "seat.unassign",
  "seat.swap",
  "seating.table.create",
  "seating.table.update",
  "song_request.assign",
  "supplier.contract_update",
  "budget.component_create",
  "budget.component_update",
] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

// Kept separate from Prisma's enum re-exports so this module has zero
// Prisma dependency (every schema here re-declares its enum values as
// string const arrays; a drift test would catch a rename upstream).
export const SUPPLIER_STATUSES = [
  "SHORTLIST",
  "CONTACTED",
  "QUOTED",
  "BOOKED",
  "PAID",
  "REJECTED",
] as const;

export const SIDES = ["BRIDE", "GROOM", "BOTH"] as const;
export const RSVP_STATUSES = ["PENDING", "ATTENDING", "DECLINED", "MAYBE"] as const;
export const PAYMENT_STATUSES = ["DUE", "SCHEDULED", "PAID", "OVERDUE", "CANCELLED"] as const;
export const FUND_SOURCES = ["JOINT", "PERSONAL_BRIDE", "PERSONAL_GROOM", "OTHER"] as const;
export const PER_HEAD_SOURCES = [
  "ALL_INVITED",
  "CONFIRMED_PLUS_PENDING",
  "ALL_CONFIRMED",
  "ADULTS_CONFIRMED",
  "CHILDREN_CONFIRMED",
  "ADULTS_PENDING_OR_CONFIRMED",
  "CHILDREN_PENDING_OR_CONFIRMED",
  "MANUAL",
] as const;
export const BOOK_KINDS = [
  "TEXT",
  "FIELD",
  "RECIPE",
  "SHOT_LIST",
  "OUTFIT",
  "BUILD",
  "MENU",
  "BAR",
  "SETUP",
  "STAY",
  "LODGING_GUIDE",
  "DRESS_CODE",
  "WEDDING_PARTY",
] as const;
/** WeddingParty cell statuses — free strings in the DB, but the app's
 *  editor only ever writes these five (VALID_CELL_STATUSES in
 *  book/actions.ts). */
export const WP_CELL_STATUSES = ["NEED", "ORDERED", "HAVE", "ALREADY_OWN", "N_A"] as const;
/** Outfit item statuses — free strings in the DB; these four are what
 *  the editor's select offers. */
export const OUTFIT_ITEM_STATUSES = ["Planned", "Purchased", "Received", "Already own"] as const;
/** Build card statuses — free strings in the DB; editor vocabulary. */
export const BUILD_STATUSES = ["Designing", "Prototyping", "Producing", "Done"] as const;

export const taskCreateSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["TASK", "QUESTION", "DECISION"]).default("TASK"),
  status: z
    .enum(["OPEN", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"])
    .default("OPEN"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z
    .string()
    .optional()
    .nullable()
    .describe("ISO 8601 date (YYYY-MM-DD) or datetime."),
  notes: z.string().max(2000).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).default([]),
  bookSectionIds: z.array(z.string()).default([]),
  // v2.4.0: card-level links, mainly so breakdown subtasks can inherit
  // the parent's bookSubsection links. createTask's parseTopicKeys
  // already understands the bookSubsection: prefix.
  bookSubsectionIds: z.array(z.string()).default([]),
  navTagIds: z.array(z.string()).default([]),
  guestGroupIds: z.array(z.string()).default([]),
});

export type TaskCreatePayload = z.infer<typeof taskCreateSchema>;

export const eventCreateSchema = z.object({
  title: z.string().min(1).max(200),
  /** ISO 8601 datetime — the wall-clock start of the event. If
   *  `allDay` is true, this is normalised to midnight before write. */
  startTime: z.string().min(1),
  endTime: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  allDay: z.boolean().default(false),
  /** Refs like "user:<id>" / "builtin:<slug>" / "group:<slug>".
   *  The AI usually leaves this empty; the couple picks who's on the
   *  event via the review UI. */
  attendeeRefs: z.array(z.string()).default([]),
});

export type EventCreatePayload = z.infer<typeof eventCreateSchema>;

/** Patch shape for updating an existing task. All fields optional —
 *  Apply only writes what's set. `taskId` is required so we know
 *  which row to update.
 *
 *  v2.2.0: assignee + topic changes use ADD/REMOVE delta semantics
 *  rather than full-set replacement. The underlying updateTask action
 *  REPLACES all four topic relations as a unit whenever any topicKeys
 *  field is posted — so the Apply bridge merges these deltas with the
 *  task's CURRENT relations (see src/lib/ai/proposals/merge-task-update.ts)
 *  and posts the full merged set. Deltas survive concurrent human
 *  edits between propose-time and apply-time; full sets wouldn't. */
export const taskUpdateSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  status: z
    .enum(["OPEN", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  /** v2.4.3: link/unlink the task's supplier. undefined = untouched
   *  (updateTask only writes supplierId when the field is posted),
   *  null = unlink, id = link. */
  supplierId: z.string().optional().nullable(),
  addAssigneeIds: z.array(z.string()).max(10).optional(),
  removeAssigneeIds: z.array(z.string()).max(10).optional(),
  addNavTagIds: z.array(z.string()).max(5).optional(),
  removeNavTagIds: z.array(z.string()).max(5).optional(),
  addBookSectionIds: z.array(z.string()).max(5).optional(),
  removeBookSectionIds: z.array(z.string()).max(5).optional(),
  // v2.6.2: card-level links — the AI couldn't link/unlink a task to a
  // specific Wedding Book card (only whole sections), even though
  // taskCreateSchema and both apply bridges already supported it.
  addBookSubsectionIds: z.array(z.string()).max(5).optional(),
  removeBookSubsectionIds: z.array(z.string()).max(5).optional(),
  addGuestGroupIds: z.array(z.string()).max(5).optional(),
  removeGuestGroupIds: z.array(z.string()).max(5).optional(),
});
export type TaskUpdatePayload = z.infer<typeof taskUpdateSchema>;

export const guestCreateSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  /** If no matching household exists, applyProposal creates one with
   *  this name. Falls back to `${lastName} household`. */
  householdName: z.string().max(200).optional().nullable(),
  side: z.enum(["BRIDE", "GROOM", "BOTH"]).default("BOTH"),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  isChild: z.boolean().default(false),
  plusOneAllowed: z.boolean().default(false),
  plusOneName: z.string().max(200).optional().nullable(),
  dietary: z.string().max(500).optional().nullable(),
  role: z.string().max(80).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type GuestCreatePayload = z.infer<typeof guestCreateSchema>;

/** Append text to a TEXT card. The AI writes a summary or a "notes
 *  section"; applyProposal wraps it in a heading + paragraph and
 *  appends it to the existing bodyHtml. */
export const bookCardAppendSchema = z.object({
  subsectionId: z.string().min(1),
  heading: z.string().min(1).max(120).default("Summary"),
  text: z.string().min(1).max(4000),
});
export type BookCardAppendPayload = z.infer<typeof bookCardAppendSchema>;

/** New supplier/vendor. Deliberately excludes `amountAgreed` — that's
 *  a money field, and no read tool surfaces existing amounts to the
 *  AI either (read_suppliers omits it). Keeping write parity with
 *  read visibility rather than opening a new money-write surface. */
export const supplierCreateSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  status: z.enum(SUPPLIER_STATUSES).default("SHORTLIST"),
  website: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});
export type SupplierCreatePayload = z.infer<typeof supplierCreateSchema>;

/** Partial patch to an existing supplier. All fields but `supplierId`
 *  are optional — Apply only writes what's set, merging against the
 *  supplier's current row (see supplierUpdatePayloadToFormData in
 *  src/app/(app)/ai/actions.ts) because updateSupplier's own Zod
 *  schema requires the full record on every call. */
export const supplierUpdateSchema = z.object({
  supplierId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(100).optional(),
  status: z.enum(SUPPLIER_STATUSES).optional(),
  website: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});
export type SupplierUpdatePayload = z.infer<typeof supplierUpdateSchema>;

/** Add a named contact person to a supplier. `primary: true` also
 *  unmarks any existing primary contact — createSupplierContact does
 *  that swap in one transaction, same as the manual form. */
export const supplierContactAddSchema = z.object({
  supplierId: z.string().min(1),
  name: z.string().min(1).max(200),
  role: z.string().max(100).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  primary: z.boolean().default(false),
});
export type SupplierContactAddPayload = z.infer<typeof supplierContactAddSchema>;

/** Log a call/email/meeting with a supplier. Mirrors
 *  createSupplierCommunication's own schema; an optional followUpAt
 *  auto-creates a follow-up task via decideFollowUpTask() the same
 *  way a human logging it from the UI would. */
export const supplierCommunicationSchema = z.object({
  supplierId: z.string().min(1),
  channel: z.enum(["email", "call", "meeting", "message"]),
  summary: z.string().min(1).max(2000),
  followUpAt: z.string().optional().nullable(),
});
export type SupplierCommunicationPayload = z.infer<typeof supplierCommunicationSchema>;

// ─── v2.4.0: full-surface proposal payloads ─────────────────────────
//
// Conventions shared by every *.update kind below:
// - `undefined` (field omitted) = keep the current value. The apply
//   bridge loads the live row and carries current values for every
//   field the payload doesn't touch — the underlying human actions
//   mostly read `formData.get(x) || null`, where omission WIPES.
// - `null` = explicitly clear (only meaningful on nullable columns).
// - Child-row edits are DELTAS (add*/update*/remove*Ids). The bridge
//   reconstructs the COMPLETE child array from the live rows at apply
//   time, so rows the AI never named are always preserved — the
//   underlying save* actions delete any row missing from their input.
// - No money field (`*Pence`, amounts, paid flags, budget links) is
//   ever AI-writable on book/guest/task surfaces; bridges round-trip
//   current values byte-identical. Money changes go only through the
//   budget.*/payment.* kinds, whose apply path is couple-only via
//   requireEdit("budget"/"payments").

const nullable = <T extends z.ZodTypeAny>(t: T) => t.optional().nullable();
const cid = z.string().min(1).max(64);

// ── Book ──

export const bookSectionCreateSchema = z.object({
  title: z.string().min(1).max(120),
  subtitle: nullable(z.string().max(240)),
});
export type BookSectionCreatePayload = z.infer<typeof bookSectionCreateSchema>;

export const bookCardCreateSchema = z.object({
  sectionId: cid,
  title: z.string().min(1).max(120),
  kind: z.enum(BOOK_KINDS).default("TEXT"),
  /** TEXT cards only — propose tool rejects body on other kinds. */
  body: nullable(z.string().max(20000)),
});
export type BookCardCreatePayload = z.infer<typeof bookCardCreateSchema>;

export const bookCardRenameSchema = z.object({
  subsectionId: cid,
  title: z.string().min(1).max(120),
});
export type BookCardRenamePayload = z.infer<typeof bookCardRenameSchema>;

/** Whole-body overwrite of a TEXT card. The ONLY whole-content
 *  replacement kind, so it carries the only hard staleness fence:
 *  baseBodyHash is the sha256 of the bodyHtml the AI read via
 *  read_book_card; the bridge recomputes against the live row and
 *  refuses on mismatch ("re-read and re-propose"). */
export const bookCardReplaceTextSchema = z.object({
  subsectionId: cid,
  text: z.string().min(1).max(20000),
  baseBodyHash: z.string().min(1).max(128),
});
export type BookCardReplaceTextPayload = z.infer<typeof bookCardReplaceTextSchema>;

export const bookFieldSetSchema = z.object({
  subsectionId: cid,
  defId: cid,
  /** null clears the value (server rejects clearing required fields). */
  value: z.string().max(2000).nullable(),
  /** Display-only: the def's label, denormalised at propose time
   *  (verified against the real def) so the review card can say WHICH
   *  field changes. The apply bridge never posts it. */
  fieldName: z.string().max(120).optional(),
});
export type BookFieldSetPayload = z.infer<typeof bookFieldSetSchema>;

export const bookRecipeUpdateSchema = z.object({
  subsectionId: cid,
  /** Full replacement list for ingredients (simple strings — no ids
   *  to delta against). Omit to keep the current list. */
  setIngredients: z.array(z.string().min(1).max(500)).max(80).optional(),
  notes: nullable(z.string().max(4000)),
  servingsBase: nullable(z.number().int().min(1).max(1000)),
  addSteps: z
    .array(
      z.object({
        instruction: z.string().min(1).max(2000),
        durationMinutes: nullable(z.number().int().min(0).max(2880)),
        dayBefore: z.boolean().default(false),
      }),
    )
    .max(40)
    .optional(),
  updateSteps: z
    .array(
      z.object({
        stepId: cid,
        instruction: z.string().min(1).max(2000).optional(),
        durationMinutes: nullable(z.number().int().min(0).max(2880)),
        dayBefore: z.boolean().optional(),
      }),
    )
    .max(40)
    .optional(),
  removeStepIds: z.array(cid).max(40).optional(),
});
export type BookRecipeUpdatePayload = z.infer<typeof bookRecipeUpdateSchema>;

export const bookShotAddSchema = z.object({
  subsectionId: cid,
  title: z.string().min(1).max(200),
  category: nullable(z.string().max(60)),
  location: nullable(z.string().max(200)),
  notes: nullable(z.string().max(2000)),
  estimatedMinutes: nullable(z.number().int().min(0).max(600)),
  withWhom: z.array(z.string().max(120)).max(20).default([]),
});
export type BookShotAddPayload = z.infer<typeof bookShotAddSchema>;

export const bookShotUpdateSchema = z.object({
  shotId: cid,
  title: z.string().min(1).max(200).optional(),
  category: nullable(z.string().max(60)),
  location: nullable(z.string().max(200)),
  notes: nullable(z.string().max(2000)),
  estimatedMinutes: nullable(z.number().int().min(0).max(600)),
  captured: z.boolean().optional(),
});
export type BookShotUpdatePayload = z.infer<typeof bookShotUpdateSchema>;

const outfitItemFields = {
  description: nullable(z.string().max(2000)),
  supplier: nullable(z.string().max(120)),
  website: nullable(z.string().max(500)),
  status: nullable(z.enum(OUTFIT_ITEM_STATUSES)),
  notes: nullable(z.string().max(2000)),
};
export const bookOutfitUpdateSchema = z.object({
  subsectionId: cid,
  personName: nullable(z.string().max(120)),
  role: nullable(z.string().max(60)),
  notes: nullable(z.string().max(4000)),
  addItems: z
    .array(z.object({ itemLabel: z.string().min(1).max(160), ...outfitItemFields }))
    .max(20)
    .optional(),
  updateItems: z
    .array(
      z.object({
        itemId: cid,
        itemLabel: z.string().min(1).max(160).optional(),
        ...outfitItemFields,
      }),
    )
    .max(20)
    .optional(),
  removeItemIds: z.array(cid).max(20).optional(),
});
export type BookOutfitUpdatePayload = z.infer<typeof bookOutfitUpdateSchema>;

const buildMaterialFields = {
  quantity: nullable(z.number().min(0)),
  unit: nullable(z.string().max(40)),
  supplier: nullable(z.string().max(120)),
  website: nullable(z.string().max(500)),
  notes: nullable(z.string().max(2000)),
};
export const bookBuildUpdateSchema = z.object({
  subsectionId: cid,
  quantityNeeded: nullable(z.number().int().min(0)),
  targetDate: nullable(z.string().max(30)),
  status: nullable(z.enum(BUILD_STATUSES)),
  prototypeDone: z.boolean().optional(),
  prototypeNotes: nullable(z.string().max(2000)),
  estimatedMinutesPerUnit: nullable(z.number().int().min(0)),
  notes: nullable(z.string().max(4000)),
  addMaterials: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        ordered: z.boolean().default(false),
        arrived: z.boolean().default(false),
        ...buildMaterialFields,
      }),
    )
    .max(30)
    .optional(),
  updateMaterials: z
    .array(
      z.object({
        materialId: cid,
        name: z.string().min(1).max(120).optional(),
        ordered: z.boolean().optional(),
        arrived: z.boolean().optional(),
        ...buildMaterialFields,
      }),
    )
    .max(30)
    .optional(),
  removeMaterialIds: z.array(cid).max(30).optional(),
});
export type BookBuildUpdatePayload = z.infer<typeof bookBuildUpdateSchema>;

const menuOptionFields = {
  description: nullable(z.string().max(2000)),
  dietary: z.array(z.string().max(40)).max(10).optional(),
  isVegetarianMain: z.boolean().optional(),
  isKidsMeal: z.boolean().optional(),
};
/** Menu deltas. NO removeCourseIds — deleting a course cascades all
 *  its options; that stays a human-only action in the editor. */
export const bookMenuUpdateSchema = z.object({
  subsectionId: cid,
  serviceType: nullable(z.string().max(60)),
  serviceTime: nullable(z.string().max(60)),
  notes: nullable(z.string().max(4000)),
  addCourses: z.array(z.object({ courseLabel: z.string().min(1).max(60) })).max(6).optional(),
  renameCourses: z
    .array(z.object({ courseId: cid, courseLabel: z.string().min(1).max(60) }))
    .max(6)
    .optional(),
  addOptions: z
    .array(
      z.object({
        courseId: cid,
        label: z.string().min(1).max(160),
        ...menuOptionFields,
      }),
    )
    .max(20)
    .optional(),
  updateOptions: z
    .array(
      z.object({
        optionId: cid,
        label: z.string().min(1).max(160).optional(),
        ...menuOptionFields,
      }),
    )
    .max(20)
    .optional(),
  removeOptionIds: z.array(cid).max(20).optional(),
});
export type BookMenuUpdatePayload = z.infer<typeof bookMenuUpdateSchema>;

const barItemFields = {
  quantityPlanned: nullable(z.number().min(0)),
  unit: nullable(z.string().max(40)),
  supplier: nullable(z.string().max(120)),
  website: nullable(z.string().max(500)),
  timing: nullable(z.string().max(60)),
  notes: nullable(z.string().max(2000)),
};
export const bookBarUpdateSchema = z.object({
  subsectionId: cid,
  barType: nullable(z.string().max(60)),
  toastDrink: nullable(z.string().max(60)),
  notes: nullable(z.string().max(4000)),
  addItems: z
    .array(
      z.object({
        category: z.string().min(1).max(60),
        name: z.string().min(1).max(160),
        ...barItemFields,
      }),
    )
    .max(30)
    .optional(),
  updateItems: z
    .array(
      z.object({
        itemId: cid,
        category: z.string().min(1).max(60).optional(),
        name: z.string().min(1).max(160).optional(),
        ...barItemFields,
      }),
    )
    .max(30)
    .optional(),
  removeItemIds: z.array(cid).max(30).optional(),
});
export type BookBarUpdatePayload = z.infer<typeof bookBarUpdateSchema>;

const setupItemFields = {
  // int to match saveSetupCard's own zod.
  quantity: nullable(z.number().int().min(0)),
  location: nullable(z.string().max(160)),
  source: nullable(z.string().max(120)),
  website: nullable(z.string().max(500)),
  packDownPlan: nullable(z.string().max(2000)),
  notes: nullable(z.string().max(2000)),
};
export const bookSetupUpdateSchema = z.object({
  subsectionId: cid,
  space: nullable(z.string().max(120)),
  setupStartsAt: nullable(z.string().max(60)),
  setupOwner: nullable(z.string().max(120)),
  notes: nullable(z.string().max(4000)),
  addItems: z
    .array(
      z.object({
        name: z.string().min(1).max(160),
        packed: z.boolean().default(false),
        placed: z.boolean().default(false),
        ...setupItemFields,
      }),
    )
    .max(40)
    .optional(),
  updateItems: z
    .array(
      z.object({
        itemId: cid,
        name: z.string().min(1).max(160).optional(),
        packed: z.boolean().optional(),
        placed: z.boolean().optional(),
        ...setupItemFields,
      }),
    )
    .max(40)
    .optional(),
  removeItemIds: z.array(cid).max(40).optional(),
});
export type BookSetupUpdatePayload = z.infer<typeof bookSetupUpdateSchema>;

export const bookStayUpdateSchema = z.object({
  subsectionId: cid,
  propertyName: nullable(z.string().max(160)),
  propertyContact: nullable(z.string().max(400)),
  bookingReference: nullable(z.string().max(120)),
  // Strict ISO dates — saveStayCard's parseISODate silently NULLS an
  // unparseable string instead of erroring, which would clear a date
  // while the proposal reads as applied.
  checkInDate: nullable(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")),
  checkOutDate: nullable(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")),
  addOccupants: z.array(z.string().min(1).max(120)).max(10).optional(),
  removeOccupants: z.array(z.string().min(1).max(120)).max(10).optional(),
  notes: nullable(z.string().max(4000)),
});
export type BookStayUpdatePayload = z.infer<typeof bookStayUpdateSchema>;

const lodgingItemFields = {
  distanceFromVenue: nullable(z.string().max(120)),
  priceRangeLabel: nullable(z.string().max(20)),
  // Caps match saveLodgingCard's own zod — a looser AI cap would mint
  // proposals that can never be applied.
  phone: nullable(z.string().max(40)),
  website: nullable(z.string().max(400)),
  groupRateCode: nullable(z.string().max(80)),
  notes: nullable(z.string().max(2000)),
};
export const bookLodgingUpdateSchema = z.object({
  subsectionId: cid,
  notes: nullable(z.string().max(4000)),
  addItems: z
    .array(z.object({ name: z.string().min(1).max(160), ...lodgingItemFields }))
    .max(30)
    .optional(),
  updateItems: z
    .array(
      z.object({
        itemId: cid,
        name: z.string().min(1).max(160).optional(),
        ...lodgingItemFields,
      }),
    )
    .max(30)
    .optional(),
  removeItemIds: z.array(cid).max(30).optional(),
});
export type BookLodgingUpdatePayload = z.infer<typeof bookLodgingUpdateSchema>;

export const bookDressCodeUpdateSchema = z.object({
  subsectionId: cid,
  dressCode: nullable(z.string().max(120)),
  summary: nullable(z.string().max(600)),
  /** Plain text — the bridge renders it to allowed-tag HTML the same
   *  way book.card.append does; the server re-sanitises anyway.
   *  16000 not 20000: HTML escaping + <p>/<br/> wrappers expand the
   *  text, and saveDressCodeCard caps bodyHtml at 20000 — a payload
   *  that passes here must still fit after expansion. */
  bodyText: nullable(z.string().max(16000)),
  colourGuidance: nullable(z.string().max(600)),
  footwear: nullable(z.string().max(600)),
  weather: nullable(z.string().max(600)),
  accessories: nullable(z.string().max(600)),
});
export type BookDressCodeUpdatePayload = z.infer<typeof bookDressCodeUpdateSchema>;

export const bookWpSetCellSchema = z.object({
  memberId: cid,
  itemId: cid,
  status: z.enum(WP_CELL_STATUSES),
  notes: nullable(z.string().max(2000)),
});
export type BookWpSetCellPayload = z.infer<typeof bookWpSetCellSchema>;

export const bookWpAddMemberSchema = z.object({
  subsectionId: cid,
  name: z.string().min(1).max(120),
  role: nullable(z.string().max(60)),
});
export type BookWpAddMemberPayload = z.infer<typeof bookWpAddMemberSchema>;

export const bookWpAddItemSchema = z.object({
  subsectionId: cid,
  label: z.string().min(1).max(160),
  notes: nullable(z.string().max(2000)),
});
export type BookWpAddItemPayload = z.infer<typeof bookWpAddItemSchema>;

export const bookWpUpdateHeaderSchema = z.object({
  subsectionId: cid,
  groupLabel: nullable(z.string().max(80)),
  notes: nullable(z.string().max(4000)),
});
export type BookWpUpdateHeaderPayload = z.infer<typeof bookWpUpdateHeaderSchema>;

// ── Guests + households ──

/** Partial guest patch. Deliberately excludes `rsvp` (guest.set_rsvp
 *  is the only RSVP path — it keeps `attending` in sync and cascades
 *  to the +1) and `householdId` (moving households is human-only). */
export const guestUpdateSchema = z.object({
  guestId: cid,
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: nullable(z.string().max(200)),
  phone: nullable(z.string().max(50)),
  side: z.enum(SIDES).optional(),
  isChild: z.boolean().optional(),
  needsHighchair: z.boolean().optional(),
  plusOneAllowed: z.boolean().optional(),
  plusOneName: nullable(z.string().max(200)),
  role: nullable(z.string().max(80)),
  dietary: nullable(z.string().max(500)),
  // v2.8.1: per-course meal choices. Nullable so the AI can clear one.
  // CRITICAL wipe hazard: the human createGuest/updateGuest FormData
  // path never posts these keys — updateGuestCore must write them ONLY
  // when defined, or a plain form save would blank an AI-set meal.
  // (Enforced in core/guests.ts — the AI apply path always defines
  // them via patch-or-current, the form path leaves them untouched.)
  mealStarter: nullable(z.string().max(200)),
  mealMain: nullable(z.string().max(200)),
  mealDessert: nullable(z.string().max(200)),
  notes: nullable(z.string().max(2000)),
});
export type GuestUpdatePayload = z.infer<typeof guestUpdateSchema>;

export const guestSetRsvpSchema = z.object({
  guestId: cid,
  rsvp: z.enum(RSVP_STATUSES),
});
export type GuestSetRsvpPayload = z.infer<typeof guestSetRsvpSchema>;

/** Soft archive (reversible from the guest list). Frees their seat
 *  and archives their +1 in one transaction — same as the UI. */
export const guestArchiveSchema = z.object({ guestId: cid });
export type GuestArchivePayload = z.infer<typeof guestArchiveSchema>;

export const householdUpdateSchema = z.object({
  householdId: cid,
  name: z.string().min(1).max(200).optional(),
  side: z.enum(SIDES).optional(),
  notes: nullable(z.string().max(2000)),
});
export type HouseholdUpdatePayload = z.infer<typeof householdUpdateSchema>;

// ── Schedule ──

/** Partial event patch. Attendees are ADD/REMOVE deltas over the
 *  canonical attendeeRefs strings ("user:<id>" / "builtin:<slug>" /
 *  "group:<slug>") — updateScheduleEvent replaces the whole array, so
 *  the bridge merges deltas against the live row (with the legacy
 *  attendeeIds expansion for pre-v1.41 rows). endTime: null clears. */
export const eventUpdateSchema = z.object({
  eventId: cid,
  title: z.string().min(1).max(200).optional(),
  startTime: z.string().min(1).optional(),
  endTime: nullable(z.string()),
  location: nullable(z.string().max(200)),
  notes: nullable(z.string().max(2000)),
  allDay: z.boolean().optional(),
  // max(80) matches eventSchema's own per-ref cap in schedule/actions.ts
  // — a longer ref would pass propose-time and fail at apply.
  addAttendeeRefs: z.array(z.string().min(1).max(80)).max(15).optional(),
  removeAttendeeRefs: z.array(z.string().min(1).max(80)).max(15).optional(),
});
export type EventUpdatePayload = z.infer<typeof eventUpdateSchema>;

// ── Budget + payments (couple-only at apply via requireEdit) ──
//
// All money in payloads is INTEGER PENCE. Bridges format pound-strings
// ((p / 100).toFixed(2)) for the actions' parseAmount/parsePence, so
// the silent NaN→null parser path and the 100x-unit mistake are both
// unreachable.

export const budgetCategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
});
export type BudgetCategoryCreatePayload = z.infer<typeof budgetCategoryCreateSchema>;

const budgetLineFields = {
  estimatedPence: nullable(z.number().int().min(0).max(100_000_000)),
  supplierId: nullable(cid),
  notes: nullable(z.string().max(2000)),
  perHeadPence: nullable(z.number().int().min(0).max(100_000_000)),
  headcountSource: nullable(z.enum(PER_HEAD_SOURCES)),
  manualHeadcount: nullable(z.number().int().min(0).max(10_000)),
  minimumHeadcount: nullable(z.number().int().min(0).max(10_000)),
  fundSource: nullable(z.enum(FUND_SOURCES)),
  fundLabel: nullable(z.string().max(120)),
};
export const budgetLineCreateSchema = z.object({
  categoryId: cid,
  description: z.string().min(1).max(200),
  ...budgetLineFields,
});
export type BudgetLineCreatePayload = z.infer<typeof budgetLineCreateSchema>;

/** No categoryId — a wrong category silently relocates the line, so
 *  moves stay human-only. `actual`/`paid` are never in the payload:
 *  the bridge always carries the current values, so the AI can never
 *  pin or unpin the actual-override. */
export const budgetLineUpdateSchema = z.object({
  lineId: cid,
  description: z.string().min(1).max(200).optional(),
  ...budgetLineFields,
});
export type BudgetLineUpdatePayload = z.infer<typeof budgetLineUpdateSchema>;

const paymentFields = {
  dueDate: nullable(z.string().max(30)),
  method: nullable(z.string().max(100)),
  supplierId: nullable(cid),
  budgetLineId: nullable(cid),
  budgetLineComponentId: nullable(cid),
  fundSource: nullable(z.enum(FUND_SOURCES)),
  fundLabel: nullable(z.string().max(120)),
  notes: nullable(z.string().max(2000)),
};
export const paymentCreateSchema = z.object({
  description: z.string().min(1).max(200),
  amountPence: z.number().int().min(1).max(100_000_000),
  status: z.enum(PAYMENT_STATUSES).default("DUE"),
  ...paymentFields,
});
export type PaymentCreatePayload = z.infer<typeof paymentCreateSchema>;

export const paymentUpdateSchema = z.object({
  paymentId: cid,
  description: z.string().min(1).max(200).optional(),
  amountPence: z.number().int().min(1).max(100_000_000).optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  // v2.8.1: explicit paid-date override. A YYYY-MM-DD string sets it,
  // null clears it, undefined defers to the status-transition default
  // in the apply bridge (explicit date wins over the status default).
  // Deliberately NOT in the shared paymentFields (so paymentCreate
  // doesn't inherit it) — only update + set_status carry paidDate.
  paidDate: nullable(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")),
  ...paymentFields,
});
export type PaymentUpdatePayload = z.infer<typeof paymentUpdateSchema>;

/** Marking PAID stamps a paid date; moving off PAID clears it. The
 *  review card says so. v2.8.1: an optional explicit `paidDate` is
 *  recorded instead of today when marking PAID (null clears, undefined
 *  = default: today on PAID, cleared off PAID). */
export const paymentSetStatusSchema = z.object({
  paymentId: cid,
  status: z.enum(PAYMENT_STATUSES),
  paidDate: nullable(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")),
});
export type PaymentSetStatusPayload = z.infer<typeof paymentSetStatusSchema>;

// ── Long tail ──

/** min(1) is load-bearing: answerQuestion's empty branch would wipe
 *  the answer AND reopen the question. */
export const questionAnswerSchema = z.object({
  taskId: cid,
  answer: z.string().min(1).max(4000),
});
export type QuestionAnswerPayload = z.infer<typeof questionAnswerSchema>;

export const songAddSchema = z.object({
  playlistId: cid,
  title: z.string().min(1).max(200),
  artist: nullable(z.string().max(200)),
  source: nullable(z.string().max(100)),
});
export type SongAddPayload = z.infer<typeof songAddSchema>;

/** One kind, entity-discriminated. Clearing values is out of scope
 *  (min(1)) — null deletes the key, and that's a human call. */
export const customFieldSetSchema = z.object({
  entity: z.enum(["guest", "task", "supplier"]),
  targetId: cid,
  fieldId: cid,
  value: z.string().min(1).max(2000),
  /** Display-only: the field's name, denormalised at propose time so
   *  the review card names the field. The apply bridge ignores it. */
  fieldName: z.string().max(120).optional(),
});
export type CustomFieldSetPayload = z.infer<typeof customFieldSetSchema>;

/** Seat a guest. The propose tool refuses occupied seats outright and
 *  the bridge re-checks occupancy at apply — the underlying action's
 *  silent-eviction path is never reachable through the AI. */
export const seatAssignSchema = z.object({
  seatId: cid,
  guestId: cid,
});
export type SeatAssignPayload = z.infer<typeof seatAssignSchema>;

// ─── v2.8.0: destructive kinds ──────────────────────────────────────
//
// Deletes flow through the same propose→apply machinery as every
// other kind (Jamie's policy call, 2026-07-19) — no direct-delete
// tool exists. The apply handler snapshots the full entity JSON (and
// a cascade summary) into proposal.metadata.deletedSnapshot BEFORE
// deleting, so a bad delete is manually restorable. Conventions
// shared by all 12 payloads:
// - `targetLabel` is display-only: the entity's human name,
//   denormalised at propose time (same convention as book.field.set's
//   fieldName — verified against the real row when proposing) so the
//   review card and summary say WHAT gets deleted without a live
//   lookup. The apply handler never trusts it; it deletes by id only.
// - `reason` is display-only free text surfaced in the review UI
//   summary so the agent says WHY it wants the row gone.
// - Summaries (see summariseProposal) always say "permanent" and
//   "snapshot kept" — a queued delete must never read as routine.

const destructiveFields = {
  /** Display-only: the target's human name at propose time. */
  targetLabel: z.string().max(200).optional(),
  /** Display-only: why the agent wants this deleted. */
  reason: z.string().max(300).optional(),
};

export const taskDeleteSchema = z.object({ taskId: cid, ...destructiveFields });
export type TaskDeletePayload = z.infer<typeof taskDeleteSchema>;

export const eventDeleteSchema = z.object({ eventId: cid, ...destructiveFields });
export type EventDeletePayload = z.infer<typeof eventDeleteSchema>;

/** Hard delete — distinct from guest.archive (the reversible soft
 *  archive, which stays the default the propose tools should reach
 *  for). Cascade covers the guest's seat, RSVP and +1 linkage. */
export const guestHardDeleteSchema = z.object({ guestId: cid, ...destructiveFields });
export type GuestHardDeletePayload = z.infer<typeof guestHardDeleteSchema>;

export const supplierDeleteSchema = z.object({ supplierId: cid, ...destructiveFields });
export type SupplierDeletePayload = z.infer<typeof supplierDeleteSchema>;

export const supplierContactRemoveSchema = z.object({
  contactId: cid,
  ...destructiveFields,
});
export type SupplierContactRemovePayload = z.infer<typeof supplierContactRemoveSchema>;

export const paymentDeleteSchema = z.object({ paymentId: cid, ...destructiveFields });
export type PaymentDeletePayload = z.infer<typeof paymentDeleteSchema>;

export const budgetLineDeleteSchema = z.object({ lineId: cid, ...destructiveFields });
export type BudgetLineDeletePayload = z.infer<typeof budgetLineDeleteSchema>;

/** The apply handler refuses while the category still has lines —
 *  emptying it is a separate, visible set of budget.line.delete
 *  proposals, never an implicit cascade. */
export const budgetCategoryDeleteSchema = z.object({
  categoryId: cid,
  ...destructiveFields,
});
export type BudgetCategoryDeletePayload = z.infer<typeof budgetCategoryDeleteSchema>;

export const bookCardDeleteSchema = z.object({
  subsectionId: cid,
  ...destructiveFields,
});
export type BookCardDeletePayload = z.infer<typeof bookCardDeleteSchema>;

/** The apply handler refuses while the section still has cards —
 *  same no-implicit-cascade rule as budget.category.delete. */
export const bookSectionDeleteSchema = z.object({
  sectionId: cid,
  ...destructiveFields,
});
export type BookSectionDeletePayload = z.infer<typeof bookSectionDeleteSchema>;

export const songRemoveSchema = z.object({ songId: cid, ...destructiveFields });
export type SongRemovePayload = z.infer<typeof songRemoveSchema>;

/** Deleting a table never deletes guests — the apply handler unseats
 *  any occupants into "unseated" first, and the snapshot records who
 *  sat where so the arrangement is restorable. */
export const seatingTableDeleteSchema = z.object({
  tableId: cid,
  ...destructiveFields,
});
export type SeatingTableDeletePayload = z.infer<typeof seatingTableDeleteSchema>;

// ─── v2.8.1 (Tier 2): additive write kinds ──────────────────────────
//
// New, non-destructive write surfaces. All follow the same apply-time
// conventions as the v2.4.0 kinds above: `undefined` keeps the current
// value, `null` clears a nullable column, and no money field is
// AI-writable outside the budget.*/payment.* couple-only path. Pence
// values are written directly (no £-string round-trip).

/** Move a guest into a different household. Genuinely new — the guest
 *  form has no household picker, so no human mutator moves households.
 *  The apply path re-syncs the guest's +1 into the destination.
 *  `targetLabel` is display-only (the destination household's name at
 *  propose time) so the review card can name where the guest lands;
 *  apply moves by id only. */
export const guestMoveHouseholdSchema = z.object({
  guestId: cid,
  householdId: cid,
  targetLabel: z.string().max(200).optional(),
});
export type GuestMoveHouseholdPayload = z.infer<typeof guestMoveHouseholdSchema>;

/** Clear a seat — unseat whoever is sitting there. The propose tool
 *  refuses an already-empty seat; apply calls the core with a null
 *  guest. No third guest is ever displaced. */
export const seatUnassignSchema = z.object({
  seatId: cid,
});
export type SeatUnassignPayload = z.infer<typeof seatUnassignSchema>;

/** Swap the occupants of two seats at the SAME table. Both guests
 *  exchange places in one transaction — never evicts a bystander. The
 *  propose tool refuses cross-table, identical or both-empty pairs. */
export const seatSwapSchema = z.object({
  seatId1: cid,
  seatId2: cid,
});
export type SeatSwapPayload = z.infer<typeof seatSwapSchema>;

/** TableShape enum values re-declared as strings (this module keeps a
 *  zero-Prisma dependency; a drift test catches an upstream rename). */
export const TABLE_SHAPES = ["ROUND", "RECTANGLE", "HEAD"] as const;

/** Create a seating table with `capacity` empty seats. The grid
 *  position is auto-computed at apply time (nextGridPosition), so the
 *  payload never carries coordinates. Unlike seating.table.update,
 *  name + shape ARE here — you can't create a table without them. */
export const seatingTableCreateSchema = z.object({
  name: z.string().min(1).max(100),
  shape: z.enum(TABLE_SHAPES).default("ROUND"),
  capacity: z.number().int().min(1).max(40),
});
export type SeatingTableCreatePayload = z.infer<typeof seatingTableCreateSchema>;

/** Update a table's capacity, grid position or notes. Name and shape
 *  are intentionally absent — no clean human mutator exists for them
 *  yet (deferred). Shrinking capacity below the seated count is
 *  refused at apply (no silent eviction). posX/posY must be supplied
 *  together — a lone coordinate can't describe a move; rotation is an
 *  optional companion to a position change. */
export const seatingTableUpdateSchema = z
  .object({
    tableId: cid,
    capacity: z.number().int().min(1).max(40).optional(),
    posX: z.number().min(0).max(5000).optional(),
    posY: z.number().min(0).max(5000).optional(),
    rotation: z.number().min(-360).max(720).optional(),
    notes: nullable(z.string().max(2000)),
  })
  .refine((v) => (v.posX === undefined) === (v.posY === undefined), {
    message: "posX and posY must be provided together.",
    path: ["posX"],
  });
export type SeatingTableUpdatePayload = z.infer<typeof seatingTableUpdateSchema>;

/** Assign a pending guest song request to a playlist — claims the
 *  request and creates the corresponding song in one atomic
 *  transaction. The propose tool verifies the request is still
 *  unassigned and the target playlist isn't a block-list. */
export const songRequestAssignSchema = z.object({
  requestId: cid,
  playlistId: cid,
});
export type SongRequestAssignPayload = z.infer<typeof songRequestAssignSchema>;

/** Record a supplier contract. Deliberately carries NO amount — money
 *  stays off the AI write surface (read_suppliers only exposes a
 *  hasAmount flag), so the apply path always writes amount:null.
 *  `signedAt` defaults to now when `signed` is true and no date is
 *  given; an unknown `fileId` is dropped at apply (FK-safe). */
export const supplierContractUpdateSchema = z.object({
  supplierId: cid,
  signed: z.boolean().default(false),
  signedAt: nullable(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")),
  notes: nullable(z.string().max(2000)),
  fileId: nullable(cid),
});
export type SupplierContractUpdatePayload = z.infer<typeof supplierContractUpdateSchema>;

// Shared component fields — caps mirror budgetLineFields so an AI
// payload that validates here always survives the human componentSchema
// at apply (which is looser: min(0) with no upper bound). A component
// is flat OR per-head; the editor enforces exclusivity in the UI but
// the server keeps both nullable, so this schema does too.
const budgetComponentFields = {
  flatPence: nullable(z.number().int().min(0).max(100_000_000)),
  perHeadPence: nullable(z.number().int().min(0).max(100_000_000)),
  headcountSource: nullable(z.enum(PER_HEAD_SOURCES)),
  manualHeadcount: nullable(z.number().int().min(0).max(10_000)),
  minimumHeadcount: nullable(z.number().int().min(0).max(10_000)),
  notes: nullable(z.string().max(2000)),
  fundSource: nullable(z.enum(FUND_SOURCES)),
  fundLabel: nullable(z.string().max(120)),
};

/** Create a sub-cost component on a budget line. Pence values written
 *  directly. Couple-only at apply via requireSectionEdit("budget"). */
export const budgetComponentCreateSchema = z.object({
  lineId: cid,
  label: z.string().min(1).max(200),
  ...budgetComponentFields,
});
export type BudgetComponentCreatePayload = z.infer<typeof budgetComponentCreateSchema>;

/** Full-record update of a component. No `lineId` — a wrong line would
 *  silently relocate the component (same guard as budget.line.update's
 *  missing categoryId). The apply bridge loads the current row and
 *  carries every field the payload omits. */
export const budgetComponentUpdateSchema = z.object({
  componentId: cid,
  label: z.string().min(1).max(200).optional(),
  ...budgetComponentFields,
});
export type BudgetComponentUpdatePayload = z.infer<typeof budgetComponentUpdateSchema>;

export function schemaForKind(kind: string): z.ZodTypeAny | null {
  switch (kind) {
    case "task.create":
      return taskCreateSchema;
    case "task.update":
      return taskUpdateSchema;
    case "event.create":
      return eventCreateSchema;
    case "guest.create":
      return guestCreateSchema;
    case "book.card.append":
      return bookCardAppendSchema;
    case "supplier.create":
      return supplierCreateSchema;
    case "supplier.update":
      return supplierUpdateSchema;
    case "supplier.log_communication":
      return supplierCommunicationSchema;
    case "supplier.contact.add":
      return supplierContactAddSchema;
    case "event.update":
      return eventUpdateSchema;
    case "guest.update":
      return guestUpdateSchema;
    case "guest.set_rsvp":
      return guestSetRsvpSchema;
    case "guest.archive":
      return guestArchiveSchema;
    case "household.update":
      return householdUpdateSchema;
    case "book.card.replace_text":
      return bookCardReplaceTextSchema;
    case "book.card.rename":
      return bookCardRenameSchema;
    case "book.card.create":
      return bookCardCreateSchema;
    case "book.section.create":
      return bookSectionCreateSchema;
    case "book.field.set":
      return bookFieldSetSchema;
    case "book.recipe.update":
      return bookRecipeUpdateSchema;
    case "book.shot.add":
      return bookShotAddSchema;
    case "book.shot.update":
      return bookShotUpdateSchema;
    case "book.outfit.update":
      return bookOutfitUpdateSchema;
    case "book.build.update":
      return bookBuildUpdateSchema;
    case "book.menu.update":
      return bookMenuUpdateSchema;
    case "book.bar.update":
      return bookBarUpdateSchema;
    case "book.setup.update":
      return bookSetupUpdateSchema;
    case "book.stay.update":
      return bookStayUpdateSchema;
    case "book.lodging.update":
      return bookLodgingUpdateSchema;
    case "book.dresscode.update":
      return bookDressCodeUpdateSchema;
    case "book.weddingparty.set_cell":
      return bookWpSetCellSchema;
    case "book.weddingparty.add_member":
      return bookWpAddMemberSchema;
    case "book.weddingparty.add_item":
      return bookWpAddItemSchema;
    case "book.weddingparty.update_header":
      return bookWpUpdateHeaderSchema;
    case "budget.category.create":
      return budgetCategoryCreateSchema;
    case "budget.line.create":
      return budgetLineCreateSchema;
    case "budget.line.update":
      return budgetLineUpdateSchema;
    case "payment.create":
      return paymentCreateSchema;
    case "payment.update":
      return paymentUpdateSchema;
    case "payment.set_status":
      return paymentSetStatusSchema;
    case "question.answer":
      return questionAnswerSchema;
    case "song.add":
      return songAddSchema;
    case "custom_field.set":
      return customFieldSetSchema;
    case "seat.assign":
      return seatAssignSchema;
    case "task.delete":
      return taskDeleteSchema;
    case "event.delete":
      return eventDeleteSchema;
    case "guest.hard_delete":
      return guestHardDeleteSchema;
    case "supplier.delete":
      return supplierDeleteSchema;
    case "supplier.contact_remove":
      return supplierContactRemoveSchema;
    case "payment.delete":
      return paymentDeleteSchema;
    case "budget.line.delete":
      return budgetLineDeleteSchema;
    case "budget.category.delete":
      return budgetCategoryDeleteSchema;
    case "book.card.delete":
      return bookCardDeleteSchema;
    case "book.section.delete":
      return bookSectionDeleteSchema;
    case "song.remove":
      return songRemoveSchema;
    case "seating.table.delete":
      return seatingTableDeleteSchema;
    // v2.8.1
    case "guest.move_household":
      return guestMoveHouseholdSchema;
    case "seat.unassign":
      return seatUnassignSchema;
    case "seat.swap":
      return seatSwapSchema;
    case "seating.table.create":
      return seatingTableCreateSchema;
    case "seating.table.update":
      return seatingTableUpdateSchema;
    case "song_request.assign":
      return songRequestAssignSchema;
    case "supplier.contract_update":
      return supplierContractUpdateSchema;
    case "budget.component_create":
      return budgetComponentCreateSchema;
    case "budget.component_update":
      return budgetComponentUpdateSchema;
    default:
      return null;
  }
}

export function humanLabel(kind: ProposalKind): string {
  switch (kind) {
    case "task.create":
      return "New task";
    case "task.update":
      return "Update task";
    case "event.create":
      return "New schedule event";
    case "guest.create":
      return "New guest";
    case "book.card.append":
      return "Append to wedding book";
    case "supplier.create":
      return "New supplier";
    case "supplier.update":
      return "Update supplier";
    case "supplier.log_communication":
      return "Log supplier contact";
    case "supplier.contact.add":
      return "Add supplier contact";
    case "event.update":
      return "Update schedule event";
    case "guest.update":
      return "Update guest";
    case "guest.set_rsvp":
      return "Set RSVP";
    case "guest.archive":
      return "Archive guest";
    case "household.update":
      return "Update household";
    case "book.card.replace_text":
      return "Rewrite book card text";
    case "book.card.rename":
      return "Rename book card";
    case "book.card.create":
      return "New book card";
    case "book.section.create":
      return "New book section";
    case "book.field.set":
      return "Set book field";
    case "book.recipe.update":
      return "Update recipe card";
    case "book.shot.add":
      return "Add photo shot";
    case "book.shot.update":
      return "Update photo shot";
    case "book.outfit.update":
      return "Update outfit card";
    case "book.build.update":
      return "Update build card";
    case "book.menu.update":
      return "Update menu card";
    case "book.bar.update":
      return "Update bar card";
    case "book.setup.update":
      return "Update setup card";
    case "book.stay.update":
      return "Update stay card";
    case "book.lodging.update":
      return "Update lodging guide";
    case "book.dresscode.update":
      return "Update dress code card";
    case "book.weddingparty.set_cell":
      return "Set wedding-party status";
    case "book.weddingparty.add_member":
      return "Add wedding-party member";
    case "book.weddingparty.add_item":
      return "Add wedding-party item";
    case "book.weddingparty.update_header":
      return "Update wedding-party card";
    case "budget.category.create":
      return "New budget category";
    case "budget.line.create":
      return "New budget line";
    case "budget.line.update":
      return "Update budget line";
    case "payment.create":
      return "New payment";
    case "payment.update":
      return "Update payment";
    case "payment.set_status":
      return "Set payment status";
    case "question.answer":
      return "Answer question (marks it Done)";
    case "song.add":
      return "Add song";
    case "custom_field.set":
      return "Set custom field";
    case "seat.assign":
      return "Seat a guest";
    // v2.8.0: destructive kinds — every label leads with the
    // destructive verb so the kind badge alone flags the risk.
    case "task.delete":
      return "Delete task";
    case "event.delete":
      return "Delete schedule event";
    case "guest.hard_delete":
      return "Hard-delete guest";
    case "supplier.delete":
      return "Delete supplier";
    case "supplier.contact_remove":
      return "Remove supplier contact";
    case "payment.delete":
      return "Delete payment";
    case "budget.line.delete":
      return "Delete budget line";
    case "budget.category.delete":
      return "Delete budget category";
    case "book.card.delete":
      return "Delete book card";
    case "book.section.delete":
      return "Delete book section";
    case "song.remove":
      return "Remove song";
    case "seating.table.delete":
      return "Delete seating table";
    // v2.8.1
    case "guest.move_household":
      return "Move guest to household";
    case "seat.unassign":
      return "Unseat a guest";
    case "seat.swap":
      return "Swap two seats";
    case "seating.table.create":
      return "New seating table";
    case "seating.table.update":
      return "Update seating table";
    case "song_request.assign":
      return "Assign song request";
    case "supplier.contract_update":
      return "Record supplier contract";
    case "budget.component_create":
      return "New budget component";
    case "budget.component_update":
      return "Update budget component";
  }
}

/** One-line human summary of a proposal payload. Lives here (not in
 *  the "use server" actions file, which can't export sync helpers)
 *  so both the review dashboard and the read_proposals AI tool share
 *  one implementation. */
export function summariseProposal(kind: string, payload: unknown): string {
  const p = payload as Record<string, unknown>;
  if (kind === "task.create") {
    const title = typeof p.title === "string" ? p.title : "(untitled)";
    const priority = typeof p.priority === "string" ? p.priority : "MEDIUM";
    const due = typeof p.dueDate === "string" && p.dueDate ? ` · due ${p.dueDate}` : "";
    return `${title} (${priority})${due}`;
  }
  if (kind === "task.update") {
    const bits: string[] = [];
    if (typeof p.status === "string") bits.push(`status → ${p.status}`);
    if (typeof p.priority === "string") bits.push(`priority → ${p.priority}`);
    if (typeof p.dueDate === "string" && p.dueDate) bits.push(`due → ${p.dueDate}`);
    if (typeof p.title === "string") bits.push(`title → "${p.title}"`);
    if (p.supplierId === null) bits.push("unlinks supplier");
    else if (typeof p.supplierId === "string") bits.push("links supplier");
    const rel: string[] = [];
    for (const key of [
      "addAssigneeIds",
      "removeAssigneeIds",
      "addNavTagIds",
      "removeNavTagIds",
      "addBookSectionIds",
      "removeBookSectionIds",
      "addGuestGroupIds",
      "removeGuestGroupIds",
    ]) {
      const v = p[key];
      if (Array.isArray(v) && v.length) rel.push(`${key}: ${v.length}`);
    }
    if (rel.length) bits.push(rel.join(", "));
    return bits.join(", ") || "small tweak";
  }
  if (kind === "event.create") {
    const title = typeof p.title === "string" ? p.title : "(untitled)";
    const start = typeof p.startTime === "string" ? p.startTime : "";
    return `${title} · ${start.slice(0, 16)}`;
  }
  if (kind === "guest.create") {
    const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "(name pending)";
    const side = typeof p.side === "string" ? ` · ${p.side}` : "";
    return `${name}${side}`;
  }
  if (kind === "book.card.append") {
    const heading = typeof p.heading === "string" ? p.heading : "Summary";
    const text = typeof p.text === "string" ? p.text : "";
    return `${heading}: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}`;
  }
  if (kind === "supplier.create") {
    const name = typeof p.name === "string" ? p.name : "(unnamed)";
    const category = typeof p.category === "string" ? p.category : "";
    return category ? `${name} · ${category}` : name;
  }
  if (kind === "supplier.update") {
    const bits: string[] = [];
    if (typeof p.name === "string") bits.push(`name → "${p.name}"`);
    if (typeof p.category === "string") bits.push(`category → ${p.category}`);
    if (typeof p.status === "string") bits.push(`status → ${p.status}`);
    if (typeof p.website === "string") bits.push("website updated");
    if (typeof p.notes === "string") bits.push("notes updated");
    return bits.join(", ") || "small tweak";
  }
  if (kind === "supplier.contact.add") {
    const name = typeof p.name === "string" ? p.name : "(unnamed)";
    const role = typeof p.role === "string" && p.role ? ` (${p.role})` : "";
    const primary = p.primary ? " · PRIMARY — replaces the current primary contact" : "";
    return `${name}${role}${primary}`;
  }
  if (kind === "supplier.log_communication") {
    const channel = typeof p.channel === "string" ? p.channel : "contact";
    const summary = typeof p.summary === "string" ? p.summary : "";
    const followUp =
      typeof p.followUpAt === "string" && p.followUpAt ? ` · follow-up ${p.followUpAt}` : "";
    return `${channel}: ${summary.slice(0, 80)}${summary.length > 80 ? "…" : ""}${followUp}`;
  }

  // v2.4.0 kinds. Shared helpers keep the delta-kind summaries uniform:
  // header-field mentions + add/update/remove counts.
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  const clip = (v: unknown, n = 60): string => {
    const s = str(v) ?? "";
    return s.length > n ? `${s.slice(0, n)}…` : s;
  };
  const deltaBits = (labels: [string, string][]): string => {
    const bits: string[] = [];
    for (const [key, label] of labels) {
      const v = p[key];
      if (Array.isArray(v) && v.length) bits.push(`${label} ${v.length}`);
    }
    return bits.join(", ");
  };
  const headerBits = (keys: string[]): string => {
    const touched = keys.filter((k) => p[k] !== undefined);
    return touched.length ? `sets ${touched.join(", ")}` : "";
  };
  const joinBits = (...bits: string[]): string =>
    bits.filter(Boolean).join(" · ") || "small tweak";

  if (kind === "event.update") {
    return joinBits(
      headerBits(["title", "startTime", "endTime", "location", "notes", "allDay"]),
      deltaBits([
        ["addAttendeeRefs", "+attendees"],
        ["removeAttendeeRefs", "−attendees"],
      ]),
    );
  }
  if (kind === "guest.update") {
    return joinBits(
      headerBits([
        "firstName",
        "lastName",
        "email",
        "phone",
        "side",
        "isChild",
        "needsHighchair",
        "plusOneAllowed",
        "plusOneName",
        "role",
        "dietary",
        "mealStarter",
        "mealMain",
        "mealDessert",
        "notes",
      ]),
    );
  }
  if (kind === "guest.set_rsvp") return `RSVP → ${str(p.rsvp) ?? "?"}`;
  if (kind === "guest.archive") return "Archive (reversible) — unseats them, archives their +1";
  if (kind === "household.update") {
    return joinBits(headerBits(["name", "side", "notes"]));
  }
  if (kind === "book.card.replace_text") {
    return `Rewrites the card body (${clip(p.text, 80)})`;
  }
  if (kind === "book.card.rename") return `Title → "${clip(p.title, 80)}"`;
  if (kind === "book.card.create") {
    return `${clip(p.title, 60)} (${str(p.kind) ?? "TEXT"})`;
  }
  if (kind === "book.section.create") return clip(p.title, 80) || "(untitled)";
  if (kind === "book.field.set") {
    const field = str(p.fieldName) ?? "Field";
    return p.value === null ? `Clears "${field}"` : `${field} → ${clip(p.value, 60)}`;
  }
  if (kind === "book.recipe.update") {
    return joinBits(
      headerBits(["notes", "servingsBase"]),
      Array.isArray(p.setIngredients) ? `replaces ingredients (${p.setIngredients.length})` : "",
      deltaBits([
        ["addSteps", "+steps"],
        ["updateSteps", "~steps"],
        ["removeStepIds", "−steps"],
      ]),
    );
  }
  if (kind === "book.shot.add") return clip(p.title, 80) || "(untitled shot)";
  if (kind === "book.shot.update") {
    return joinBits(
      headerBits(["title", "category", "location", "notes", "estimatedMinutes", "captured"]),
    );
  }
  if (kind === "book.outfit.update") {
    return joinBits(
      headerBits(["personName", "role", "notes"]),
      deltaBits([
        ["addItems", "+items"],
        ["updateItems", "~items"],
        ["removeItemIds", "−items"],
      ]),
    );
  }
  if (kind === "book.build.update") {
    return joinBits(
      headerBits([
        "quantityNeeded",
        "targetDate",
        "status",
        "prototypeDone",
        "prototypeNotes",
        "estimatedMinutesPerUnit",
        "notes",
      ]),
      deltaBits([
        ["addMaterials", "+materials"],
        ["updateMaterials", "~materials"],
        ["removeMaterialIds", "−materials"],
      ]),
    );
  }
  if (kind === "book.menu.update") {
    return joinBits(
      headerBits(["serviceType", "serviceTime", "notes"]),
      deltaBits([
        ["addCourses", "+courses"],
        ["renameCourses", "~courses"],
        ["addOptions", "+options"],
        ["updateOptions", "~options"],
        ["removeOptionIds", "−options"],
      ]),
    );
  }
  if (kind === "book.bar.update") {
    return joinBits(
      headerBits(["barType", "toastDrink", "notes"]),
      deltaBits([
        ["addItems", "+items"],
        ["updateItems", "~items"],
        ["removeItemIds", "−items"],
      ]),
    );
  }
  if (kind === "book.setup.update") {
    return joinBits(
      headerBits(["space", "setupStartsAt", "setupOwner", "notes"]),
      deltaBits([
        ["addItems", "+items"],
        ["updateItems", "~items"],
        ["removeItemIds", "−items"],
      ]),
    );
  }
  if (kind === "book.stay.update") {
    return joinBits(
      headerBits([
        "propertyName",
        "propertyContact",
        "bookingReference",
        "checkInDate",
        "checkOutDate",
        "notes",
      ]),
      deltaBits([
        ["addOccupants", "+occupants"],
        ["removeOccupants", "−occupants"],
      ]),
    );
  }
  if (kind === "book.lodging.update") {
    return joinBits(
      headerBits(["notes"]),
      deltaBits([
        ["addItems", "+options"],
        ["updateItems", "~options"],
        ["removeItemIds", "−options"],
      ]),
    );
  }
  if (kind === "book.dresscode.update") {
    return joinBits(
      headerBits([
        "dressCode",
        "summary",
        "bodyText",
        "colourGuidance",
        "footwear",
        "weather",
        "accessories",
      ]),
    );
  }
  if (kind === "book.weddingparty.set_cell") {
    return `Status → ${str(p.status) ?? "?"}${p.notes ? ` · ${clip(p.notes, 40)}` : ""}`;
  }
  if (kind === "book.weddingparty.add_member") {
    return `${clip(p.name, 60)}${p.role ? ` (${clip(p.role, 30)})` : ""}`;
  }
  if (kind === "book.weddingparty.add_item") return clip(p.label, 80) || "(untitled)";
  if (kind === "book.weddingparty.update_header") {
    return joinBits(headerBits(["groupLabel", "notes"]));
  }
  if (kind === "budget.category.create") return clip(p.name, 80) || "(unnamed)";
  if (kind === "budget.line.create") {
    const est =
      typeof p.estimatedPence === "number" ? ` · est £${(p.estimatedPence / 100).toFixed(2)}` : "";
    return `${clip(p.description, 60)}${est}`;
  }
  if (kind === "budget.line.update") {
    const bits: string[] = [];
    if (p.description !== undefined) bits.push(`description → "${clip(p.description, 40)}"`);
    if (typeof p.estimatedPence === "number")
      bits.push(`estimated → £${(p.estimatedPence / 100).toFixed(2)}`);
    if (p.estimatedPence === null) bits.push("clears estimated");
    for (const k of [
      "supplierId",
      "notes",
      "perHeadPence",
      "headcountSource",
      "manualHeadcount",
      "minimumHeadcount",
      "fundSource",
      "fundLabel",
    ]) {
      if (p[k] !== undefined) bits.push(`sets ${k}`);
    }
    return bits.join(", ") || "small tweak";
  }
  if (kind === "payment.create") {
    const amt = typeof p.amountPence === "number" ? ` · £${(p.amountPence / 100).toFixed(2)}` : "";
    const due = str(p.dueDate) ? ` · due ${p.dueDate}` : "";
    return `${clip(p.description, 60)}${amt}${due}`;
  }
  if (kind === "payment.update") {
    const bits: string[] = [];
    if (p.description !== undefined) bits.push(`description → "${clip(p.description, 40)}"`);
    if (typeof p.amountPence === "number")
      bits.push(`amount → £${(p.amountPence / 100).toFixed(2)}`);
    if (p.status !== undefined) bits.push(`status → ${str(p.status)}`);
    if (str(p.paidDate)) bits.push(`paid date → ${p.paidDate}`);
    else if (p.paidDate === null) bits.push("clears paid date");
    for (const k of [
      "dueDate",
      "method",
      "supplierId",
      "budgetLineId",
      "budgetLineComponentId",
      "fundSource",
      "fundLabel",
      "notes",
    ]) {
      if (p[k] !== undefined) bits.push(`sets ${k}`);
    }
    return bits.join(", ") || "small tweak";
  }
  if (kind === "payment.set_status") {
    const s = str(p.status) ?? "?";
    if (s !== "PAID") return `Status → ${s}`;
    const paid = str(p.paidDate);
    return paid
      ? `Status → PAID (paid ${paid})`
      : "Status → PAID (stamps today as the paid date)";
  }
  if (kind === "question.answer") {
    return `${clip(p.answer, 100)} (marks the question Done)`;
  }
  if (kind === "song.add") {
    const artist = str(p.artist) ? ` — ${clip(p.artist, 40)}` : "";
    return `${clip(p.title, 60)}${artist}`;
  }
  if (kind === "custom_field.set") {
    const field = str(p.fieldName) ?? `${str(p.entity) ?? "?"} field`;
    return `${field} → ${clip(p.value, 60)}`;
  }
  if (kind === "seat.assign") return "Seat a guest at a specific seat";

  // v2.8.1: additive write kinds.
  if (kind === "guest.move_household") {
    const label = str(p.targetLabel);
    return label ? `Move to household "${clip(label, 60)}"` : "Move to another household";
  }
  if (kind === "seat.unassign") return "Unseat the guest at this seat";
  if (kind === "seat.swap") return "Swap the occupants of two seats (same table)";
  if (kind === "seating.table.create") {
    const name = clip(p.name, 60) || "(unnamed)";
    const cap = typeof p.capacity === "number" ? ` · ${p.capacity} seats` : "";
    const shape = str(p.shape) ? ` · ${p.shape}` : "";
    return `${name}${cap}${shape}`;
  }
  if (kind === "seating.table.update") {
    const bits: string[] = [];
    if (typeof p.capacity === "number") bits.push(`capacity → ${p.capacity}`);
    if (typeof p.posX === "number" && typeof p.posY === "number") bits.push("moves the table");
    if (typeof p.rotation === "number") bits.push(`rotation → ${p.rotation}°`);
    if (p.notes !== undefined) bits.push(p.notes === null ? "clears notes" : "sets notes");
    return bits.join(", ") || "small tweak";
  }
  if (kind === "song_request.assign") {
    return "Assign a guest song request to a playlist";
  }
  if (kind === "supplier.contract_update") {
    const bits: string[] = [];
    bits.push(p.signed ? "marks the contract signed" : "records a contract (unsigned)");
    if (str(p.signedAt)) bits.push(`signed ${p.signedAt}`);
    if (p.fileId !== undefined && p.fileId !== null) bits.push("attaches a file");
    if (str(p.notes)) bits.push("with notes");
    return bits.join(" · ");
  }
  if (kind === "budget.component_create") {
    const label = clip(p.label, 60) || "(unlabelled)";
    const flat =
      typeof p.flatPence === "number" ? ` · £${(p.flatPence / 100).toFixed(2)}` : "";
    const perHead =
      typeof p.perHeadPence === "number"
        ? ` · £${(p.perHeadPence / 100).toFixed(2)}/head`
        : "";
    return `${label}${flat}${perHead}`;
  }
  if (kind === "budget.component_update") {
    const bits: string[] = [];
    if (p.label !== undefined) bits.push(`label → "${clip(p.label, 40)}"`);
    if (typeof p.flatPence === "number") bits.push(`flat → £${(p.flatPence / 100).toFixed(2)}`);
    if (p.flatPence === null) bits.push("clears flat");
    if (typeof p.perHeadPence === "number")
      bits.push(`per-head → £${(p.perHeadPence / 100).toFixed(2)}`);
    if (p.perHeadPence === null) bits.push("clears per-head");
    for (const k of [
      "headcountSource",
      "manualHeadcount",
      "minimumHeadcount",
      "notes",
      "fundSource",
      "fundLabel",
    ]) {
      if (p[k] !== undefined) bits.push(`sets ${k}`);
    }
    return bits.join(", ") || "small tweak";
  }

  // v2.8.0: destructive kinds. One shared shape so no delete can ever
  // read as routine in the review list: names the target (from the
  // display-only targetLabel), says "permanent", notes the recovery
  // snapshot, and surfaces the agent's reason when given.
  const destructiveSummary = (verb: string, noun: string, extra?: string): string => {
    const label = str(p.targetLabel);
    const target = label ? `${noun} "${clip(label, 60)}"` : `this ${noun}`;
    const reason = str(p.reason) ? ` · reason: ${clip(p.reason, 80)}` : "";
    return `${verb} ${target} — permanent${extra ? `, ${extra}` : ""}, snapshot kept${reason}`;
  };
  if (kind === "task.delete") return destructiveSummary("Delete", "task");
  if (kind === "event.delete") return destructiveSummary("Delete", "schedule event");
  if (kind === "guest.hard_delete") {
    return destructiveSummary("Hard-delete", "guest", "NOT the reversible archive");
  }
  if (kind === "supplier.delete") return destructiveSummary("Delete", "supplier");
  if (kind === "supplier.contact_remove") return destructiveSummary("Remove", "contact");
  if (kind === "payment.delete") return destructiveSummary("Delete", "payment");
  if (kind === "budget.line.delete") return destructiveSummary("Delete", "budget line");
  if (kind === "budget.category.delete") {
    return destructiveSummary("Delete", "budget category", "refused while it still has lines");
  }
  if (kind === "book.card.delete") return destructiveSummary("Delete", "book card");
  if (kind === "book.section.delete") {
    return destructiveSummary("Delete", "book section", "refused while it still has cards");
  }
  if (kind === "song.remove") return destructiveSummary("Remove", "song");
  if (kind === "seating.table.delete") {
    return destructiveSummary("Delete", "seating table", "occupants become unseated");
  }
  return "";
}
