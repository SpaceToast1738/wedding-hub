// v2.8.0: session-free core of the proposal apply/dismiss engine.
//
// Moved from src/app/(app)/ai/actions.ts (T1 self-apply) so the MCP
// apply_proposals / dismiss_proposals tools can run the SAME
// load-owned → claim → dispatch → audit pipeline over token auth,
// where no Auth.js session exists. The server actions there are now
// thin wrappers: requireUser + canEdit("ai_write") gate + these
// cores. /ai behaviour is byte-identical — same error strings, same
// claim races, same audit actions, same revalidations.
//
// Contract (same as src/lib/core/*):
// - No session auth here. Callers own the ai_write gate; cores take
//   an explicit `user: SessionUser`. NEVER export these from a
//   "use server" file — every export there becomes a client-invokable
//   action, and a core that takes `user` as a parameter instead of
//   reading the session would be a forged-user endpoint.
// - The FormData round-trips through the human server actions
//   (createTask, createGuest, …) are replaced by direct calls into
//   the src/lib/core/* extractions of those same actions — identical
//   db writes, audit rows and revalidations, minus the session-bound
//   requireEdit() gate. That per-section gate is re-asserted HERE via
//   requireSectionEdit (canEdit + requireEdit's exact error string),
//   so the switch away from FormData must not silently widen who can
//   apply what: a non-couple ai_write holder without EDIT(tasks)
//   still can't apply a task.create, exactly as before.

import { revalidatePath } from "next/cache";
import { Prisma, RsvpStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { canEdit, type Section } from "@/lib/permissions";
// Type-only import — erased at compile time, so this module never
// pulls the @/auth graph into the MCP route bundle (same convention
// as src/lib/core/*).
import type { SessionUser } from "@/lib/actions";
import {
  mergeTaskRelations,
  patchTouchesAssignees,
  patchTouchesTopics,
} from "@/lib/ai/proposals/merge-task-update";
import { assertBookCardWritable } from "@/lib/ai/apply/common";
import { applyBookProposal } from "@/lib/ai/apply/book";
import { markdownToBookHtml } from "@/lib/ai/apply/markdown-to-book-html";
import { applyGuestProposal } from "@/lib/ai/apply/guests";
import { applyEventUpdate } from "@/lib/ai/apply/schedule";
import { applyMoneyProposal } from "@/lib/ai/apply/money";
import { applyMiscProposal } from "@/lib/ai/apply/misc";
import { applyDeleteProposal } from "@/lib/ai/apply/deletes";
// v2.9.0: staged file uploads — apply promotes the stage, dismiss
// discards it (see src/lib/ai/uploads-staging.ts for the lifecycle).
import { applyFileUpload } from "@/lib/ai/apply/files";
import { discardStage, stagedNameFromPayload } from "@/lib/ai/uploads-staging";
import {
  bookCardAppendSchema,
  eventCreateSchema,
  guestCreateSchema,
  nudgeSendSchema,
  settingsUpdateSchema,
  supplierCommunicationSchema,
  supplierContactAddSchema,
  supplierContactUpdateSchema,
  supplierContractUpdateSchema,
  supplierCreateSchema,
  supplierUpdateSchema,
  taskCreateSchema,
  taskUpdateSchema,
  type BookCardAppendPayload,
  type EventCreatePayload,
  type SupplierUpdatePayload,
  type TaskUpdatePayload,
} from "@/lib/ai/proposals/schemas";
// v2.9.2: proposal-gated digest send + tightly-scoped settings patch.
import { sendDigestCore } from "@/lib/core/nudge";
import { updateWeddingSettingsPartialCore } from "@/lib/core/settings";
import {
  createTaskCore,
  updateTaskCore,
  type TaskUpdateInput,
} from "@/lib/core/tasks";
import {
  createScheduleEventCore,
  parseEventInput,
  type EventCreateInput,
} from "@/lib/core/schedule";
import {
  createGuestCore,
  createHouseholdCore,
  guestInputSchema,
  householdInputSchema,
} from "@/lib/core/guests";
import {
  updateBookSubsectionCore,
  type BookSubsectionUpdateInput,
} from "@/lib/core/book";
import {
  createSupplierCommunicationCore,
  createSupplierContactCore,
  createSupplierContractCore,
  createSupplierCore,
  updateSupplierContactCore,
  supplierCommunicationInputSchema,
  supplierContactInputSchema,
  supplierContractInputSchema,
  supplierInputSchema,
  updateSupplierCore,
  type SupplierInput,
} from "@/lib/core/suppliers";

export type ApplyResult =
  | { ok: true; entityId: string }
  | { ok: false; error: string };

export type BatchItemResult = {
  id: string;
  ok: boolean;
  entityId: string | null;
  error: string | null;
};

/** Session-free twin of requireEdit(section) — same error text, but
 *  the user comes from the caller instead of the session (same helper
 *  convention as src/lib/ai/apply/deletes.ts). Replaces the gate the
 *  human server actions used to run INSIDE the FormData round-trip. */
async function requireSectionEdit(user: SessionUser, section: Section): Promise<void> {
  if (!(await canEdit(user, section))) {
    throw new Error(`Forbidden: no edit access to ${section}`);
  }
}

/** Load + verify the proposal belongs to the caller (or to any user
 *  when the caller is the couple). Returns the row or throws. */
export async function loadOwnedProposal(id: string, callerId: string, isCouple: boolean) {
  const proposal = await db.aiProposal.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      payload: true,
      status: true,
      createdById: true,
    },
  });
  if (!proposal) throw new Error("Proposal not found.");
  if (!isCouple && proposal.createdById !== callerId) {
    throw new Error("Proposal not found.");
  }
  return proposal;
}

