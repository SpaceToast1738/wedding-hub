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
  "guest.create",
  "book.card.append",
  "supplier.create",
  "supplier.update",
  "supplier.log_communication",
] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

// Kept separate from Prisma's SupplierStatus enum re-export so this
// module has zero Prisma dependency (matches every other schema here).
export const SUPPLIER_STATUSES = [
  "SHORTLIST",
  "CONTACTED",
  "QUOTED",
  "BOOKED",
  "PAID",
  "REJECTED",
] as const;

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
  addAssigneeIds: z.array(z.string()).max(10).optional(),
  removeAssigneeIds: z.array(z.string()).max(10).optional(),
  addNavTagIds: z.array(z.string()).max(5).optional(),
  removeNavTagIds: z.array(z.string()).max(5).optional(),
  addBookSectionIds: z.array(z.string()).max(5).optional(),
  removeBookSectionIds: z.array(z.string()).max(5).optional(),
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
  if (kind === "supplier.log_communication") {
    const channel = typeof p.channel === "string" ? p.channel : "contact";
    const summary = typeof p.summary === "string" ? p.summary : "";
    const followUp =
      typeof p.followUpAt === "string" && p.followUpAt ? ` · follow-up ${p.followUpAt}` : "";
    return `${channel}: ${summary.slice(0, 80)}${summary.length > 80 ? "…" : ""}${followUp}`;
  }
  return "";
}
