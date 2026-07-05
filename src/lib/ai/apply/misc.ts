// v2.4.0: apply bridges for the long-tail proposal kinds — question
// answers, playlist songs, custom-field values and seat assignments.
//
// Each bridge re-parses the payload, adds the domain guard the
// underlying action skips, then calls the same human server action.
// Throws on any failure so applyLoadedProposal's claim-rollback fires.

import { answerQuestion, setTaskCustomField } from "@/app/(app)/tasks/actions";
import { createSong } from "@/app/(app)/songs/actions";
import { setGuestCustomField } from "@/app/(app)/guests/actions";
import { setSupplierCustomField } from "@/app/(app)/suppliers/actions";
import { assignGuestToSeat } from "@/app/(app)/seating/actions";
import { db } from "@/lib/db";
import {
  customFieldSetSchema,
  questionAnswerSchema,
  seatAssignSchema,
  songAddSchema,
} from "@/lib/ai/proposals/schemas";

async function applyQuestionAnswer(payload: unknown): Promise<{ id: string }> {
  const parsed = questionAnswerSchema.parse(payload);
  // answerQuestion doesn't check task.type — it would happily stamp a
  // questionAnswer on a plain TASK row. Enforce here. (The schema's
  // answer min(1) already keeps the wipe-and-reopen branch out of
  // reach.)
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
  await answerQuestion(parsed.taskId, parsed.answer);
  return { id: parsed.taskId };
}

async function applySongAdd(payload: unknown): Promise<{ id: string }> {
  const parsed = songAddSchema.parse(payload);
  const fd = new FormData();
  fd.append("playlistId", parsed.playlistId);
  fd.append("title", parsed.title);
  if (parsed.artist) fd.append("artist", parsed.artist);
  // Provenance default — the couple should always be able to tell an
  // AI pick from a guest request or their own adds.
  fd.append("source", parsed.source || "AI suggestion");
  const result = await createSong(fd);
  if (!result?.id) throw new Error("createSong did not return an id.");
  return { id: result.id };
}

async function applyCustomFieldSet(payload: unknown): Promise<{ id: string }> {
  const parsed = customFieldSetSchema.parse(payload);
  // Each setter validates the fieldId belongs to its entity and
  // parseCustomFieldValue throws on type/option mismatch — single-key
  // merge, so no carry-current dance is needed here.
  switch (parsed.entity) {
    case "guest":
      await setGuestCustomField(parsed.targetId, parsed.fieldId, parsed.value);
      break;
    case "task":
      await setTaskCustomField(parsed.targetId, parsed.fieldId, parsed.value);
      break;
    case "supplier":
      await setSupplierCustomField(parsed.targetId, parsed.fieldId, parsed.value);
      break;
  }
  return { id: parsed.targetId };
}

async function applySeatAssign(payload: unknown): Promise<{ id: string }> {
  const parsed = seatAssignSchema.parse(payload);
  // assignGuestToSeat silently evicts whoever holds the seat — that
  // path must stay unreachable via AI, so re-check occupancy at apply
  // time (the propose tool already refused occupied seats, but a
  // human may have seated someone between propose and approve).
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
  await assignGuestToSeat(parsed.seatId, parsed.guestId);
  return { id: parsed.guestId };
}

export async function applyMiscProposal(
  _user: { id: string; isCouple: boolean },
  kind: string,
  payload: unknown,
): Promise<{ id: string }> {
  switch (kind) {
    case "question.answer":
      return applyQuestionAnswer(payload);
    case "song.add":
      return applySongAdd(payload);
    case "custom_field.set":
      return applyCustomFieldSet(payload);
    case "seat.assign":
      return applySeatAssign(payload);
    default:
      throw new Error(`Unknown misc proposal kind: ${kind}`);
  }
}
