// v2.8.0: apply dispatch for the long-tail proposal kinds — question
// answers, playlist songs, custom-field values and seat assignments.
//
// T1 self-apply: these kinds used to bridge through the human "use
// server" actions (answerQuestion / createSong / setXCustomField /
// assignGuestToSeat), which gate requireEdit() on the Auth.js session.
// The MCP apply path runs session-free with an explicit user, so each
// handler now calls the session-free core in src/lib/core/misc.ts
// directly and re-asserts the entity's section with canEdit — same
// permission section the human path used, same refusal rules, same
// evaluation order (the checks that ran BEFORE the human action's
// internal requireEdit still run before the gate here, preserving the
// original error precedence). Throws on any failure so
// applyLoadedProposal's claim-rollback fires and the proposal stays
// PENDING.

import { db } from "@/lib/db";
import { canEdit, type Section } from "@/lib/permissions";
// Type-only import — erased at compile time, so this module never pulls
// the @/auth graph into the MCP route bundle (same convention as
// src/lib/core/* and src/lib/ai/apply/deletes.ts).
import type { SessionUser } from "@/lib/actions";
import {
  addGuestRequestToPlaylistCore,
  answerQuestionCore,
  assignGuestToSeatCore,
  createSongCore,
  createTableCore,
  setGuestCustomFieldCore,
  setSupplierCustomFieldCore,
  setTaskCustomFieldCore,
  songInputSchema,
  swapSeatsCore,
  tableCreateInputSchema,
  unassignSeatCore,
  updateSeatingChecklistCore,
  updateSeatingNotesCore,
  updateTableCapacityCore,
  updateTableNameCore,
  updateTableNotesCore,
  updateTablePositionCore,
  updateTableShapeCore,
} from "@/lib/core/misc";
import {
  customFieldSetSchema,
  questionAnswerSchema,
  seatAssignSchema,
  seatSwapSchema,
  seatUnassignSchema,
  seatingPlanUpdateSchema,
  seatingTableCreateSchema,
  seatingTableUpdateSchema,
  songAddSchema,
  songRequestAssignSchema,
} from "@/lib/ai/proposals/schemas";

/** Throw on a {ok:false} result so applyLoadedProposal's claim-rollback
 *  fires — the seating cores (capacity/swap) return typed results rather
 *  than throwing (Next production redacts thrown errors on the human
 *  path; the AI apply path wants the throw). */
function ensureOk(result: { ok: true } | { ok: false; error: string }): void {
  if (!result.ok) throw new Error(result.error);
}

/** Session-free twin of requireEdit(section) — same error text, but the
 *  user comes from the caller instead of the session (same helper
 *  convention as src/lib/ai/apply/deletes.ts). Replaces the gate the
 *  human server actions used to run inside the call. */
async function requireSectionEdit(user: SessionUser, section: Section): Promise<void> {
  if (!(await canEdit(user, section))) {
    throw new Error(`Forbidden: no edit access to ${section}`);
  }
}

async function applyQuestionAnswer(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = questionAnswerSchema.parse(payload);
  // answerQuestion doesn't check task.type — it would happily stamp a
  // questionAnswer on a plain TASK row. Enforce here. (The schema's
  // answer min(1) already keeps the wipe-and-reopen branch out of
  // reach.) These checks ran BEFORE the human action's requireEdit, so
  // the gate stays below them to preserve the error precedence.
  const task = await db.task.findUnique({
    where: { id: parsed.taskId },
    select: { type: true },
  });
  if (!task) {
    throw new Error(
      "Question not found — it may have been deleted since the proposal was made.",
    );
  }
  if (task.type !== "QUESTION" && task.type !== "DECISION") {
    throw new Error("This task is not a question or decision — nothing to answer.");
  }
  await requireSectionEdit(user, "questions");
  await answerQuestionCore(user, parsed.taskId, parsed.answer);
  return { id: parsed.taskId };
}

async function applySongAdd(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = songAddSchema.parse(payload);
  await requireSectionEdit(user, "songs");
  const result = await createSongCore(
    user,
    // Re-validate through the core's input schema (identical to the
    // human FormData parse). Provenance default — the couple should
    // always be able to tell an AI pick from a guest request or their
    // own adds.
    songInputSchema.parse({
      playlistId: parsed.playlistId,
      title: parsed.title,
      artist: parsed.artist,
      source: parsed.source || "AI suggestion",
    }),
  );
  if (!result?.id) throw new Error("createSong did not return an id.");
  return { id: result.id };
}

