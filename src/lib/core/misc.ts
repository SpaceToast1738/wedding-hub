// v2.8.0: session-free cores for the "misc" write surface (T1
// self-apply) — question answers, playlist songs, custom-field values
// and seat assignments.
//
// The MCP agent applies question.answer / song.add / custom_field.set /
// seat.assign proposals over token auth — no Auth.js session exists on
// that path, so the entity-writing halves of the underlying actions
// (answerQuestion, createSong, setGuestCustomField / setTaskCustomField
// / setSupplierCustomField, assignGuestToSeat) can't live behind
// `requireEdit()` in a "use server" file. They live here instead,
// taking an explicit `user: SessionUser`.
//
// Contract (same as src/lib/core/{tasks,guests,suppliers}.ts):
// - No auth here. Callers own the gate: the server-action wrappers in
//   tasks/songs/guests/suppliers/seating actions.ts run
//   requireEdit(section) before delegating; the AI apply dispatch
//   (src/lib/ai/apply/misc.ts) re-asserts the section with canEdit.
//   NEVER export these from a "use server" file — every export there
//   becomes a client-invokable action, and a core that takes `user` as
//   a parameter instead of reading the session would be a forged-user
//   endpoint if the network could reach it.
// - Cores keep EVERYTHING after the parse/gate: db reads/writes,
//   validation, audit rows and revalidatePath calls — human flows
//   through the wrappers stay byte-identical.
// - Cores value-import from @/lib/audit (logAudit) and
//   @/lib/custom-fields (a pure helper lib) only — NEVER from
//   @/lib/actions, whose audit() helper would drag the @/auth
//   (next-auth) graph into the isolated MCP tool-registry seam.
//   logAudit({ userId: user.id, ... }) is byte-identical to the
//   audit(user, ...) helper it replaces.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, TableShape, TaskStatus } from "@prisma/client";
import { db } from "@/lib/db";
// Type-only import — erased at compile time, so the cores never pull
// the @/auth module graph into the MCP route bundle.
import type { SessionUser } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import {
  parseCustomFieldValue,
  mergeCustomFieldValue,
  type CustomFieldDef,
  type CustomFieldType,
  type CustomFieldValues,
} from "@/lib/custom-fields";

// ── question.answer ──────────────────────────────────────────────────
// v2.8.0: extracted body of answerQuestion (tasks/actions.ts). The
// wrapper gates requireEdit("questions"); the AI apply path gates
// canEdit(user, "questions"). Read-before for the audit diff, the
// answer-empty → OPEN / non-empty → DONE status flip, the enriched
// audit row and the three revalidations all live here so both callers
// run identical write behaviour.
export async function answerQuestionCore(
  user: SessionUser,
  id: string,
  answer: string,
): Promise<void> {
  // Read before so the audit row captures the question title + whether
  // an answer was added or cleared.
  const before = await db.task.findUnique({
    where: { id },
    select: { title: true, type: true, questionAnswer: true },
  });
  await db.task.update({
    where: { id },
    data: {
      questionAnswer: answer,
      status: answer.trim() ? TaskStatus.DONE : TaskStatus.OPEN,
    },
  });
  await logAudit({
    userId: user.id,
    action: "answer",
    entity: "Task",
    entityId: id,
    metadata: {
      title: before?.title ?? null,
      type: before?.type ?? null,
      hadPreviousAnswer: !!before?.questionAnswer?.trim(),
      cleared: !answer.trim(),
      answerLength: answer.length,
    },
  });
  revalidatePath("/questions");
  revalidatePath("/tasks");
  revalidatePath("/");
}

// ── song.add ─────────────────────────────────────────────────────────
// v2.8.0: moved here (exported) from songs/actions.ts so the wrapper and
// the AI apply path validate against the SAME shape. Named *InputSchema
// to stay visually distinct from the AI payload schemas in
// src/lib/ai/proposals/schemas.ts (songAddSchema etc.). Byte-identical
// to the old module-private songSchema.
export const songInputSchema = z.object({
  playlistId: z.string().min(1),
  title: z.string().min(1).max(200),
  artist: z.string().max(200).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
});
export type SongInput = z.infer<typeof songInputSchema>;