/** Replica of parseAssigneeIds in tasks/actions.ts: trim, drop
 *  empties and the __touched__ sentinel, dedupe. The FormData
 *  round-trip applied it to every task.create apply, so the v2.8.0
 *  direct core call must too — duplicate ids in an AI payload behave
 *  exactly as the form path always did. (Topic id arrays deliberately
 *  get NO such cleanup: parseTopicKeys never deduped or trimmed, it
 *  only stripped prefixes.) */
function normaliseAssigneeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  for (const v of ids) {
    const s = String(v).trim();
    if (s && s !== "__touched__") seen.add(s);
  }
  return [...seen];
}

/** task.update payload → updateTaskCore input.
 *
 *  v2.2.0: assignee/topic deltas are merged against the task's LIVE
 *  relations here, at apply time — updateTaskCore replaces those
 *  relation sets wholesale when the fields are set, so we must pass
 *  the full post-merge sets (including bookSubsection card links,
 *  which the AI can't touch but which get wiped if omitted from a
 *  topic replace). Fields the patch doesn't touch are left off the
 *  input entirely so updateTaskCore leaves them alone.
 *
 *  v2.8.0: was taskUpdatePayloadToFormData — same merge, minus the
 *  FormData round-trip. The historical bridge treated payload
 *  dueDate/notes `null` as "field not posted" (leave untouched), NOT
 *  "clear" — preserved verbatim below. */
async function taskUpdateInputFromPayload(
  parsed: TaskUpdatePayload,
): Promise<TaskUpdateInput> {
  const input: TaskUpdateInput = {};
  if (parsed.title !== undefined) input.title = parsed.title;
  if (parsed.status !== undefined) input.status = parsed.status;
  if (parsed.priority !== undefined) input.priority = parsed.priority;
  if (parsed.dueDate !== undefined && parsed.dueDate !== null) {
    input.dueDate = parsed.dueDate;
  }
  if (parsed.notes !== undefined && parsed.notes !== null) {
    input.notes = parsed.notes;
  }
  // v2.4.3: supplier link. updateTaskCore only writes supplierId when
  // the field is set (undefined = untouched), so omission stays safe;
  // null unlinks (|| null on the write side).
  if (parsed.supplierId !== undefined) input.supplierId = parsed.supplierId;

  const touchesAssignees = patchTouchesAssignees(parsed);
  const touchesTopics = patchTouchesTopics(parsed);
  if (!touchesAssignees && !touchesTopics) return input;

  const current = await db.task.findUnique({
    where: { id: parsed.taskId },
    select: {
      assignees: { select: { id: true } },
      bookSections: { select: { id: true } },
      bookSubsections: { select: { id: true } },
      navTags: { select: { id: true } },
      guestGroups: { select: { id: true } },
    },
  });
  if (!current) throw new Error("Task not found — it may have been deleted since the proposal was made.");

  const merged = mergeTaskRelations(
    {
      assigneeIds: current.assignees.map((a) => a.id),
      bookSectionIds: current.bookSections.map((s) => s.id),
      bookSubsectionIds: current.bookSubsections.map((s) => s.id),
      navTagIds: current.navTags.map((t) => t.id),
      guestGroupIds: current.guestGroups.map((g) => g.id),
    },
    parsed,
  );

  if (touchesAssignees) input.assigneeIds = merged.assigneeIds;
  if (touchesTopics) {
    // updateTaskCore replaces all four topic relations as a unit —
    // pass the complete merged set, INCLUDING existing card-level links.
    input.topics = {
      bookSectionIds: merged.bookSectionIds,
      bookSubsectionIds: merged.bookSubsectionIds,
      navTagIds: merged.navTagIds,
      guestGroupIds: merged.guestGroupIds,
    };
  }
  return input;
}

