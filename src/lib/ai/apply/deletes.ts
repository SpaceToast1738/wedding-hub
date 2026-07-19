// v2.8.0: apply handlers for the 12 destructive proposal kinds.
//
// Deletes are the first kinds whose apply path does NOT call the human
// server actions: those gate requireEdit() on the session, and the MCP
// self-apply path runs session-free with an explicit user (same
// contract as src/lib/core/*). So each handler here re-implements the
// matching domain delete — same permission section, same refusal
// rules, same cascade behaviour, same audit action names, same
// revalidatePath set (legal in route handlers) — read alongside the
// original in the domain's actions.ts when changing either.
//
// Recovery contract (the reason these exist at all): BEFORE deleting,
// every handler loads the entity WITH the relations a manual restore
// would need and writes it to the proposal row's metadata —
// { deletedSnapshot, deletedAt, cascadeSummary } — so a bad delete is
// recoverable by hand from the /ai proposal row even though there is
// no undo button. Refusals (missing row, non-empty category/section,
// unarchived guest) throw BEFORE the snapshot is written, so the
// caller's claim-rollback leaves a clean PENDING proposal.
//
// Permissions compose: the caller gates ai_write; each handler gates
// the entity's own section with canEdit. budget/payment kinds are
// couple-only end to end — canEdit() hard-denies non-couple users on
// COUPLE_ONLY_SECTIONS, mirroring the money apply module where the
// underlying actions' requireEdit("budget"/"payments") does the same.

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { canEdit, type Section } from "@/lib/permissions";
// Type-only import — erased at compile time, so this module never
// pulls the @/auth graph into the MCP route bundle (same convention
// as src/lib/core/*).
import type { SessionUser } from "@/lib/actions";
import {
  bookCardDeleteSchema,
  bookSectionDeleteSchema,
  budgetCategoryDeleteSchema,
  budgetLineDeleteSchema,
  eventDeleteSchema,
  guestHardDeleteSchema,
  paymentDeleteSchema,
  seatingTableDeleteSchema,
  songRemoveSchema,
  supplierContactRemoveSchema,
  supplierDeleteSchema,
  taskDeleteSchema,
} from "@/lib/ai/proposals/schemas";
import { assertBookCardWritable } from "@/lib/ai/apply/common";

/** Session-free twin of requireEdit(section) — same error text, but
 *  the user comes from the caller instead of the session. */
async function requireSectionEdit(user: SessionUser, section: Section): Promise<void> {
  if (!(await canEdit(user, section))) {
    throw new Error(`Forbidden: no edit access to ${section}`);
  }
}

/** Prisma rows aren't Json-column-safe as-is (Date, Decimal). One
 *  JSON round-trip normalises both (Date → ISO string, Decimal →
 *  numeric string via its toJSON) so the snapshot stores cleanly. */
function toSnapshotJson(entity: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(entity)) as Prisma.InputJsonValue;
}

/** Write the recovery snapshot onto the proposal row. Called after
 *  every refusal check has passed and immediately BEFORE the delete —
 *  if the delete itself then fails, the claim rollback leaves a
 *  PENDING proposal whose stale metadata is overwritten on retry. */
async function writeSnapshot(
  proposalId: string,
  entity: unknown,
  cascadeSummary: string,
): Promise<void> {
  await db.aiProposal.update({
    where: { id: proposalId },
    data: {
      metadata: {
        deletedSnapshot: toSnapshotJson(entity),
        deletedAt: new Date().toISOString(),
        cascadeSummary,
      },
    },
  });
}

const decimalToNumber = (d: { toString(): string } | null | undefined): number | null =>
  d == null ? null : Number(d.toString());

// ─── Tasks + schedule ───────────────────────────────────────────────