// v2.8.0: extracted body of createSong (songs/actions.ts). The wrapper
// gates requireEdit("songs"); the AI apply path gates
// canEdit(user, "songs"). Keeps the append-at-end order computation,
// the playlist-name lookup for the audit row and the revalidation.
export async function createSongCore(
  user: SessionUser,
  parsed: SongInput,
): Promise<{ id: string }> {
  const last = await db.song.findFirst({
    where: { playlistId: parsed.playlistId },
    orderBy: { order: "desc" },
  });
  const created = await db.song.create({
    data: {
      playlistId: parsed.playlistId,
      title: parsed.title,
      artist: parsed.artist ?? null,
      source: parsed.source ?? null,
      order: (last?.order ?? -1) + 1,
    },
  });
  // Lookup playlist name once so the audit row reads as
  // "Added <song> to <playlist>" rather than just an id.
  const playlist = await db.playlist.findUnique({
    where: { id: parsed.playlistId },
    select: { name: true },
  });
  await logAudit({
    userId: user.id,
    action: "create",
    entity: "Song",
    entityId: created.id,
    metadata: {
      title: created.title,
      artist: created.artist,
      playlistId: created.playlistId,
      playlistName: playlist?.name ?? null,
    },
  });
  revalidatePath("/songs");
  // v2.4.0: return the id so the AI apply path can link the row.
  return { id: created.id };
}

// ── custom_field.set (per entity) ────────────────────────────────────
// Three cores mirroring the human setGuestCustomField /
// setTaskCustomField / setSupplierCustomField. Each omits ONLY the
// requireEdit gate (the wrapper / apply path owns it) — every other
// step (def entity-mismatch refusal, entity-existence + archived
// refusals, parseCustomFieldValue type validation, single-key merge,
// audit row, revalidate) is byte-identical.

export async function setGuestCustomFieldCore(
  user: SessionUser,
  guestId: string,
  fieldId: string,
  rawValue: string | null,
): Promise<void> {
  const def = await db.customField.findUnique({ where: { id: fieldId } });
  if (!def || def.entity !== "guest") {
    throw new Error("Custom field not found for this entity");
  }
  const guest = await db.guest.findUnique({
    where: { id: guestId },
    select: { customFieldValues: true, archived: true },
  });
  if (!guest) throw new Error("Guest not found");
  if (guest.archived) throw new Error("Guest is archived");

  const typedDef: CustomFieldDef = {
    id: def.id,
    entity: def.entity,
    name: def.name,
    type: def.type as CustomFieldType,
    options: def.options,
    order: def.order,
  };
  const value = parseCustomFieldValue(typedDef, rawValue);
  const next = mergeCustomFieldValue(
    (guest.customFieldValues as CustomFieldValues | null) ?? null,
    fieldId,
    value,
  );
  await db.guest.update({
    where: { id: guestId },
    data: { customFieldValues: next },
  });
  await logAudit({
    userId: user.id,
    action: "update",
    entity: "Guest",
    entityId: guestId,
    metadata: { customField: def.name, fieldId },
  });
  revalidatePath(`/guests/${guestId}`);
}

export async function setSupplierCustomFieldCore(
  user: SessionUser,
  supplierId: string,
  fieldId: string,
  rawValue: string | null,
): Promise<void> {
  const def = await db.customField.findUnique({ where: { id: fieldId } });
  if (!def || def.entity !== "supplier") {
    throw new Error("Custom field not found for this entity");
  }
  const supplier = await db.supplier.findUnique({
    where: { id: supplierId },
    select: { customFieldValues: true },
  });
  if (!supplier) throw new Error("Supplier not found");

  const typedDef: CustomFieldDef = {
    id: def.id,
    entity: def.entity,
    name: def.name,
    type: def.type as CustomFieldType,
    options: def.options,
    order: def.order,
  };
  const value = parseCustomFieldValue(typedDef, rawValue);
  const next = mergeCustomFieldValue(
    (supplier.customFieldValues as CustomFieldValues | null) ?? null,
    fieldId,
    value,
  );
  await db.supplier.update({
    where: { id: supplierId },
    data: { customFieldValues: next },
  });
  await logAudit({
    userId: user.id,
    action: "update",
    entity: "Supplier",
    entityId: supplierId,
    metadata: { customField: def.name, fieldId },
  });
  revalidatePath(`/suppliers/${supplierId}`);
}