/** event.create payload → createScheduleEventCore input.
 *
 *  v2.8.0: was eventPayloadToFormData + createScheduleEvent's
 *  combineDateTime, replicated byte-for-byte (see the note on
 *  EventCreateInput in @/lib/core/schedule): the bridge sliced times
 *  to HH:MM — dropping seconds and any zone suffix — and the action
 *  recombined them (allDay → T00:00:00; missing/short time → 00:00).
 *  parseEventInput then applies the same validation the human path
 *  runs, including the v2.5.0 end-after-start refinement. */
function eventInputFromPayload(parsed: EventCreatePayload): EventCreateInput {
  const combine = (date: string, time: string): string => {
    if (parsed.allDay) return `${date}T00:00:00`;
    return `${date}T${time && time.length >= 4 ? time : "00:00"}`;
  };
  const [startDate, startTimeRaw] = parsed.startTime.split("T");
  const startISO = startDate ? combine(startDate, (startTimeRaw ?? "").slice(0, 5)) : "";
  let endISO = "";
  if (parsed.endTime) {
    const [endDate, endTimeRaw] = String(parsed.endTime).split("T");
    endISO = endDate ? combine(endDate, (endTimeRaw ?? "").slice(0, 5)) : "";
  }
  return parseEventInput({
    title: parsed.title,
    startTime: startISO,
    endTime: endISO || null,
    location: parsed.location || null,
    // The FormData path filtered empty refs (readAttendeeRefs's
    // .filter(Boolean)) before validation — same here.
    attendeeRefs: parsed.attendeeRefs.map(String).filter(Boolean),
    allDay: parsed.allDay,
    notes: parsed.notes || null,
  });
}

/** book.card.append: build the updated bodyHtml (existing + heading +
 *  new text) as an updateBookSubsectionCore input.
 *  (v2.8.0: was bookCardAppendToFormData.) */
async function bookCardAppendInput(
  parsed: BookCardAppendPayload,
): Promise<{ subsectionId: string; input: BookSubsectionUpdateInput }> {
  const subsectionId = parsed.subsectionId;
  const existing = await db.bookSubsection.findUnique({
    where: { id: subsectionId },
    select: { title: true, bodyHtml: true, body: true, kind: true },
  });
  if (!existing) throw new Error("Book card not found.");
  if (existing.kind !== "TEXT") {
    throw new Error(
      `Can only append to TEXT cards, not ${existing.kind}.`,
    );
  }

  // v2.6.6: heading stays a plain escaped <h3> (it's a short label, not
  // prose); the body goes through markdownToBookHtml so the AI can use
  // bold/lists/links instead of only plain paragraphs. sanitizeBookHtml
  // re-runs inside updateBookSubsectionCore either way, but escaping
  // here means the AI's literal content survives the sanitiser untouched.
  const escHeading = parsed.heading
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const block = `<h3>${escHeading}</h3>${markdownToBookHtml(parsed.text)}`;
  const nextHtml = (existing.bodyHtml ?? "") + block;

  return { subsectionId, input: { title: existing.title, bodyHtml: nextHtml } };
}

/** supplier.update payload → the FULL SupplierInput updateSupplierCore
 *  requires on every call (its schema wants the whole record — an
 *  omitted field would WIPE the existing value). So this loads the
 *  supplier's CURRENT row and carries every field every time: the
 *  AI's patch value when the patch touches it, otherwise the current
 *  value. Mirrors the trap taskUpdateInputFromPayload solves for
 *  relations, here for scalar fields.
 *
 *  amountAgreed is never AI-writable — it always carries the CURRENT
 *  amount through untouched, so a supplier.update proposal can never
 *  zero out money the AI was never shown.
 *  (v2.8.0: was supplierUpdatePayloadToFormData.) */
