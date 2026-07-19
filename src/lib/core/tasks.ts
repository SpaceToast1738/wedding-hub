// v2.8.0: shared session-free cores for task writes.
//
// src/lib/core/ hosts the extracted bodies of human server actions
// that the MCP self-apply path must also run — both callers execute
// IDENTICAL logic: same db writes, same audit rows, same
// revalidatePath set. These cores live in a plain lib file, NEVER in
// a "use server" file: every export from a "use server" module
// becomes a client-invokable endpoint, and a core that takes `user`
// as a parameter instead of reading the session would be a
// forged-user endpoint if the network could reach it. Callers own
// authentication — the server-action wrappers in
// src/app/(app)/tasks/actions.ts gate requireEdit("tasks") before
// calling in; the MCP path resolves its user from a verified bearer
// token before it gets here.
//
// Input types are the actions' already-parsed shapes (post-Zod,
// post-FormData): the AI payload schemas map straight onto them —
// taskCreateSchema's parse result is structurally assignable to
// TaskCreateInput with zero glue, and taskUpdateSchema's deltas
// become a TaskUpdateInput via the existing mergeTaskRelations
// bridge (see the type docs below).

import { revalidatePath } from "next/cache";
import type { Priority, TaskStatus, TaskType } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
// Type-only import — erased at compile time, so the cores never pull
// the @/auth module graph (NextAuth, adapter, SMTP config) into the
// MCP route bundle.
import type { SessionUser } from "@/lib/actions";

// v2.8.0: moved verbatim from tasks/actions.ts — the due-date
// string → Date coercion is part of the write behaviour both callers
// must share (unparseable or empty strings store null, same as a
// human leaving the field blank).
function parseDue(v: string | null): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** createTask's already-parsed shape: baseSchema output + the four
 *  topic-relation ID lists + assignees (FormData parsing stays in the
 *  action wrapper).
 *
 *  AI mapping: taskCreateSchema's parse result (TaskCreatePayload in
 *  src/lib/ai/proposals/schemas.ts) satisfies this type directly —
 *  identical field names, arrays always present via .default([]). */
export type TaskCreateInput = {
  title: string;
  type: TaskType;
  priority: Priority;
  status: TaskStatus;
  /** ISO date/datetime string; empty/unparseable stores null. */
  dueDate?: string | null;
  notes?: string | null;
  supplierId?: string | null;
  assigneeIds: string[];
  bookSectionIds: string[];
  bookSubsectionIds: string[];
  navTagIds: string[];
  guestGroupIds: string[];
};

/** v2.8.0: extracted body of createTask — the wrapper in
 *  tasks/actions.ts parses FormData + gates requireEdit("tasks"),
 *  then delegates here. Everything a human create did (db write,
 *  enriched audit row, revalidations, returned id) happens here so
 *  the two paths cannot drift. */