// The task variant is polymorphic: the caller derives the section
// (tasks vs questions) from the row's type and gates that before
// delegating. The core re-reads type + customFieldValues (the type is
// needed for the audit metadata), and throws "Task not found" for a
// missing row — matching the human action's own not-found throw.
export async function setTaskCustomFieldCore(
  user: SessionUser,
  taskId: string,
  fieldId: string,
  rawValue: string | null,
): Promise<void> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { type: true, customFieldValues: true },
  });
  if (!task) throw new Error("Task not found");

  const def = await db.customField.findUnique({ where: { id: fieldId } });
  if (!def || def.entity !== "task") {
    throw new Error("Custom field not found for this entity");
  }
  const typedDef: CustomFieldDef = {
    id: def.id,
    entity: def.entity,
    name: def.name,
    type: def.type as CustomFieldType,
    options: def.options,
    order: def.order,
  };
  const value = parseCustomFieldValue(typedDef, rawValue);
  const next = mergeCustomFieldValue(
    (task.customFieldValues as CustomFieldValues | null) ?? null,
    fieldId,
    value,
  );
  await db.task.update({
    where: { id: taskId },
    data: { customFieldValues: next },
  });
  await logAudit({
    userId: user.id,
    action: "update",
    entity: "Task",
    entityId: taskId,
    metadata: { customField: def.name, fieldId, type: task.type },
  });
  revalidatePath("/tasks");
  revalidatePath("/questions");
}

// ── seat.assign ──────────────────────────────────────────────────────
// v2.8.0: extracted body of assignGuestToSeat (seating/actions.ts). The
// wrapper / apply path gates requireEdit("seating"). Keeps the
// unique-constraint-safe clear-and-assign transaction, the post-write
// name/table snapshot for the audit row, and the assign/unassign action
// dispatch. NB the caller (both human and AI apply) owns the occupancy /
// archived / attending refusals — this core is the raw write, same as
// the original action, which silently evicts a prior occupant.
export async function assignGuestToSeatCore(
  user: SessionUser,
  seatId: string,
  guestId: string | null,
): Promise<void> {
  // B12 (v1.12.0): wrap clear-and-assign in a single transaction so two
  // simultaneous drags can't both think they own the seat for a moment.
  // The `Guest.tableSeatId` column has a unique constraint, so the
  // *second* offender will fail noisily inside the transaction rather
  // than producing a half-applied state. Either both updates land or
  // neither.
  if (guestId) {
    await db.$transaction([
      db.guest.updateMany({
        where: { tableSeatId: seatId, NOT: { id: guestId } },
        data: { tableSeatId: null },
      }),
      db.guest.update({ where: { id: guestId }, data: { tableSeatId: seatId } }),
    ]);
  } else {
    await db.guest.updateMany({ where: { tableSeatId: seatId }, data: { tableSeatId: null } });
  }
  // v1.39.0: enrich the audit with guest + seat snapshot fields so
  // the log reads as "Seated <Guest> at <Table> seat 3" rather than
  // bare ids. We look up the guest's name + table info post-write
  // because the relevant join wasn't loaded above.
  let guestName: string | null = null;
  let tableName: string | null = null;
  let seatIndex: number | null = null;
  const seat = await db.seat.findUnique({
    where: { id: seatId },
    include: { table: { select: { name: true } } },
  });
  tableName = seat?.table.name ?? null;
  seatIndex = seat?.index ?? null;
  if (guestId) {
    const g = await db.guest.findUnique({
      where: { id: guestId },
      select: { firstName: true, lastName: true },
    });
    guestName = g ? [g.firstName, g.lastName].filter(Boolean).join(" ") : null;
  }
  await logAudit({
    userId: user.id,
    action: guestId ? "assign" : "unassign",
    entity: "Seat",
    entityId: seatId,
    metadata: {
      guestId,
      guestName,
      tableName,
      seatIndex,
    },
  });
  revalidatePath("/seating");
}

// ── seat.unassign ─────────────────────────────────────────────────────
// v2.8.1: free a seat — a thin, named wrapper over assignGuestToSeatCore
// with a null guest. Kept as its own export so the AI apply path reads
// symmetrically alongside assignGuestToSeatCore and the slice can report
// a clean core name. Byte-identical to the human assignGuestToSeat(seatId,
// null): the updateMany clears the occupant, the audit action is
// "unassign" and the /seating revalidation all live in the shared core.
export async function unassignSeatCore(
  user: SessionUser,
  seatId: string,
): Promise<void> {
  await assignGuestToSeatCore(user, seatId, null);
}