async function supplierUpdateInputFromPayload(
  parsed: SupplierUpdatePayload,
): Promise<SupplierInput> {
  const current = await db.supplier.findUnique({ where: { id: parsed.supplierId } });
  if (!current) {
    throw new Error("Supplier not found — it may have been deleted since the proposal was made.");
  }
  return supplierInputSchema.parse({
    name: parsed.name !== undefined ? parsed.name : current.name,
    category: parsed.category !== undefined ? parsed.category : current.category,
    status: parsed.status !== undefined ? parsed.status : current.status,
    // `|| null` matches the old FormData reads (`get(x) || null`):
    // falsy patch/current values normalise to null.
    website: (parsed.website !== undefined ? parsed.website : current.website) || null,
    notes: (parsed.notes !== undefined ? parsed.notes : current.notes) || null,
    amountAgreed: current.amountAgreed != null ? current.amountAgreed.toString() : null,
  });
}

/** The 12 destructive kinds (v2.8.0, Jamie's policy call 2026-07-19)
 *  — dispatched to @/lib/ai/apply/deletes. Kept as an explicit set,
 *  and checked BEFORE the book./budget./payment. family catch-alls in
 *  the dispatch below: book.card.delete, budget.line.delete etc.
 *  would otherwise be swallowed by prefix matching and hit the wrong
 *  module. */
const DELETE_KINDS = new Set([
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
]);

/** Shared core of single + bulk apply: takes an already-loaded, owned
 *  proposal, dispatches by kind through the SAME write logic a human
 *  save runs (src/lib/core/* extractions of the server actions, or
 *  the per-domain apply modules), updates the AiProposal row, writes
 *  the per-proposal audit entry. Does NOT gate ai_write or
 *  revalidate /ai — callers own both. */
