"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RsvpStatus, Side } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
// v2.8.0: the guest/household write cores (create + update + set_rsvp
// + archive + household update) plus shared helpers (schemas,
// syncPlusOne, readDietary) moved to src/lib/core/guests.ts so the MCP
// self-apply path can run them session-free with an explicit user. The
// wrappers below stay the ONLY exports here — "use server" exports are
// client-invokable, so the auth-free cores must never appear in this
// file's export list.
import {
  archiveGuestCore,
  createGuestCore,
  createHouseholdCore,
  guestInputSchema,
  householdInputSchema,
  setGuestRsvpCore,
  updateGuestCore,
  updateHouseholdCore,
} from "@/lib/core/guests";
// v2.8.0: setGuestCustomField's body extracted to a session-free core
// so the MCP self-apply path runs identical write logic without a
// browser session. The wrapper keeps the requireEdit("guests") gate.
import { setGuestCustomFieldCore } from "@/lib/core/misc";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { FileVisibility } from "@prisma/client";
import {
  UPLOADS_DIR,
  ensureUploadsDir,
  generateStoredName,
  validateUpload,
} from "@/lib/uploads";

// v2.8.0: parse + auth + delegate. Everything after the Zod parse
// (db write, audit, revalidate, return shape) lives in
// createHouseholdCore so the AI apply path shares one implementation.
export async function createHousehold(formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = householdInputSchema.parse({
    name: formData.get("name"),
    side: formData.get("side") || Side.BOTH,
    notes: formData.get("notes") || null,
  });
  return createHouseholdCore(user, parsed);
}

// v2.8.0: parse + auth + delegate — the update (before-diff, audit,
// revalidate) lives in updateHouseholdCore.
export async function updateHousehold(id: string, formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = householdInputSchema.parse({
    name: formData.get("name"),
    side: formData.get("side") || Side.BOTH,
    notes: formData.get("notes") || null,
  });
  return updateHouseholdCore(user, id, parsed);
}

// v1.53.0 (C1): result-shape return so caller can render a real
// error toast instead of relying on Next prod redaction.
export type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteHousehold(id: string): Promise<DeleteResult> {
  const user = await requireEdit("guests");
  try {
    // Snapshot name + guest count before delete.
    const before = await db.household.findUnique({
      where: { id },
      include: { _count: { select: { guests: true } } },
    });
    await db.household.delete({ where: { id } });
    await audit(user, {
      action: "delete",
      entity: "Household",
      entityId: id,
      metadata: {
        name: before?.name ?? null,
        side: before?.side ?? null,
        guestCount: before?._count.guests ?? 0,
      },
    });
    revalidatePath("/guests");
    return { ok: true };
  } catch (err) {
    console.error("deleteHousehold failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't delete household",
    };
  }
}

// v2.8.0: parse + auth + delegate — the create (including the
// syncPlusOne materialisation cascade) lives in createGuestCore.
export async function createGuest(formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = guestInputSchema.parse({
    householdId: formData.get("householdId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    rsvp: formData.get("rsvp") || RsvpStatus.PENDING,
    side: formData.get("side") || Side.BOTH,
    isChild: formData.get("isChild") === "on",
    needsHighchair: formData.get("needsHighchair") === "on",
    plusOneAllowed: formData.get("plusOneAllowed") === "on",
    plusOneName: formData.get("plusOneName") || null,
    role: formData.get("role") || null,
    dietary: formData.get("dietary") || null,
    notes: formData.get("notes") || null,
  });
  return createGuestCore(user, parsed);
}

// v2.8.0: parse + auth + delegate — the +1-force-off guard,
// last-edited-fields stamp, syncPlusOne cascade, audit and
// revalidations all live in updateGuestCore.
export async function updateGuest(id: string, formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = guestInputSchema.parse({
    householdId: formData.get("householdId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    rsvp: formData.get("rsvp") || RsvpStatus.PENDING,
    side: formData.get("side") || Side.BOTH,
    isChild: formData.get("isChild") === "on",
    needsHighchair: formData.get("needsHighchair") === "on",
    plusOneAllowed: formData.get("plusOneAllowed") === "on",
    plusOneName: formData.get("plusOneName") || null,
    role: formData.get("role") || null,
    dietary: formData.get("dietary") || null,
    notes: formData.get("notes") || null,
  });
  return updateGuestCore(user, id, parsed);
}

// v2.8.0: gate + delegate — the attending-sync, +1 cascade, named
// audit and revalidations live in setGuestRsvpCore.
export async function setGuestRsvp(id: string, rsvp: RsvpStatus) {
  const user = await requireEdit("guests");
  return setGuestRsvpCore(user, id, rsvp);
}

// Soft-archive — was previously a hard delete, but the audit (R1)
// flagged the lack of undo as a real risk on the wedding day. Default
// flow now sets `archived = true`; the row is hidden from default
// views but can be restored. Their tableSeat is freed at the same
// time so the seat goes back into the pool.
// v2.8.0: gate + delegate — the atomic host+ +1 archive, seat-freeing,
// audit and revalidations live in archiveGuestCore.
export async function deleteGuest(id: string): Promise<DeleteResult> {
  const user = await requireEdit("guests");
  return archiveGuestCore(user, id);
}

// Bring an archived guest back. Their seat does NOT auto-reassign —
// that would be surprising — they come back unseated and the user
// reseats them via the Seating page. If the guest was a host with
// archived +1 rows, those come back too (archiving was atomic; restore
// is symmetric).
export async function restoreGuest(id: string) {
  const user = await requireEdit("guests");
  await db.$transaction([
    db.guest.update({ where: { id }, data: { archived: false } }),
    db.guest.updateMany({
      where: { parentGuestId: id },
      data: { archived: false },
    }),
  ]);
  const restored = await db.guest.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  });
  await audit(user, {
    action: "restore",
    entity: "Guest",
    entityId: id,
    metadata: {
      firstName: restored?.firstName ?? null,
      lastName: restored?.lastName ?? null,
    },
  });
  revalidatePath("/guests");
  revalidatePath("/");
}