// ── seat.swap ─────────────────────────────────────────────────────────
// v1.70.0 shape re-exported for the seating/actions.ts wrapper + the AI
// apply path (a "use server" file can still re-export a type). v2.8.1:
// SwapResult is now declared here because swapSeatsCore lives here.
export type SwapResult = { ok: true } | { ok: false; error: string };

// v2.8.1: extracted body of swapSeats (seating/actions.ts). The wrapper
// keeps the requireEdit("seating") gate + the identical-seat short
// circuit before the gate; the AI apply path gates canEdit then calls in.
// Same-table exchange only, no eviction of a bystander: the sequential
// null-out-then-reassign transaction (unique-constraint safe), the audit
// row and the /seating revalidation are preserved verbatim.
export async function swapSeatsCore(
  user: SessionUser,
  seatId1: string,
  seatId2: string,
): Promise<SwapResult> {
  // Defensive identical-seat short circuit for the AI apply path — the
  // human wrapper already returns before the gate on identical ids, and
  // the propose tool refuses identical pairs, so this is belt-and-braces.
  if (seatId1 === seatId2) return { ok: true };

  const [seat1, seat2] = await Promise.all([
    db.seat.findUnique({
      where: { id: seatId1 },
      select: {
        index: true,
        tableId: true,
        table: { select: { name: true } },
        guest: { select: { id: true } },
      },
    }),
    db.seat.findUnique({
      where: { id: seatId2 },
      select: {
        index: true,
        tableId: true,
        guest: { select: { id: true } },
      },
    }),
  ]);

  if (!seat1 || !seat2) return { ok: false, error: "Seat not found" };
  if (seat1.tableId !== seat2.tableId)
    return { ok: false, error: "Seats must be on the same table" };

  const guest1 = seat1.guest;
  const guest2 = seat2.guest;
  if (!guest1 && !guest2) return { ok: true };

  // Null out both occupants first, then assign to swapped seats.
  // Sequential within one $transaction satisfies the Guest.tableSeatId
  // unique constraint at each step without needing deferred constraints.
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (guest1) ops.push(db.guest.update({ where: { id: guest1.id }, data: { tableSeatId: null } }));
  if (guest2) ops.push(db.guest.update({ where: { id: guest2.id }, data: { tableSeatId: null } }));
  if (guest1) ops.push(db.guest.update({ where: { id: guest1.id }, data: { tableSeatId: seatId2 } }));
  if (guest2) ops.push(db.guest.update({ where: { id: guest2.id }, data: { tableSeatId: seatId1 } }));
  await db.$transaction(ops);

  await logAudit({
    userId: user.id,
    action: "swap",
    entity: "Seat",
    entityId: seatId1,
    metadata: {
      tableName: seat1.table.name,
      seatIndex1: seat1.index,
      seatIndex2: seat2.index,
      guest1Id: guest1?.id ?? null,
      guest2Id: guest2?.id ?? null,
    },
  });

  revalidatePath("/seating");
  return { ok: true };
}

// ── seating.table.create ──────────────────────────────────────────────
// v2.8.1: extracted body of createTable (seating/actions.ts). The wrapper
// keeps the FormData parse + requireEdit("seating") gate; the AI apply
// path gates canEdit then calls in. The 3-column auto-grid placement, the
// N-empty-seat createMany, the audit row and the /seating revalidation
// all live here so both callers write identically.

// New tables drop into the canvas in a 3-column grid based on how many
// already exist — keeps them from stacking at (0,0), the schema default.
function nextGridPosition(existingCount: number): { posX: number; posY: number } {
  const cols = 3;
  const colWidth = 280;
  const rowHeight = 240;
  const startX = 180;
  const startY = 160;
  const col = existingCount % cols;
  const row = Math.floor(existingCount / cols);
  return { posX: startX + col * colWidth, posY: startY + row * rowHeight };
}

// Named *InputSchema to stay visually distinct from the AI payload schema
// (seatingTableCreateSchema). Byte-identical to the old module-private
// tableSchema in seating/actions.ts.
export const tableCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  shape: z.nativeEnum(TableShape).default(TableShape.ROUND),
  capacity: z.coerce.number().int().min(1).max(40),
});
export type TableCreateInput = z.infer<typeof tableCreateInputSchema>;