async function applyCustomFieldSet(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = customFieldSetSchema.parse(payload);
  // Each core validates the fieldId belongs to its entity and
  // parseCustomFieldValue throws on type/option mismatch — single-key
  // merge, so no carry-current dance is needed here.
  switch (parsed.entity) {
    case "guest":
      await requireSectionEdit(user, "guests");
      await setGuestCustomFieldCore(user, parsed.targetId, parsed.fieldId, parsed.value);
      break;
    case "task": {
      // Polymorphic gate — mirror setTaskCustomField: read the task's
      // type to pick tasks vs questions, throwing "Task not found"
      // BEFORE the gate exactly as the human action did.
      const task = await db.task.findUnique({
        where: { id: parsed.targetId },
        select: { type: true },
      });
      if (!task) throw new Error("Task not found");
      const section = task.type === "TASK" ? "tasks" : "questions";
      await requireSectionEdit(user, section);
      await setTaskCustomFieldCore(user, parsed.targetId, parsed.fieldId, parsed.value);
      break;
    }
    case "supplier":
      await requireSectionEdit(user, "suppliers");
      await setSupplierCustomFieldCore(user, parsed.targetId, parsed.fieldId, parsed.value);
      break;
  }
  return { id: parsed.targetId };
}

async function applySeatAssign(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = seatAssignSchema.parse(payload);
  // assignGuestToSeat silently evicts whoever holds the seat — that
  // path must stay unreachable via AI, so re-check occupancy at apply
  // time (the propose tool already refused occupied seats, but a
  // human may have seated someone between propose and approve). These
  // checks ran BEFORE the human action's requireEdit, so the gate
  // stays below them to preserve the error precedence.
  const seat = await db.seat.findUnique({
    where: { id: parsed.seatId },
    select: { id: true, guest: { select: { id: true } } },
  });
  if (!seat) {
    throw new Error(
      "Seat not found — the table may have been changed since the proposal was made.",
    );
  }
  if (seat.guest && seat.guest.id !== parsed.guestId) {
    throw new Error("That seat was taken in the meantime — re-propose the seating.");
  }
  const guest = await db.guest.findUnique({
    where: { id: parsed.guestId },
    select: { archived: true, rsvp: true },
  });
  if (!guest) {
    throw new Error(
      "Guest not found — they may have been removed since the proposal was made.",
    );
  }
  if (guest.archived) throw new Error("Guest is archived — restore them before seating.");
  if (guest.rsvp !== "ATTENDING") {
    throw new Error("Guest is no longer marked attending — not seating them.");
  }
  await requireSectionEdit(user, "seating");
  await assignGuestToSeatCore(user, parsed.seatId, parsed.guestId);
  return { id: parsed.guestId };
}

// ── v2.8.1 (Tier 2, Slice 3): seating table edits + seat swap/unseat + ──
// ── guest song-request assignment. Each gates its own section (seating /
// songs) via requireSectionEdit — same section the human wrappers gated —
// and throws on any refusal so applyLoadedProposal's claim rolls back.

async function applySeatUnassign(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = seatUnassignSchema.parse(payload);
  // Load the seat for a clean "not found" (the core would otherwise
  // no-op silently on a missing seat). No occupancy re-check needed —
  // unseating never displaces a THIRD guest.
  const seat = await db.seat.findUnique({
    where: { id: parsed.seatId },
    select: { id: true },
  });
  if (!seat) {
    throw new Error(
      "Seat not found — the table may have been changed since the proposal was made.",
    );
  }
  await requireSectionEdit(user, "seating");
  await unassignSeatCore(user, parsed.seatId);
  return { id: parsed.seatId };
}

async function applySeatSwap(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = seatSwapSchema.parse(payload);
  await requireSectionEdit(user, "seating");
  // swapSeatsCore mirrors the human swap: same-table only, never evicts a
  // bystander. A non-ok result (missing seat, cross-table) throws so the
  // claim rolls back.
  ensureOk(await swapSeatsCore(user, parsed.seatId1, parsed.seatId2));
  return { id: parsed.seatId1 };
}

async function applySeatingTableCreate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = seatingTableCreateSchema.parse(payload);
  await requireSectionEdit(user, "seating");
  // The grid position is auto-computed inside the core (nextGridPosition),
  // same as the human createTable — the payload never carries coordinates.
  const result = await createTableCore(
    user,
    tableCreateInputSchema.parse({
      name: parsed.name,
      shape: parsed.shape,
      capacity: parsed.capacity,
    }),
  );
  if (!result?.id) throw new Error("createTable did not return an id.");
  return { id: result.id };
}