async function applyLoadedProposal(
  user: SessionUser,
  proposal: { id: string; kind: string; payload: unknown; status: string },
  override?: Record<string, unknown>,
): Promise<ApplyResult> {
  if (proposal.status !== "PENDING") {
    return { ok: false, error: `Proposal is already ${proposal.status.toLowerCase()}.` };
  }

  const status = override && Object.keys(override).length > 0
    ? "EDITED_AND_APPLIED"
    : "APPLIED";

  // v2.2.0 review fix: atomically CLAIM the row before creating the
  // entity, so two concurrent applies (two tabs, chat card + /ai)
  // can't both run the create. The loser's updateMany matches zero
  // rows. On create failure the claim is rolled back to PENDING so
  // the proposal stays actionable. (A crash between claim and create
  // leaves an APPLIED row without an entity — rarer and strictly
  // safer than double-creating real rows.)
  const claimed = await db.aiProposal.updateMany({
    where: { id: proposal.id, status: "PENDING" },
    data: { status, reviewedAt: new Date() },
  });
  if (claimed.count === 0) {
    return {
      ok: false,
      error: "Proposal was already handled — maybe in another tab.",
    };
  }

  const merged = { ...(proposal.payload as Record<string, unknown>), ...(override ?? {}) };
  let created: { id: string };

  try {
    if (proposal.kind === "task.create") {
      const parsed = taskCreateSchema.parse(merged);
      await requireSectionEdit(user, "tasks");
      const result = await createTaskCore(user, {
        title: parsed.title,
        type: parsed.type,
        priority: parsed.priority,
        status: parsed.status,
        dueDate: parsed.dueDate ?? null,
        notes: parsed.notes || null,
        supplierId: parsed.supplierId ?? null,
        assigneeIds: normaliseAssigneeIds(parsed.assigneeIds),
        bookSectionIds: parsed.bookSectionIds,
        // v2.4.0: card-level links (breakdown subtasks inherit these).
        bookSubsectionIds: parsed.bookSubsectionIds,
        navTagIds: parsed.navTagIds,
        guestGroupIds: parsed.guestGroupIds,
      });
      if (!result?.id) throw new Error("createTask did not return an id.");
      created = { id: result.id };
    } else if (proposal.kind === "task.update") {
      const parsed = taskUpdateSchema.parse(merged);
      // Live-relation merge BEFORE the section gate — preserves the
      // old evaluation order (bridge ran before the action's
      // requireEdit), so a deleted task reports "Task not found"
      // rather than a permission error.
      const input = await taskUpdateInputFromPayload(parsed);
      await requireSectionEdit(user, "tasks");
      await updateTaskCore(user, parsed.taskId, input);
      // updateTaskCore returns void; the entity id IS the taskId, no new row.
      created = { id: parsed.taskId };
    } else if (proposal.kind === "event.create") {
      const parsed = eventCreateSchema.parse(merged);
      await requireSectionEdit(user, "schedule");
      const result = await createScheduleEventCore(user, eventInputFromPayload(parsed));
      if (!result?.id) throw new Error("createScheduleEvent did not return an id.");
      created = { id: result.id };
    } else if (proposal.kind === "guest.create") {
      const parsed = guestCreateSchema.parse(merged);
      await requireSectionEdit(user, "guests");
      // Reuse an existing household by name (case-insensitive) if the
      // couple has one; otherwise create a new one and link the guest.
      const householdName =
        parsed.householdName?.trim() || `${parsed.lastName} household`;
      let household = await db.household.findFirst({
        where: { name: { equals: householdName, mode: "insensitive" } },
        select: { id: true },
      });
      if (!household) {
        const createdHh = await createHouseholdCore(
          user,
          // Same shape the old FormData round-trip produced — the
          // bridge only ever posted name + side, so notes lands null.
          householdInputSchema.parse({ name: householdName, side: parsed.side, notes: null }),
        );
        if (!createdHh?.id) throw new Error("createHousehold did not return an id.");
        household = { id: createdHh.id };
      }
      const guest = await createGuestCore(
        user,
        guestInputSchema.parse({
          householdId: household.id,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          email: parsed.email || null,
          phone: parsed.phone || null,
          // The bridge never posted rsvp — AI-created guests always
          // land PENDING; the couple flips it later.
          rsvp: RsvpStatus.PENDING,
          side: parsed.side,
          isChild: !!parsed.isChild,
          needsHighchair: false,
          plusOneAllowed: !!parsed.plusOneAllowed,
          plusOneName: parsed.plusOneName || null,
          role: parsed.role || null,
          dietary: parsed.dietary || null,
          notes: parsed.notes || null,
        }),
      );
      if (!guest?.id) throw new Error("createGuest did not return an id.");
      created = { id: guest.id };
    } else if (proposal.kind === "book.card.append") {
      const parsed = bookCardAppendSchema.parse(merged);
      // v2.4.0: visibility wall — previously a non-couple ai_write
      // holder could apply an append to a COUPLE_ONLY card.
      await assertBookCardWritable(user, parsed.subsectionId);
      const { subsectionId, input } = await bookCardAppendInput(parsed);
      await requireSectionEdit(user, "book");
      await updateBookSubsectionCore(user, subsectionId, input);
      created = { id: subsectionId };
    } else if (proposal.kind === "supplier.create") {
      const parsed = supplierCreateSchema.parse(merged);
      await requireSectionEdit(user, "suppliers");
      const result = await createSupplierCore(
        user,
        supplierInputSchema.parse({
          name: parsed.name,
          category: parsed.category,
          status: parsed.status,
          website: parsed.website || null,
          notes: parsed.notes || null,
          // Deliberately never set — same as the old bridge never
          // appending it: a brand-new AI supplier starts with a blank
          // Amount field, exactly like a human create.
          amountAgreed: null,
        }),
      );
      if (!result?.id) throw new Error("createSupplier did not return an id.");
      created = { id: result.id };
    } else if (proposal.kind === "supplier.update") {
      const parsed = supplierUpdateSchema.parse(merged);
      // Current-row merge before the gate — same evaluation order as
      // the old bridge (see task.update above).
      const input = await supplierUpdateInputFromPayload(parsed);
      await requireSectionEdit(user, "suppliers");
      await updateSupplierCore(user, parsed.supplierId, input);
      // updateSupplierCore returns void; the entity id IS the supplierId.
      created = { id: parsed.supplierId };
    } else if (proposal.kind === "supplier.log_communication") {
      const parsed = supplierCommunicationSchema.parse(merged);
      await requireSectionEdit(user, "suppliers");
      await createSupplierCommunicationCore(
        user,
        supplierCommunicationInputSchema.parse({
          supplierId: parsed.supplierId,
          channel: parsed.channel,
          summary: parsed.summary,
          followUpAt: parsed.followUpAt || null,
          // The AI payload has no occurredAt (v2.6.3 backfill field) —
          // null keeps createdAt on its column default, as the old
          // bridge did by never posting the field.
          occurredAt: null,
        }),
      );
      // createSupplierCommunicationCore returns void; use the known
      // supplierId as the affected entity, same convention as
      // book.card.append's subsectionId.
      created = { id: parsed.supplierId };
    } else if (proposal.kind === "supplier.contract_update") {
      // v2.8.1: contract record via the session-free core. The AI
      // payload carries NO amount (read+write amount parity with
      // read_suppliers), so amount is always null — a human editing a
      // contract in the app still posts it, but the agent never does.
      const parsed = supplierContractUpdateSchema.parse(merged);
      await requireSectionEdit(user, "suppliers");
      created = await createSupplierContractCore(
        user,
        supplierContractInputSchema.parse({
          supplierId: parsed.supplierId,
          signed: parsed.signed,
          signedAt: parsed.signedAt ?? null,
          notes: parsed.notes ?? null,
          fileId: parsed.fileId ?? null,
          amount: null,
        }),
      );
    } else if (proposal.kind === "supplier.contact.add") {
      const parsed = supplierContactAddSchema.parse(merged);
      await requireSectionEdit(user, "suppliers");
      await createSupplierContactCore(
        user,
        supplierContactInputSchema.parse({
          supplierId: parsed.supplierId,
          name: parsed.name,
          role: parsed.role || null,
          email: parsed.email || null,
          phone: parsed.phone || null,
          primary: !!parsed.primary,
        }),
      );
      // Void-returning core — the supplier is the affected entity.
      created = { id: parsed.supplierId };
    } else if (proposal.kind === "supplier.contact.update") {
      // v2.9.0: patch one contact row. The core loads the current row
      // and merges (undefined keeps, null clears); primary:true swaps
      // the primary flag in one transaction, same as contact.add.
      const parsed = supplierContactUpdateSchema.parse(merged);
      await requireSectionEdit(user, "suppliers");
      created = await updateSupplierContactCore(user, parsed.contactId, {
        name: parsed.name,
        role: parsed.role,
        email: parsed.email,
        phone: parsed.phone,
        primary: parsed.primary,
      });
    } else if (proposal.kind === "file.upload") {
      // v2.9.0: promote the staged file into a real upload. The
      // handler gates EDIT(files) itself and renames the stage BEFORE
      // creating the File row (rename back on insert failure).
      created = await applyFileUpload(user, merged, proposal.id);
    } else if (DELETE_KINDS.has(proposal.kind)) {
      // v2.8.0: all 12 destructive kinds — snapshot-then-delete with
      // per-kind refusal rules; each handler gates its own section.
      // MUST stay above the book./budget./payment. prefix catch-alls
      // (see DELETE_KINDS above). Throws → claim rollback.
      created = await applyDeleteProposal(user, proposal.kind, merged, proposal.id);
    } else if (proposal.kind.startsWith("book.")) {
      // v2.4.0: every remaining book.* kind (append is handled above)
      // dispatches through the book apply module — schema re-parse,
      // COUPLE_ONLY wall, kind guard, live-row delta merge all live
      // there. Throws → claim rollback.
      // v2.8.0: the book apply module now calls session-free cores
      // directly (was the human "use server" actions, which carried
      // requireEdit("book")). assertBookCardWritable inside is only the
      // COUPLE_ONLY *visibility* wall — NOT a section-EDIT check — so
      // gate here, exactly as the book.card.append branch above does,
      // or a token with ai_write but book=NONE/VIEW could self-apply
      // book changes.
      await requireSectionEdit(user, "book");
      created = await applyBookProposal(user, proposal.kind, merged);
    } else if (
      proposal.kind === "guest.update" ||
      proposal.kind === "guest.set_rsvp" ||
      proposal.kind === "guest.archive" ||
      proposal.kind === "household.update" ||
      proposal.kind === "guest.move_household"
    ) {
      created = await applyGuestProposal(user, proposal.kind, merged);
    } else if (proposal.kind === "event.update") {
      created = await applyEventUpdate(user, merged);
    } else if (
      proposal.kind.startsWith("budget.") ||
      proposal.kind.startsWith("payment.")
    ) {
      // Couple-only end to end: the real budget/payment actions gate
      // requireEdit("budget"/"payments"), which only couple-tier users
      // pass — a non-couple Apply throws and the claim rolls back.
      created = await applyMoneyProposal(user, proposal.kind, merged);
    } else if (
      proposal.kind === "question.answer" ||
      proposal.kind === "song.add" ||
      proposal.kind === "custom_field.set" ||
      proposal.kind === "seat.assign" ||
      // v2.8.1 (Tier 2): seating rearrangement + song-request triage.
      proposal.kind === "seat.unassign" ||
      proposal.kind === "seat.swap" ||
      proposal.kind === "seating.table.create" ||
      proposal.kind === "seating.table.update" ||
      proposal.kind === "song_request.assign" ||
      // v2.9.2: plan-level seating notes/checklist.
      proposal.kind === "seating.plan.update"
    ) {
      created = await applyMiscProposal(user, proposal.kind, merged);
    } else if (proposal.kind === "nudge.send") {
      // v2.9.2: the most side-effectful kind — Apply actually EMAILS the
      // couple + planners the RSVP / overdue-task digest. Couple-only
      // (same gate as the /settings send button + read_nudge_preview).
      // The atomic PENDING→APPLIED claim above already fired, so a
      // concurrent/second apply of THIS proposal can't re-send; the core
      // additionally recomputes eligibility and sends BEFORE stamping the
      // 7-day cooldown, so a bookkeeping hiccup never double-sends either.
      const parsed = nudgeSendSchema.parse(merged);
      if (!user.isCouple) {
        throw new Error("Only the couple can send the nudge digest.");
      }
      const sent = await sendDigestCore(user, parsed.digestKind);
      if (!sent.ok) throw new Error(sent.error);
      // Synthetic entity id — no row is created by a send.
      created = { id: `nudge:${parsed.digestKind}` };
    } else if (proposal.kind === "settings.update") {
      // v2.9.2: tightly-scoped wedding-settings patch (date + AI cap only).
      // Couple-only, same as the human Settings form. A date change ripples
      // into schedule/stays/payment due dates — the propose tool tells the
      // agent to batch those consistency fixes; apply does not cascade.
      const parsed = settingsUpdateSchema.parse(merged);
      if (!user.isCouple) {
        throw new Error("Only the couple can change wedding settings.");
      }
      const patch: { weddingDate?: Date; aiMonthlyCapPence?: number | null } = {};
      if (parsed.weddingDate !== undefined) {
        const d = new Date(parsed.weddingDate);
        if (Number.isNaN(d.getTime())) {
          throw new Error("Wedding date must be a valid date or ISO timestamp.");
        }
        patch.weddingDate = d;
      }
      if (parsed.aiMonthlyCapPence !== undefined) {
        patch.aiMonthlyCapPence = parsed.aiMonthlyCapPence;
      }
      created = await updateWeddingSettingsPartialCore(user, patch);
    } else {
      await rollbackClaim(proposal.id);
      return { ok: false, error: `Unknown proposal kind: ${proposal.kind}` };
    }
  } catch (err) {
    await rollbackClaim(proposal.id);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Apply failed during creation.",
    };
  }

  await db.aiProposal.update({
    where: { id: proposal.id },
    data: { appliedEntityId: created.id },
  });
  await logAudit({
    userId: user.id,
    action: `ai.proposal.${status.toLowerCase()}`,
    entity: "AiProposal",
    entityId: proposal.id,
    metadata: {
      kind: proposal.kind,
      appliedEntityId: created.id,
      hadOverride: Boolean(override && Object.keys(override).length > 0),
    },
  });

  return { ok: true, entityId: created.id };
}