export async function createTableCore(
  user: SessionUser,
  parsed: TableCreateInput,
): Promise<{ id: string }> {
  const existing = await db.table.count();
  const { posX, posY } = nextGridPosition(existing);

  const table = await db.table.create({
    data: {
      name: parsed.name,
      shape: parsed.shape,
      capacity: parsed.capacity,
      posX,
      posY,
    },
  });
  await db.seat.createMany({
    data: Array.from({ length: parsed.capacity }, (_, i) => ({
      tableId: table.id,
      index: i,
    })),
  });
  await logAudit({
    userId: user.id,
    action: "create",
    entity: "Table",
    entityId: table.id,
    metadata: {
      name: table.name,
      shape: table.shape,
      capacity: table.capacity,
    },
  });
  revalidatePath("/seating");
  // v2.8.1: return the id so the AI apply-bridge can report the new row.
  return { id: table.id };
}

// ── seating.table.update ──────────────────────────────────────────────
// v2.8.1: extracted bodies of updateTableCapacity / updateTablePosition /
// updateTableNotes. The wrappers keep the requireEdit("seating") gate;
// the AI apply path gates canEdit then dispatches whichever fields the
// payload carries. Name + shape are deliberately NOT extractable here —
// no clean human mutator exists for them, so the AI update surface omits
// them (see seatingTableUpdateSchema).

// v1.22.9 shape: returns a result instead of throwing (Next production
// mode redacts thrown errors into the scary generic overlay).
export type CapacityResult = { ok: true } | { ok: false; error: string };

const capacityInputSchema = z.object({
  newCapacity: z.coerce.number().int().min(1).max(40),
});

export async function updateTableCapacityCore(
  user: SessionUser,
  id: string,
  newCapacity: number,
): Promise<CapacityResult> {
  const parsed = capacityInputSchema.parse({ newCapacity });
  const table = await db.table.findUnique({
    where: { id },
    include: { seats: { include: { guest: { select: { id: true } } } } },
  });
  if (!table) return { ok: false, error: "Table not found" };
  const current = table.capacity;
  const target = parsed.newCapacity;
  if (target === current) return { ok: true };

  if (target > current) {
    // Append seats with indices [current..target-1].
    await db.seat.createMany({
      data: Array.from({ length: target - current }, (_, i) => ({
        tableId: id,
        index: current + i,
      })),
    });
    await db.table.update({ where: { id }, data: { capacity: target } });
  } else {
    // v1.22.10 shrink — REPACK behaviour. Move any guests sitting on the
    // trailing indices into leading empty slots; only error when TOTAL
    // occupancy exceeds the new capacity (no silent eviction).
    const occupiedCount = table.seats.filter((s) => s.guest).length;
    if (occupiedCount > target) {
      return {
        ok: false,
        error: `Can't shrink to ${target}: ${occupiedCount} guests assigned to this table. Unseat ${occupiedCount - target} first.`,
      };
    }
    const trailingOccupied = table.seats
      .filter((s) => s.index >= target && s.guest)
      .sort((a, b) => a.index - b.index);
    const leadingEmpty = table.seats
      .filter((s) => s.index < target && !s.guest)
      .sort((a, b) => a.index - b.index);
    const moves = trailingOccupied.map((src, i) => ({
      guestId: src.guest!.id,
      toSeatId: leadingEmpty[i]!.id,
    }));
    // Atomic: move guests, drop trailing seats, set capacity.
    await db.$transaction([
      ...moves.map((m) =>
        db.guest.update({
          where: { id: m.guestId },
          data: { tableSeatId: m.toSeatId },
        }),
      ),
      db.seat.deleteMany({ where: { tableId: id, index: { gte: target } } }),
      db.table.update({ where: { id }, data: { capacity: target } }),
    ]);
  }
  await logAudit({
    userId: user.id,
    action: "capacity",
    entity: "Table",
    entityId: id,
    metadata: { from: current, to: target },
  });
  revalidatePath("/seating");
  return { ok: true };
}

const positionInputSchema = z.object({
  posX: z.number().min(0).max(5000),
  posY: z.number().min(0).max(5000),
  rotation: z.number().min(-360).max(720).optional(),
});