async function applySeatingTableUpdate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = seatingTableUpdateSchema.parse(payload);

  const table = await db.table.findUnique({
    where: { id: parsed.tableId },
    select: { id: true },
  });
  if (!table) {
    throw new Error(
      "Table not found — it may have been deleted since the proposal was made.",
    );
  }
  await requireSectionEdit(user, "seating");
  // Dispatch only the fields the payload carries. v2.9.2: name + shape
  // are independent void cores (shape never changes the seat count, so
  // it needs no eviction guard). capacity goes through the shrink-repack
  // core (refuses over-occupancy → throw, so no silent eviction);
  // position + notes are independent void cores. rotation only takes
  // effect as a companion to a posX/posY move (the schema pairs them and
  // the propose tool guides the model to that shape).
  if (parsed.name !== undefined) {
    await updateTableNameCore(user, parsed.tableId, parsed.name);
  }
  if (parsed.shape !== undefined) {
    await updateTableShapeCore(user, parsed.tableId, parsed.shape);
  }
  if (parsed.capacity !== undefined) {
    ensureOk(await updateTableCapacityCore(user, parsed.tableId, parsed.capacity));
  }
  if (parsed.posX !== undefined && parsed.posY !== undefined) {
    await updateTablePositionCore(
      user,
      parsed.tableId,
      parsed.posX,
      parsed.posY,
      parsed.rotation,
    );
  }
  if (parsed.notes !== undefined) {
    // updateTableNotesCore treats "" as clear; null clears too.
    await updateTableNotesCore(user, parsed.tableId, parsed.notes ?? "");
  }
  return { id: parsed.tableId };
}

// ── seating.plan.update (v2.9.2) ──────────────────────────────────────
// Plan-level seating notes + day-of checklist (stored on the
// WeddingSettings singleton). Gates canEdit("seating") — same section
// the human updateSeatingNotes/updateSeatingChecklist gate — then writes
// whichever fields the payload carries via the session-free cores. null
// notes → "" (clears); null checklist → [] (clears). The entity id is
// the singleton "1", same convention as the other WeddingSettings writes.
async function applySeatingPlanUpdate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = seatingPlanUpdateSchema.parse(payload);
  await requireSectionEdit(user, "seating");
  if (parsed.notes !== undefined) {
    await updateSeatingNotesCore(user, parsed.notes ?? "");
  }
  if (parsed.checklist !== undefined) {
    await updateSeatingChecklistCore(user, parsed.checklist ?? []);
  }
  return { id: "1" };
}

async function applySongRequestAssign(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = songRequestAssignSchema.parse(payload);
  await requireSectionEdit(user, "songs");
  // The core re-checks the request is still unassigned + the playlist
  // exists inside its atomic claim-then-create transaction. A non-ok
  // result (already handled, missing request/playlist) throws so the
  // claim rolls back and the proposal stays PENDING.
  const result = await addGuestRequestToPlaylistCore(user, {
    requestId: parsed.requestId,
    playlistId: parsed.playlistId,
  });
  if (!result.ok) throw new Error(result.error);
  return { id: result.songId };
}

export async function applyMiscProposal(
  user: SessionUser,
  kind: string,
  payload: unknown,
): Promise<{ id: string }> {
  switch (kind) {
    case "question.answer":
      return applyQuestionAnswer(user, payload);
    case "song.add":
      return applySongAdd(user, payload);
    case "custom_field.set":
      return applyCustomFieldSet(user, payload);
    case "seat.assign":
      return applySeatAssign(user, payload);
    // v2.8.1 (Tier 2, Slice 3)
    case "seat.unassign":
      return applySeatUnassign(user, payload);
    case "seat.swap":
      return applySeatSwap(user, payload);
    case "seating.table.create":
      return applySeatingTableCreate(user, payload);
    case "seating.table.update":
      return applySeatingTableUpdate(user, payload);
    case "song_request.assign":
      return applySongRequestAssign(user, payload);
    // v2.9.2: plan-level seating notes/checklist.
    case "seating.plan.update":
      return applySeatingPlanUpdate(user, payload);
    default:
      throw new Error(`Unknown misc proposal kind: ${kind}`);
  }
}