/** Undo an apply-claim after entity creation failed — the row goes
 *  back to PENDING so the reviewer can retry or dismiss. Also clears
 *  metadata: a delete handler (apply/deletes.ts) writes its recovery
 *  snapshot BEFORE deleting, so a failed delete would otherwise leave
 *  a PENDING proposal carrying a deletedSnapshot for a row that still
 *  exists — misleading, and re-run would overwrite it anyway. */
async function rollbackClaim(id: string): Promise<void> {
  try {
    await db.aiProposal.update({
      where: { id },
      data: { status: "PENDING", reviewedAt: null, metadata: Prisma.DbNull },
    });
  } catch (err) {
    console.error("ai proposal claim rollback failed", err);
  }
}

/** Shared core of single + bulk dismiss. Same contract as
 *  applyLoadedProposal: no gate, no revalidate. */
async function dismissLoadedProposal(
  user: { id: string },
  proposal: { id: string; kind: string; status: string; payload?: unknown },
): Promise<ApplyResult | { ok: true; entityId: null }> {
  if (proposal.status !== "PENDING") {
    return { ok: false, error: `Proposal is already ${proposal.status.toLowerCase()}.` };
  }
  // Atomic claim — same race protection as apply.
  const claimed = await db.aiProposal.updateMany({
    where: { id: proposal.id, status: "PENDING" },
    data: { status: "DISMISSED", reviewedAt: new Date() },
  });
  if (claimed.count === 0) {
    return {
      ok: false,
      error: "Proposal was already handled — maybe in another tab.",
    };
  }
  // v2.9.0: dismissing a staged upload deletes the staged bytes —
  // best-effort AFTER the claim won (a lost race must not unlink a
  // file another tab is about to apply). stagedNameFromPayload
  // validates the strict pending-name pattern, so a tampered row can
  // never steer the unlink outside the uploads dir.
  if (proposal.kind === "file.upload") {
    const stagedName = stagedNameFromPayload(proposal.payload);
    if (stagedName) await discardStage(stagedName);
  }
  await logAudit({
    userId: user.id,
    action: "ai.proposal.dismissed",
    entity: "AiProposal",
    entityId: proposal.id,
    metadata: { kind: proposal.kind },
  });
  return { ok: true, entityId: null };
}