export async function updateTablePositionCore(
  user: SessionUser,
  id: string,
  posX: number,
  posY: number,
  rotation?: number,
): Promise<void> {
  const parsed = positionInputSchema.parse({ posX, posY, rotation });
  await db.table.update({
    where: { id },
    data: {
      posX: parsed.posX,
      posY: parsed.posY,
      ...(parsed.rotation !== undefined && { rotation: parsed.rotation }),
    },
  });
  await logAudit({
    userId: user.id,
    action: "position",
    entity: "Table",
    entityId: id,
    metadata: { posX: parsed.posX, posY: parsed.posY, rotation: parsed.rotation },
  });
  // Revalidate so positions survive view-switches and navigation. The
  // canvas preserves its local position over a refreshed prop, so this
  // does NOT cause a mid-drag snap-back; only the server snapshot refreshes.
  revalidatePath("/seating");
}

// v1.23.0: per-table notes — free-form text. Empty string clears.
const tableNotesInputSchema = z.string().max(2000);

export async function updateTableNotesCore(
  user: SessionUser,
  id: string,
  notes: string,
): Promise<void> {
  const parsed = tableNotesInputSchema.parse(notes);
  const updated = await db.table.update({
    where: { id },
    data: { notes: parsed === "" ? null : parsed },
  });
  await logAudit({
    userId: user.id,
    action: "notes",
    entity: "Table",
    entityId: id,
    metadata: {
      tableName: updated.name,
      notesLength: parsed.length,
      cleared: parsed === "",
    },
  });
  revalidatePath("/seating");
}

// ── seating.table.update: name + shape (v2.9.2) ───────────────────────
// New AI-apply-only cores — no human form renames or reshapes a table
// today (see the deferral note that used to sit on seatingTableUpdateSchema),
// so these have no "use server" wrapper yet, same as updateSupplierContactCore
// (v2.9.0). Shape never changes the seat count, so neither core touches
// seats; a capacity change goes through updateTableCapacityCore's
// shrink-repack guard separately.

const tableNameInputSchema = z.string().min(1).max(100);

export async function updateTableNameCore(
  user: SessionUser,
  id: string,
  name: string,
): Promise<void> {
  const parsed = tableNameInputSchema.parse(name);
  const before = await db.table.findUnique({ where: { id }, select: { name: true } });
  if (!before) throw new Error("Table not found");
  await db.table.update({ where: { id }, data: { name: parsed } });
  await logAudit({
    userId: user.id,
    action: "rename",
    entity: "Table",
    entityId: id,
    metadata: { from: before.name, to: parsed },
  });
  revalidatePath("/seating");
}

export async function updateTableShapeCore(
  user: SessionUser,
  id: string,
  shape: TableShape,
): Promise<void> {
  const updated = await db.table.update({ where: { id }, data: { shape } });
  await logAudit({
    userId: user.id,
    action: "shape",
    entity: "Table",
    entityId: id,
    metadata: { tableName: updated.name, shape },
  });
  revalidatePath("/seating");
}

// ── seating.plan.update: plan notes + day-of checklist (v2.9.2) ────────
// Session-free extractions of updateSeatingNotes / updateSeatingChecklist
// (seating/actions.ts). The human wrappers now parse + gate then delegate
// here; the AI apply path (seating.plan.update) gates canEdit("seating")
// then calls in. Both write the WeddingSettings singleton (the plan-level
// fields render at the top of /seating), keep the upsert-with-create
// fallback for a missing bootstrap row, and audit + revalidate identically.
export type SeatingChecklistItem = { id: string; label: string; done: boolean };

export async function updateSeatingNotesCore(
  user: SessionUser,
  notes: string,
): Promise<void> {
  await db.weddingSettings.upsert({
    where: { id: 1 },
    update: { seatingNotes: notes === "" ? null : notes },
    create: {
      id: 1,
      weddingDate: new Date(process.env.WEDDING_DATE ?? "2026-09-24T14:00:00Z"),
      venue: process.env.WEDDING_VENUE ?? "Alveston Manor",
      seatingNotes: notes === "" ? null : notes,
    },
  });
  await logAudit({
    userId: user.id,
    action: "seating-notes",
    entity: "WeddingSettings",
    entityId: "1",
    metadata: { notesLength: notes.length, cleared: notes === "" },
  });
  revalidatePath("/seating");
}