// Couple-only escape hatch for actually wiping a guest from the DB
// (e.g. cleanup of a typo'd row). The archived view exposes this on
// each row alongside Restore. Doesn't go through `requireEdit` alone
// — also gated on `user.isCouple` so a non-couple EDIT-on-guests user
// can't bypass the soft-delete guarantee.
export async function hardDeleteGuest(id: string) {
  const user = await requireEdit("guests");
  if (!user.isCouple) {
    await audit(user, {
      action: "guests_denied",
      entity: "Guest",
      entityId: id,
      metadata: { reason: "not_couple", target_action: "hardDeleteGuest" },
    });
    throw new Error("Forbidden: only the couple can permanently delete a guest");
  }
  const guest = await db.guest.findUnique({
    where: { id },
    select: { firstName: true, lastName: true, archived: true },
  });
  if (!guest) return;
  if (!guest.archived) {
    throw new Error("Archive the guest first; only archived guests can be permanently deleted.");
  }
  await db.guest.delete({ where: { id } });
  await audit(user, {
    action: "hard_delete",
    entity: "Guest",
    entityId: id,
    metadata: { firstName: guest.firstName, lastName: guest.lastName },
  });
  revalidatePath("/guests");
  revalidatePath("/");
}

// ── B9 (v1.13.0): inline song-request add on guest detail ─────────────────
//
// The guest detail page used to deep-link to /songs for any add — fine
// for batch data entry, friction for the "while I'm looking at Aunt
// Margaret's row, capture her request" flow Aimee surfaced. This action
// creates a song request for a specific guest, gated on guests-EDIT
// (matches the rest of the guest write surface; songs has its own
// section but the row is owned by the guest).

const songRequestSchema = z.object({
  guestId: z.string().min(1),
  title: z.string().min(1).max(200),
  artist: z.string().max(200).optional().nullable(),
});

export async function addSongRequestForGuest(formData: FormData) {
  const user = await requireEdit("guests");
  const parsed = songRequestSchema.parse({
    guestId: formData.get("guestId"),
    title: formData.get("title"),
    artist: formData.get("artist") || null,
  });
  // Sanity: guest must exist and not be archived. Stops a stale form
  // from creating an orphan request after the guest was deleted in
  // another tab.
  const guest = await db.guest.findUnique({
    where: { id: parsed.guestId },
    select: { id: true, archived: true },
  });
  if (!guest || guest.archived) throw new Error("Guest not found");

  const created = await db.songRequest.create({
    data: {
      guestId: parsed.guestId,
      title: parsed.title.trim(),
      artist: parsed.artist?.trim() || null,
    },
  });
  await audit(user, {
    action: "create",
    entity: "SongRequest",
    entityId: created.id,
    metadata: { guestId: parsed.guestId, title: created.title },
  });
  revalidatePath(`/guests/${parsed.guestId}`);
  revalidatePath("/songs");
}

// ── C10 (v1.15.0): per-guest custom field value writes ────────────────────
//
// One field at a time. Settings UI defines the shape; this writes a
// single value into the Guest's `customFieldValues` JSON column. Type
// validation lives in `parseCustomFieldValue` so the parsed/typed value
// is what lands on disk.

export async function setGuestCustomField(
  guestId: string,
  fieldId: string,
  rawValue: string | null,
) {
  const user = await requireEdit("guests");
  // v2.8.0: body lives in setGuestCustomFieldCore — def validation,
  // archived refusal, typed merge, audit row and revalidation all
  // happen there so the AI apply path shares one implementation.
  await setGuestCustomFieldCore(user, guestId, fieldId, rawValue);
}

// ─── v1.67.0: guest profile picture ─────────────────────────────────
//
// Same shape as the v1.63.0 image-gallery actions for Wedding Book
// cards: one-step upload+attach for the camera-roll workflow, link
// existing File for the picker workflow, and a clear action that
// unlinks (the file row stays on /files so the user can re-link
// later or use it elsewhere).
//
// All three: requireEdit("guests") gate, result-shape return,
// enriched audit metadata.

