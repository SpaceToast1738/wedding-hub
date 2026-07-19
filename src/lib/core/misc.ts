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
import { TaskStatus } from "@prisma/client";
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
