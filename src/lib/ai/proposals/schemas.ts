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
] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

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
 *  which row to update. */
export const taskUpdateSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  status: z
    .enum(["OPEN", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
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
  }
}
