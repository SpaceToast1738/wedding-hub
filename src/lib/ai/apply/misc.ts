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
  answerQuestionCore,
  assignGuestToSeatCore,
  createSongCore,
  setGuestCustomFieldCore,
  setSupplierCustomFieldCore,
  setTaskCustomFieldCore,
  songInputSchema,
} from "@/lib/core/misc";
import {
  customFieldSetSchema,
  questionAnswerSchema,
  seatAssignSchema,
  songAddSchema,
} from "@/lib/ai/proposals/schemas";

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
    default:
      throw new Error(`Unknown misc proposal kind: ${kind}`);
  }
}