/** Apply one proposal for an already-authenticated user. Load-owned →
 *  claim → dispatch → audit → revalidate /ai. Callers own the
 *  ai_write gate. The load-failure path deliberately skips the
 *  revalidate — nothing changed — matching the pre-extraction server
 *  action exactly. */
export async function applyProposalCore(
  user: SessionUser,
  id: string,
  override?: Record<string, unknown>,
): Promise<ApplyResult> {
  let proposal;
  try {
    proposal = await loadOwnedProposal(id, user.id, user.isCouple);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Not found." };
  }

  const result = await applyLoadedProposal(user, proposal, override);
  revalidatePath("/ai");
  return result;
}

/** Dismiss one proposal — same contract as applyProposalCore. */
export async function dismissProposalCore(
  user: SessionUser,
  id: string,
): Promise<ApplyResult | { ok: true; entityId: null }> {
  let proposal;
  try {
    proposal = await loadOwnedProposal(id, user.id, user.isCouple);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Not found." };
  }

  const result = await dismissLoadedProposal(user, proposal);
  revalidatePath("/ai");
  return result;
}

// Matches listPendingProposals' take:50 so a full dashboard batch can
// be applied in one click. Sequential loop keeps this safe.
const BULK_CAP = 50;

/** Run apply or dismiss over a list of proposal ids. Per-item results
 *  in input order; a failed item stays PENDING and its siblings keep
 *  going. Sequential ON PURPOSE — two guest.create rows sharing a new
 *  householdName must not race the find-or-create household lookup.
 *  Callers own the ai_write gate: the /ai wrappers return the
 *  per-item permission-error shape before calling in; the MCP tools
 *  hard-refuse earlier (canApply token flag + canEdit). */