async function applyTaskDelete(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = taskDeleteSchema.parse(payload);
  const task = await db.task.findUnique({
    where: { id: parsed.taskId },
    include: {
      assignees: { select: { id: true } },
      bookSections: { select: { id: true } },
      bookSubsections: { select: { id: true } },
      navTags: { select: { id: true } },
      guestGroups: { select: { id: true } },
      children: { select: { id: true, title: true } },
    },
  });
  if (!task) {
    throw new Error("Task not found — it may have been deleted since the proposal was made.");
  }
  // Same polymorphic dispatch as deleteTask — gate by the row's type
  // rather than blanket EDIT(tasks).
  const section = task.type === "TASK" ? "tasks" : "questions";
  await requireSectionEdit(user, section);

  const cascadeSummary = task.children.length
    ? `${task.children.length} subtask(s) kept — their parent link is cleared`
    : "no dependent rows";
  await writeSnapshot(proposalId, task, cascadeSummary);
  await db.task.delete({ where: { id: parsed.taskId } });
  await logAudit({
    userId: user.id,
    action: "delete",
    entity: "Task",
    entityId: parsed.taskId,
    metadata: {
      title: task.title,
      type: task.type,
      summary: `Deleted task "${task.title}" — ${cascadeSummary}`,
      proposalId,
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/questions");
  revalidatePath("/");
  return { id: parsed.taskId };
}

async function applyEventDelete(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = eventDeleteSchema.parse(payload);
  await requireSectionEdit(user, "schedule");
  const event = await db.scheduleEvent.findUnique({ where: { id: parsed.eventId } });
  if (!event) {
    throw new Error(
      "Schedule event not found — it may have been deleted since the proposal was made.",
    );
  }

  await writeSnapshot(proposalId, event, "no dependent rows");
  await db.scheduleEvent.delete({ where: { id: parsed.eventId } });
  await logAudit({
    userId: user.id,
    action: "delete",
    entity: "ScheduleEvent",
    entityId: parsed.eventId,
    metadata: {
      title: event.title,
      startTime: event.startTime.toISOString(),
      summary: `Deleted schedule event "${event.title}"`,
      proposalId,
    },
  });
  revalidatePath("/schedule");
  revalidatePath("/");
  return { id: parsed.eventId };
}

// ─── Guests ─────────────────────────────────────────────────────────

async function applyGuestHardDelete(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = guestHardDeleteSchema.parse(payload);
  await requireSectionEdit(user, "guests");
  // Mirrors hardDeleteGuest: EDIT(guests) alone isn't enough — the
  // hard delete is couple-only on top, and the denial is audited the
  // same way so probes stay visible.
  if (!user.isCouple) {
    await logAudit({
      userId: user.id,
      action: "guests_denied",
      entity: "Guest",
      entityId: parsed.guestId,
      metadata: { reason: "not_couple", target_action: "guest.hard_delete" },
    });
    throw new Error("Forbidden: only the couple can permanently delete a guest");
  }
  const guest = await db.guest.findUnique({
    where: { id: parsed.guestId },
    include: {
      household: { select: { id: true, name: true } },
      plusOnes: true,
      songRequests: true,
      groups: { select: { id: true, name: true } },
    },
  });
  if (!guest) {
    throw new Error("Guest not found — they may have been removed since the proposal was made.");
  }
  if (!guest.archived) {
    throw new Error(
      "Archive the guest first; only archived guests can be permanently deleted.",
    );
  }

  const cascadeBits = ["household row kept"];
  if (guest.plusOnes.length) {
    cascadeBits.push(`${guest.plusOnes.length} plus-one row(s) cascade-deleted`);
  }
  if (guest.songRequests.length) {
    cascadeBits.push(`${guest.songRequests.length} song request(s) cascade-deleted`);
  }
  const cascadeSummary = cascadeBits.join(" · ");
  await writeSnapshot(proposalId, guest, cascadeSummary);
  await db.guest.delete({ where: { id: parsed.guestId } });
  await logAudit({
    userId: user.id,
    action: "hard_delete",
    entity: "Guest",
    entityId: parsed.guestId,
    metadata: {
      firstName: guest.firstName,
      lastName: guest.lastName,
      summary: `Hard-deleted guest "${`${guest.firstName} ${guest.lastName}`.trim()}" — ${cascadeSummary}`,
      proposalId,
    },
  });
  revalidatePath("/guests");
  revalidatePath("/");
  return { id: parsed.guestId };
}

// ─── Suppliers ──────────────────────────────────────────────────────

async function applySupplierDelete(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = supplierDeleteSchema.parse(payload);
  await requireSectionEdit(user, "suppliers");
  const supplier = await db.supplier.findUnique({
    where: { id: parsed.supplierId },
    include: {
      contacts: true,
      contracts: true,
      communications: true,
      _count: { select: { payments: true, tasks: true } },
    },
  });
  if (!supplier) {
    throw new Error(
      "Supplier not found — it may have been deleted since the proposal was made.",
    );
  }

  const cascadeSummary = [
    `${supplier.contacts.length} contact(s), ${supplier.contracts.length} contract(s) and ${supplier.communications.length} communication(s) cascade-deleted`,
    `${supplier._count.payments} payment(s) and ${supplier._count.tasks} task(s) kept — their supplier link is cleared`,
  ].join(" · ");
  await writeSnapshot(proposalId, supplier, cascadeSummary);
  await db.supplier.delete({ where: { id: parsed.supplierId } });
  await logAudit({
    userId: user.id,
    action: "delete",
    entity: "Supplier",
    entityId: parsed.supplierId,
    metadata: {
      name: supplier.name,
      category: supplier.category,
      status: supplier.status,
      contactCount: supplier.contacts.length,
      contractCount: supplier.contracts.length,
      paymentCount: supplier._count.payments,
      summary: `Deleted supplier "${supplier.name}" — ${cascadeSummary}`,
      proposalId,
    },
  });
  revalidatePath("/suppliers");
  return { id: parsed.supplierId };
}

async function applySupplierContactRemove(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = supplierContactRemoveSchema.parse(payload);
  await requireSectionEdit(user, "suppliers");
  const contact = await db.supplierContact.findUnique({
    where: { id: parsed.contactId },
    include: { supplier: { select: { id: true, name: true } } },
  });
  if (!contact) {
    throw new Error(
      "Supplier contact not found — it may have been removed since the proposal was made.",
    );
  }

  await writeSnapshot(proposalId, contact, "no dependent rows");
  await db.supplierContact.delete({ where: { id: parsed.contactId } });
  await logAudit({
    userId: user.id,
    action: "delete",
    entity: "SupplierContact",
    entityId: parsed.contactId,
    metadata: {
      supplierId: contact.supplier.id,
      supplierName: contact.supplier.name,
      contactName: contact.name,
      role: contact.role,
      summary: `Removed contact "${contact.name}" from supplier "${contact.supplier.name}"`,
      proposalId,
    },
  });
  revalidatePath(`/suppliers/${contact.supplier.id}`);
  revalidatePath("/today/day-of");
  return { id: parsed.contactId };
}

// ─── Money (couple-only via COUPLE_ONLY_SECTIONS) ───────────────────

async function applyPaymentDelete(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = paymentDeleteSchema.parse(payload);
  await requireSectionEdit(user, "payments");
  const payment = await db.payment.findUnique({
    where: { id: parsed.paymentId },
    include: { supplier: { select: { name: true } } },
  });
  if (!payment) {
    throw new Error(
      "Payment not found — it may have been deleted since the proposal was made.",
    );
  }

  await writeSnapshot(proposalId, payment, "no dependent rows");
  await db.payment.delete({ where: { id: parsed.paymentId } });
  await logAudit({
    userId: user.id,
    action: "delete",
    entity: "Payment",
    entityId: parsed.paymentId,
    metadata: {
      description: payment.description,
      amount: decimalToNumber(payment.amount),
      status: payment.status,
      dueDate: payment.dueDate,
      supplierName: payment.supplier?.name ?? null,
      summary: `Deleted payment "${payment.description}"`,
      proposalId,
    },
  });
  revalidatePath("/payments");
  return { id: parsed.paymentId };
}

async function applyBudgetLineDelete(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = budgetLineDeleteSchema.parse(payload);
  await requireSectionEdit(user, "budget");
  const line = await db.budgetLine.findUnique({
    where: { id: parsed.lineId },
    include: {
      category: { select: { name: true } },
      components: true,
      _count: { select: { payments: true } },
    },
  });
  if (!line) {
    throw new Error(
      "Budget line not found — it may have been deleted since the proposal was made.",
    );
  }

  const cascadeBits: string[] = [];
  if (line.components.length) {
    cascadeBits.push(`${line.components.length} component(s) cascade-deleted`);
  }
  if (line._count.payments) {
    cascadeBits.push(`${line._count.payments} payment(s) kept — their line link is cleared`);
  }
  const cascadeSummary = cascadeBits.join(" · ") || "no dependent rows";
  await writeSnapshot(proposalId, line, cascadeSummary);
  await db.budgetLine.delete({ where: { id: parsed.lineId } });
  await logAudit({
    userId: user.id,
    action: "delete",
    entity: "BudgetLine",
    entityId: parsed.lineId,
    metadata: {
      description: line.description,
      categoryName: line.category.name,
      estimated: decimalToNumber(line.estimated),
      actual: decimalToNumber(line.actual),
      paid: decimalToNumber(line.paid),
      summary: `Deleted budget line "${line.description}" — ${cascadeSummary}`,
      proposalId,
    },
  });
  revalidatePath("/budget");
  return { id: parsed.lineId };
}

async function applyBudgetCategoryDelete(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = budgetCategoryDeleteSchema.parse(payload);
  await requireSectionEdit(user, "budget");
  const category = await db.budgetCategory.findUnique({
    where: { id: parsed.categoryId },
    include: { _count: { select: { lines: true } } },
  });
  if (!category) {
    throw new Error(
      "Budget category not found — it may have been deleted since the proposal was made.",
    );
  }
  // Same refusal (and message) as deleteCategory: emptying a category
  // is a separate, visible set of budget.line.delete proposals — never
  // an implicit cascade.
  if (category._count.lines > 0) {
    throw new Error(
      `Can't delete "${category.name}" — ${category._count.lines} line${category._count.lines === 1 ? "" : "s"} still in this category.`,
    );
  }

  await writeSnapshot(proposalId, category, "empty category — no dependent rows");
  await db.budgetCategory.delete({ where: { id: parsed.categoryId } });
  await logAudit({
    userId: user.id,
    action: "delete",
    entity: "BudgetCategory",
    entityId: parsed.categoryId,
    metadata: {
      name: category.name,
      lineCount: 0,
      summary: `Deleted empty budget category "${category.name}"`,
      proposalId,
    },
  });
  revalidatePath("/budget");
  return { id: parsed.categoryId };
}

// ─── Wedding Book ───────────────────────────────────────────────────

async function applyBookCardDelete(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = bookCardDeleteSchema.parse(payload);
  await requireSectionEdit(user, "book");
  // COUPLE_ONLY wall — the human delete never checks visibility
  // because the UI hides couple-only cards; the AI path must.
  await assertBookCardWritable(user, parsed.subsectionId);
  // The snapshot carries every per-kind child so a MENU/BUILD/etc card
  // is restorable with its structured rows, not just its title.
  const card = await db.bookSubsection.findUnique({
    where: { id: parsed.subsectionId },
    include: {
      section: { select: { id: true, slug: true, title: true } },
      fieldDefs: true,
      recipe: { include: { recipeSteps: true } },
      shotList: { include: { shots: true } },
      outfitCard: { include: { outfits: true } },
      buildCard: { include: { materials: true, sessions: true } },
      menuCard: { include: { courses: { include: { options: true } } } },
      barCard: { include: { items: true } },
      setupCard: { include: { items: true } },
      stayCard: true,
      lodgingCard: { include: { items: true } },
      dressCodeCard: true,
      // Cells ride under members (each carries its memberId + itemId),
      // so the full matrix is reconstructable from this shape.
      weddingPartyCard: {
        include: { members: { include: { cells: true } }, items: true },
      },
    },
  });
  if (!card) {
    throw new Error("Book card not found — it may have been deleted since the proposal was made.");
  }

  await writeSnapshot(
    proposalId,
    card,
    "all structured card content (fields, items, steps, rows) cascade-deleted",
  );
  await db.bookSubsection.delete({ where: { id: parsed.subsectionId } });
  await logAudit({
    userId: user.id,
    action: "delete",
    entity: "BookSubsection",
    entityId: parsed.subsectionId,
    metadata: {
      title: card.title,
      kind: card.kind,
      sectionSlug: card.section.slug,
      summary: `Deleted ${card.kind} card "${card.title}" on ${card.section.slug}`,
      proposalId,
    },
  });
  revalidatePath("/book");
  revalidatePath(`/book/${card.section.slug}`);
  return { id: parsed.subsectionId };
}

async function applyBookSectionDelete(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = bookSectionDeleteSchema.parse(payload);
  await requireSectionEdit(user, "book");
  const section = await db.bookSection.findUnique({
    where: { id: parsed.sectionId },
    include: { _count: { select: { subsections: true } } },
  });
  if (!section) {
    throw new Error(
      "Book section not found — it may have been deleted since the proposal was made.",
    );
  }
  // Mirror of assertBookCardWritable at section level — non-couple
  // ai_write holders never touch couple-only book content.
  if (!user.isCouple && section.visibility === "COUPLE_ONLY") {
    throw new Error("This section is couple-only — only the couple can apply changes to it.");
  }
  // Same no-implicit-cascade rule as budget.category.delete: deleting
  // a section with cards would silently nuke every card on it.
  if (section._count.subsections > 0) {
    throw new Error(
      `Can't delete "${section.title}" — ${section._count.subsections} card${section._count.subsections === 1 ? "" : "s"} still in this section.`,
    );
  }

  await writeSnapshot(proposalId, section, "empty section — no dependent rows");
  await db.bookSection.delete({ where: { id: parsed.sectionId } });
  await logAudit({
    userId: user.id,
    action: "delete",
    entity: "BookSection",
    entityId: parsed.sectionId,
    metadata: {
      slug: section.slug,
      title: section.title,
      subsectionCount: 0,
      summary: `Deleted empty book section "${section.title}"`,
      proposalId,
    },
  });
  revalidatePath("/book");
  return { id: parsed.sectionId };
}

// ─── Songs + seating ────────────────────────────────────────────────

async function applySongRemove(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = songRemoveSchema.parse(payload);
  await requireSectionEdit(user, "songs");
  const song = await db.song.findUnique({
    where: { id: parsed.songId },
    include: { playlist: { select: { name: true } } },
  });
  if (!song) {
    throw new Error("Song not found — it may have been removed since the proposal was made.");
  }

  await writeSnapshot(proposalId, song, "no dependent rows");
  await db.song.delete({ where: { id: parsed.songId } });
  await logAudit({
    userId: user.id,
    action: "delete",
    entity: "Song",
    entityId: parsed.songId,
    metadata: {
      title: song.title,
      artist: song.artist,
      playlistName: song.playlist.name,
      summary: `Removed "${song.title}" from playlist "${song.playlist.name}"`,
      proposalId,
    },
  });
  revalidatePath("/songs");
  return { id: parsed.songId };
}

async function applySeatingTableDelete(
  user: SessionUser,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  const parsed = seatingTableDeleteSchema.parse(payload);
  await requireSectionEdit(user, "seating");
  // Occupant names go into the snapshot so the who-sat-where
  // arrangement is restorable, not just the table geometry.
  const table = await db.table.findUnique({
    where: { id: parsed.tableId },
    include: {
      seats: {
        orderBy: { index: "asc" },
        include: { guest: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
  if (!table) {
    throw new Error("Table not found — it may have been deleted since the proposal was made.");
  }
  const occupiedCount = table.seats.filter((s) => s.guest).length;

  // Guests are never deleted here: seats cascade with the table and
  // Guest.tableSeatId is SetNull, so occupants land back in the
  // unseated pool — identical to the human deleteTable.
  const cascadeSummary = occupiedCount
    ? `${table.seats.length} seat(s) deleted · ${occupiedCount} guest(s) unseated (kept)`
    : `${table.seats.length} seat(s) deleted · no guests were seated here`;
  await writeSnapshot(proposalId, table, cascadeSummary);
  await db.table.delete({ where: { id: parsed.tableId } });
  await logAudit({
    userId: user.id,
    action: "delete",
    entity: "Table",
    entityId: parsed.tableId,
    metadata: {
      name: table.name,
      shape: table.shape,
      capacity: table.capacity,
      occupiedCount,
      summary: `Deleted table "${table.name}" — ${cascadeSummary}`,
      proposalId,
    },
  });
  revalidatePath("/seating");
  return { id: parsed.tableId };
}

// ─── Dispatch ───────────────────────────────────────────────────────

/** Apply one destructive proposal. Re-parses the payload against its
 *  kind's schema, gates the entity's section, snapshots the entity
 *  onto the proposal row, then deletes — mirroring the matching human
 *  delete action. Throws on any refusal so the caller's claim-rollback
 *  fires and the proposal stays PENDING. */
export async function applyDeleteProposal(
  user: SessionUser,
  kind: string,
  payload: unknown,
  proposalId: string,
): Promise<{ id: string }> {
  switch (kind) {
    case "task.delete":
      return applyTaskDelete(user, payload, proposalId);
    case "event.delete":
      return applyEventDelete(user, payload, proposalId);
    case "guest.hard_delete":
      return applyGuestHardDelete(user, payload, proposalId);
    case "supplier.delete":
      return applySupplierDelete(user, payload, proposalId);
    case "supplier.contact_remove":
      return applySupplierContactRemove(user, payload, proposalId);
    case "payment.delete":
      return applyPaymentDelete(user, payload, proposalId);
    case "budget.line.delete":
      return applyBudgetLineDelete(user, payload, proposalId);
    case "budget.category.delete":
      return applyBudgetCategoryDelete(user, payload, proposalId);
    case "book.card.delete":
      return applyBookCardDelete(user, payload, proposalId);
    case "book.section.delete":
      return applyBookSectionDelete(user, payload, proposalId);
    case "song.remove":
      return applySongRemove(user, payload, proposalId);
    case "seating.table.delete":
      return applySeatingTableDelete(user, payload, proposalId);
    default:
      throw new Error(`Unknown delete proposal kind: ${kind}`);
  }
}