export async function createTaskCore(
  user: SessionUser,
  input: TaskCreateInput,
): Promise<{ id: string }> {
  const created = await db.task.create({
    data: {
      title: input.title,
      type: input.type,
      priority: input.priority,
      status: input.status,
      dueDate: parseDue(input.dueDate ?? null),
      notes: input.notes ?? null,
      supplierId: input.supplierId || null,
      // v1.96.0: multi-assignee connect.
      assignees: input.assigneeIds.length
        ? { connect: input.assigneeIds.map((id) => ({ id })) }
        : undefined,
      // v1.30.5: m2m connect for the two topic relations.
      bookSections: input.bookSectionIds.length
        ? { connect: input.bookSectionIds.map((id) => ({ id })) }
        : undefined,
      // v1.51.0: parallel m2m at the card level. Independent of
      // bookSections — a task can link to a section, a card, both,
      // or neither.
      bookSubsections: input.bookSubsectionIds.length
        ? { connect: input.bookSubsectionIds.map((id) => ({ id })) }
        : undefined,
      navTags: input.navTagIds.length
        ? { connect: input.navTagIds.map((id) => ({ id })) }
        : undefined,
      // v1.61.0 (XL1): m2m to GuestGroup so tagged tasks surface on
      // every member's /guests/[id] page.
      guestGroups: input.guestGroupIds.length
        ? { connect: input.guestGroupIds.map((id) => ({ id })) }
        : undefined,
    },
  });
  // v1.30.5: enriched audit metadata per the audit-aware-feature-design
  // standing rule. Captures title, type, and the relational keys so the
  // log row reads usefully without rejoining.
  // v2.8.0: logAudit with an explicit userId ≡ the audit(user, …)
  // helper (which is just logAudit({...entry, userId: user.id})) —
  // used directly so the core doesn't value-import @/lib/actions and
  // drag the auth graph into every consumer.
  await logAudit({
    userId: user.id,
    action: "create",
    entity: "Task",
    entityId: created.id,
    metadata: {
      title: input.title,
      type: input.type,
      supplierId: input.supplierId || null,
      assigneeIds: input.assigneeIds,
      bookSectionIds: input.bookSectionIds,
      bookSubsectionIds: input.bookSubsectionIds,
      navTagIds: input.navTagIds,
      guestGroupIds: input.guestGroupIds,
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/questions");
  revalidatePath("/");
  revalidatePath("/book");
  // v2.1.0 phase 2: return the id so applyProposal can link the
  // AiProposal to the row it just produced. Existing FormData
  // callers ignore return values, so this is non-breaking.
  return { id: created.id };
}

/** updateTask's already-parsed shape. Scalars follow the historical
 *  partial-update contract: `undefined` = field untouched.
 *
 *  Relations keep updateTask's set-the-whole-list semantics:
 *  - `assigneeIds` undefined = untouched; an array (even empty)
 *    REPLACES the full assignee set (v1.96.0 `__touched__` contract).
 *  - `topics` undefined = untouched; when present, ALL FOUR topic
 *    relations are replaced as a unit (v1.30.5 topicKeys contract) —
 *    callers must supply the complete post-merge lists, including
 *    relations they didn't change.
 *
 *  AI mapping: taskUpdateSchema's add/remove deltas become this type
 *  by merging against the live row with mergeTaskRelations
 *  (src/lib/ai/proposals/merge-task-update.ts) — set `assigneeIds`
 *  when patchTouchesAssignees, `topics` when patchTouchesTopics;
 *  scalars pass through. NB the historical FormData bridge treated
 *  payload `dueDate: null` as "omit" (leave untouched), not "clear" —
 *  glue that wants byte-identical apply behaviour must do the same. */
export type TaskUpdateInput = {
  title?: string;
  type?: TaskType;
  priority?: Priority;
  status?: TaskStatus;
  dueDate?: string | null;
  notes?: string | null;
  supplierId?: string | null;
  assigneeIds?: string[];
  topics?: {
    bookSectionIds: string[];
    bookSubsectionIds: string[];
    navTagIds: string[];
    guestGroupIds: string[];
  };
};

/** v2.8.0: extracted body of updateTask — wrapper parses FormData +
 *  gates requireEdit("tasks"), then delegates here. Void-returning,
 *  matching the original action (callers already know the taskId). */
export async function updateTaskCore(
  user: SessionUser,
  id: string,
  input: TaskUpdateInput,
): Promise<void> {
  const assigneeIds = input.assigneeIds;
  const topics = input.topics;

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.type !== undefined) data.type = input.type;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.status !== undefined) data.status = input.status;
  if (input.dueDate !== undefined) data.dueDate = parseDue(input.dueDate ?? null);
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  if (input.supplierId !== undefined) data.supplierId = input.supplierId || null;
  if (assigneeIds !== undefined) {
    data.assignees = { set: assigneeIds.map((aid) => ({ id: aid })) };
  }
  // v1.30.5: m2m `set:` replaces the relation entirely so the picker
  // can both add and remove links. Only run when the caller supplied
  // topics at all; otherwise this is a partial update that didn't
  // touch them.
  // v1.51.0: bookSubsections joins the same payload.
  // v1.61.0 (XL1): + guestGroups.
  if (topics !== undefined) {
    data.bookSections = { set: topics.bookSectionIds.map((id) => ({ id })) };
    data.bookSubsections = { set: topics.bookSubsectionIds.map((id) => ({ id })) };
    data.navTags = { set: topics.navTagIds.map((id) => ({ id })) };
    data.guestGroups = { set: topics.guestGroupIds.map((id) => ({ id })) };
  }

  // v1.30.5: read pre-update for the changedFields diff in the audit.
  const before = await db.task.findUnique({
    where: { id },
    select: {
      title: true,
      type: true,
      status: true,
      priority: true,
      assignees: { select: { id: true } },
      dueDate: true,
      notes: true,
      supplierId: true,
      bookSections: { select: { id: true } },
      bookSubsections: { select: { id: true } },
      navTags: { select: { id: true } },
      guestGroups: { select: { id: true } },
    },
  });

  await db.task.update({ where: { id }, data });

  const changedFields: string[] = [];
  if (before) {
    if (input.title !== undefined && input.title !== before.title) changedFields.push("title");
    if (input.type !== undefined && input.type !== before.type) changedFields.push("type");
    if (input.status !== undefined && input.status !== before.status) changedFields.push("status");
    if (input.priority !== undefined && input.priority !== before.priority) changedFields.push("priority");
    if (assigneeIds !== undefined) {
      const oldAids = before.assignees.map((a) => a.id).sort().join(",");
      const newAids = assigneeIds.slice().sort().join(",");
      if (oldAids !== newAids) changedFields.push("assignees");
    }
    if (input.dueDate !== undefined) {
      const newDue = parseDue(input.dueDate ?? null)?.getTime() ?? null;
      const oldDue = before.dueDate?.getTime() ?? null;
      if (newDue !== oldDue) changedFields.push("dueDate");
    }
    if (input.notes !== undefined && (input.notes ?? null) !== before.notes) changedFields.push("notes");
    if (input.supplierId !== undefined && (input.supplierId || null) !== before.supplierId) changedFields.push("supplierId");
    if (topics !== undefined) {
      const oldBs = before.bookSections.map((s) => s.id).sort().join(",");
      const newBs = topics.bookSectionIds.slice().sort().join(",");
      if (oldBs !== newBs) changedFields.push("bookSections");
      const oldBSs = before.bookSubsections.map((s) => s.id).sort().join(",");
      const newBSs = topics.bookSubsectionIds.slice().sort().join(",");
      if (oldBSs !== newBSs) changedFields.push("bookSubsections");
      const oldNt = before.navTags.map((t) => t.id).sort().join(",");
      const newNt = topics.navTagIds.slice().sort().join(",");
      if (oldNt !== newNt) changedFields.push("navTags");
      // v1.61.0 (XL1): + guestGroups.
      const oldGg = before.guestGroups.map((g) => g.id).sort().join(",");
      const newGg = topics.guestGroupIds.slice().sort().join(",");
      if (oldGg !== newGg) changedFields.push("guestGroups");
    }
  }

  await logAudit({
    userId: user.id,
    action: "update",
    entity: "Task",
    entityId: id,
    metadata: {
      title: input.title ?? before?.title,
      type: input.type ?? before?.type,
      changedFields,
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/questions");
  revalidatePath("/");
  // v1.51.0: book pages render the inline tasks panel, so any
  // task edit invalidates them too.
  revalidatePath("/book");
}