export async function runBulkCore(
  user: SessionUser,
  ids: string[],
  mode: "apply" | "dismiss",
): Promise<{ results: BatchItemResult[] }> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { results: [] };

  const results: BatchItemResult[] = [];
  let processed = 0;
  for (const id of unique) {
    if (processed >= BULK_CAP) {
      results.push({
        id,
        ok: false,
        entityId: null,
        error: `Too many at once — ${mode} in batches of ${BULK_CAP}.`,
      });
      continue;
    }
    processed++;
    try {
      const proposal = await loadOwnedProposal(id, user.id, user.isCouple);
      const result =
        mode === "apply"
          ? await applyLoadedProposal(user, proposal)
          : await dismissLoadedProposal(user, proposal);
      results.push({
        id,
        ok: result.ok,
        entityId: result.ok ? result.entityId : null,
        error: result.ok ? null : result.error,
      });
    } catch (err) {
      results.push({
        id,
        ok: false,
        entityId: null,
        error: err instanceof Error ? err.message : "Not found.",
      });
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  await logAudit({
    userId: user.id,
    action: mode === "apply" ? "ai.proposal.batch_applied" : "ai.proposal.batch_dismissed",
    entity: "AiProposal",
    metadata: { count: results.length, failed, ids: unique.slice(0, BULK_CAP) },
  });

  // One revalidate for the whole batch — the underlying create/update
  // cores already revalidate their own routes per item; Next dedupes
  // within a single request.
  revalidatePath("/ai");
  return { results };
}