export async function updateSeatingChecklistCore(
  user: SessionUser,
  items: SeatingChecklistItem[],
): Promise<void> {
  await db.weddingSettings.upsert({
    where: { id: 1 },
    update: {
      seatingChecklist:
        items.length === 0 ? Prisma.JsonNull : (items as Prisma.InputJsonValue),
    },
    create: {
      id: 1,
      weddingDate: new Date(process.env.WEDDING_DATE ?? "2026-09-24T14:00:00Z"),
      venue: process.env.WEDDING_VENUE ?? "Alveston Manor",
      seatingChecklist:
        items.length === 0 ? Prisma.JsonNull : (items as Prisma.InputJsonValue),
    },
  });
  const doneCount = items.filter((i) => i.done).length;
  await logAudit({
    userId: user.id,
    action: "seating-checklist",
    entity: "WeddingSettings",
    entityId: "1",
    metadata: { itemCount: items.length, doneCount, cleared: items.length === 0 },
  });
  revalidatePath("/seating");
}

// ── song_request.assign ───────────────────────────────────────────────
// v2.8.1: extracted body of addGuestRequestToPlaylist (songs/actions.ts).
// The wrapper keeps the requireEdit("songs") gate and returns the result
// object the /songs UI expects; the AI apply path gates canEdit then
// throws on a non-ok result so the claim rolls back. The atomic
// claim-then-create transaction (updateMany where playlistId:null makes
// the "already handled" check and the write ONE step), the requester-name
// provenance, the audit row and the /songs revalidation are preserved
// verbatim.
export const addRequestToPlaylistInputSchema = z.object({
  requestId: z.string().min(1),
  playlistId: z.string().min(1),
});
export type AddRequestToPlaylistInput = z.infer<typeof addRequestToPlaylistInputSchema>;

export type AddRequestResult =
  | { ok: true; playlistName: string; songId: string }
  | { ok: false; error: string };

// Internal control-flow signal for the atomic claim-then-write pattern —
// never surfaced past this core.
class RequestAlreadyHandledError extends Error {}

export async function addGuestRequestToPlaylistCore(
  user: SessionUser,
  input: { requestId: string; playlistId: string },
): Promise<AddRequestResult> {
  const parsed = addRequestToPlaylistInputSchema.parse(input);

  const request = await db.songRequest.findUnique({
    where: { id: parsed.requestId },
    include: { guest: { select: { firstName: true, lastName: true } } },
  });
  if (!request) return { ok: false, error: "Request not found." };
  if (request.playlistId) return { ok: false, error: "This request has already been handled." };

  const playlist = await db.playlist.findUnique({
    where: { id: parsed.playlistId },
    select: { name: true },
  });
  if (!playlist) return { ok: false, error: "Playlist not found." };

  const requesterName = request.guest
    ? `${request.guest.firstName} ${request.guest.lastName}`.trim()
    : "Guest request";

  // updateMany's where clause makes the "already handled" claim atomic
  // with the check: only whichever call gets there first can succeed, and
  // the whole claim+create is one transaction, so a lost race never
  // creates an orphan Song.
  let song;
  try {
    song = await db.$transaction(async (tx) => {
      const claim = await tx.songRequest.updateMany({
        where: { id: parsed.requestId, playlistId: null },
        data: { playlistId: parsed.playlistId },
      });
      if (claim.count === 0) throw new RequestAlreadyHandledError();

      const last = await tx.song.findFirst({
        where: { playlistId: parsed.playlistId },
        orderBy: { order: "desc" },
      });
      return tx.song.create({
        data: {
          playlistId: parsed.playlistId,
          title: request.title,
          artist: request.artist,
          source: requesterName,
          order: (last?.order ?? -1) + 1,
        },
      });
    });
  } catch (err) {
    if (err instanceof RequestAlreadyHandledError) {
      return { ok: false, error: "This request has already been handled." };
    }
    throw err;
  }

  await logAudit({
    userId: user.id,
    action: "create",
    entity: "Song",
    entityId: song.id,
    metadata: {
      title: song.title,
      artist: song.artist,
      playlistId: parsed.playlistId,
      playlistName: playlist.name,
      fromGuestRequestId: parsed.requestId,
    },
  });
  revalidatePath("/songs");
  return { ok: true, playlistName: playlist.name, songId: song.id };
}