type ResultShape = { ok: true } | { ok: false; error: string };

async function uploadFileForGuestProfile(
  user: { id: string },
  formFile: File,
): Promise<{ id: string; name: string; mimeType: string }> {
  const validation = validateUpload(formFile);
  if (!validation.ok) throw new Error(`${formFile.name}: ${validation.error}`);
  // v1.67.0 (UX guard): only image MIMEs make sense for a profile
  // picture. validateUpload already enforces the global allowlist;
  // this narrows further for this specific call site.
  if (!validation.mime.startsWith("image/")) {
    throw new Error(`${formFile.name}: must be an image (got ${validation.mime}).`);
  }

  await ensureUploadsDir();
  const storedName = generateStoredName(validation.mime, formFile.name);
  const fullPath = path.join(UPLOADS_DIR, storedName);
  const bytes = Buffer.from(await formFile.arrayBuffer());
  await writeFile(fullPath, bytes, { mode: 0o640 });

  let created;
  try {
    created = await db.file.create({
      data: {
        name: formFile.name.slice(0, 200),
        storedPath: storedName,
        folder: "Guest photos",
        visibility: FileVisibility.EVERYONE,
        mimeType: validation.mime,
        sizeBytes: formFile.size,
        uploadedById: user.id,
      },
    });
  } catch (err) {
    await unlink(fullPath).catch(() => undefined);
    throw err;
  }
  return created;
}

export async function uploadGuestProfilePicture(
  guestId: string,
  formData: FormData,
): Promise<ResultShape> {
  const user = await requireEdit("guests");
  try {
    const guest = await db.guest.findUnique({
      where: { id: guestId },
      select: { id: true, firstName: true, lastName: true, profilePictureFileId: true },
    });
    if (!guest) return { ok: false, error: "Guest not found" };
    const formFile = formData.get("file");
    if (!(formFile instanceof File) || formFile.size === 0) {
      return { ok: false, error: "No file received." };
    }
    const previousFileId = guest.profilePictureFileId;
    const file = await uploadFileForGuestProfile(user, formFile);
    await db.guest.update({
      where: { id: guestId },
      data: { profilePictureFileId: file.id },
    });
    await audit(user, {
      action: "guest-photo-upload",
      entity: "Guest",
      entityId: guestId,
      metadata: {
        guestName: `${guest.firstName} ${guest.lastName}`,
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        replacedFileId: previousFileId,
      },
    });
    revalidatePath("/guests");
    revalidatePath(`/guests/${guestId}`);
    revalidatePath("/seating");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't upload" };
  }
}

export async function setGuestProfilePicture(
  guestId: string,
  fileId: string,
): Promise<ResultShape> {
  const user = await requireEdit("guests");
  try {
    const guest = await db.guest.findUnique({
      where: { id: guestId },
      select: { id: true, firstName: true, lastName: true, profilePictureFileId: true },
    });
    if (!guest) return { ok: false, error: "Guest not found" };
    const file = await db.file.findUnique({ where: { id: fileId } });
    if (!file) return { ok: false, error: "File not found" };
    if (!file.mimeType.startsWith("image/")) {
      return { ok: false, error: "Profile picture must be an image file." };
    }
    if (guest.profilePictureFileId === fileId) return { ok: true };
    await db.guest.update({
      where: { id: guestId },
      data: { profilePictureFileId: fileId },
    });
    await audit(user, {
      action: "guest-photo-link",
      entity: "Guest",
      entityId: guestId,
      metadata: {
        guestName: `${guest.firstName} ${guest.lastName}`,
        fileId,
        fileName: file.name,
        replacedFileId: guest.profilePictureFileId,
      },
    });
    revalidatePath("/guests");
    revalidatePath(`/guests/${guestId}`);
    revalidatePath("/seating");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't link" };
  }
}

export async function clearGuestProfilePicture(
  guestId: string,
): Promise<ResultShape> {
  const user = await requireEdit("guests");
  try {
    const guest = await db.guest.findUnique({
      where: { id: guestId },
      select: { id: true, firstName: true, lastName: true, profilePictureFileId: true },
    });
    if (!guest) return { ok: false, error: "Guest not found" };
    if (!guest.profilePictureFileId) return { ok: true };
    const previousFileId = guest.profilePictureFileId;
    await db.guest.update({
      where: { id: guestId },
      data: { profilePictureFileId: null },
    });
    // Snapshot the file name for the audit log before the FK is
    // gone — the row itself stays on /files (SetNull cascade keeps
    // it alive; we only unlink).
    const file = await db.file.findUnique({
      where: { id: previousFileId },
      select: { name: true },
    });
    await audit(user, {
      action: "guest-photo-clear",
      entity: "Guest",
      entityId: guestId,
      metadata: {
        guestName: `${guest.firstName} ${guest.lastName}`,
        fileId: previousFileId,
        fileName: file?.name ?? null,
      },
    });
    revalidatePath("/guests");
    revalidatePath(`/guests/${guestId}`);
    revalidatePath("/seating");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't clear" };
  }
}
