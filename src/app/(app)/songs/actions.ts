"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PlaylistCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
import { DISMISSED_SENTINEL_NAME } from "./constants";
import {
  SpotifyError,
  getPlaylistMeta,
  getPlaylistTracks,
  isSpotifyConfigured,
  parsePlaylistId,
} from "@/lib/spotify";

const playlistSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.nativeEnum(PlaylistCategory),
  description: z.string().max(500).optional().nullable(),
  isBlockList: z.boolean().optional(),
});

const songSchema = z.object({
  playlistId: z.string().min(1),
  title: z.string().min(1).max(200),
  artist: z.string().max(200).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
});

export async function createPlaylist(formData: FormData) {
  const user = await requireEdit("songs");
  const parsed = playlistSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description") || null,
    isBlockList: formData.get("isBlockList") === "on" || formData.get("category") === "DO_NOT_PLAY",
  });
  const last = await db.playlist.findFirst({ orderBy: { order: "desc" } });
  const created = await db.playlist.create({
    data: {
      name: parsed.name,
      category: parsed.category,
      description: parsed.description ?? null,
      isBlockList: !!parsed.isBlockList,
      order: (last?.order ?? -1) + 1,
    },
  });
  await audit(user, {
    action: "create",
    entity: "Playlist",
    entityId: created.id,
    metadata: {
      name: created.name,
      category: created.category,
      isBlockList: created.isBlockList,
    },
  });
  revalidatePath("/songs");
}

export async function deletePlaylist(id: string) {
  const user = await requireEdit("songs");
  const before = await db.playlist.findUnique({
    where: { id },
    include: { _count: { select: { songs: true } } },
  });
  await db.playlist.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "Playlist",
    entityId: id,
    metadata: {
      name: before?.name ?? null,
      category: before?.category ?? null,
      songCount: before?._count.songs ?? 0,
    },
  });
  revalidatePath("/songs");
}

export async function createSong(formData: FormData): Promise<{ id: string }> {
  const user = await requireEdit("songs");
  const parsed = songSchema.parse({
    playlistId: formData.get("playlistId"),
    title: formData.get("title"),
    artist: formData.get("artist") || null,
    source: formData.get("source") || null,
  });
  const last = await db.song.findFirst({ where: { playlistId: parsed.playlistId }, orderBy: { order: "desc" } });
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
  await audit(user, {
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
  // v2.4.0: return the id so the AI apply-bridge can link the row.
  return { id: created.id };
}

export async function deleteSong(id: string) {
  const user = await requireEdit("songs");
  const before = await db.song.findUnique({
    where: { id },
    include: { playlist: { select: { name: true } } },
  });
  await db.song.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "Song",
    entityId: id,
    metadata: {
      title: before?.title ?? null,
      artist: before?.artist ?? null,
      playlistName: before?.playlist.name ?? null,
    },
  });
  revalidatePath("/songs");
}

// Move a song up/down within its playlist by swapping with its neighbour.
export async function moveSong(id: string, delta: -1 | 1) {
  const user = await requireEdit("songs");
  const song = await db.song.findUnique({ where: { id } });
  if (!song) return;
  const songs = await db.song.findMany({
    where: { playlistId: song.playlistId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, order: true },
  });
  const idx = songs.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const swap = idx + delta;
  if (swap < 0 || swap >= songs.length) return;
  const a = songs[idx]!;
  const b = songs[swap]!;
  await db.$transaction([
    db.song.update({ where: { id: a.id }, data: { order: b.order } }),
    db.song.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  // Lookup the song + playlist for the audit row.
  const songSnap = await db.song.findUnique({
    where: { id },
    include: { playlist: { select: { name: true } } },
  });
  await audit(user, {
    action: "reorder",
    entity: "Song",
    entityId: id,
    metadata: {
      title: songSnap?.title ?? null,
      playlistName: songSnap?.playlist.name ?? null,
      delta,
      newOrder: songSnap?.order ?? null,
    },
  });
  revalidatePath("/songs");
}

// ── Guest request triage ────────────────────────────────────────────────────
//
// Before this, a SongRequest's `playlistId` had no writer anywhere in the
// app — the /songs query filters the "pending" panel on `playlistId: null`,
// but nothing ever set it to non-null, so every guest request was stuck in
// the queue forever regardless of what the couple did. These two actions
// are the only writers of that field.
//
// `playlistId` is a real FK to Playlist, so "dismiss" (leave the queue
// without creating a Song) can't just write an arbitrary sentinel value —
// it has to point at a real row. We lazily create one internal placeholder
// Playlist for that purpose and filter it out of every normal playlist
// listing on the page (see the `name: { not: DISMISSED_SENTINEL_NAME }`
// clause in page.tsx). A dedicated `dismissedAt` column on SongRequest
// would be the cleaner long-term shape, but that's a schema migration
// outside this pass's scope — this sentinel keeps the fix self-contained.
// Constant lives in ./constants.ts, not here — "use server" files may
// only export async functions.

async function getOrCreateDismissedSentinelPlaylistId(): Promise<string> {
  // v2.5.2 (review fix): no unique constraint exists on Playlist.name
  // (adding one is a schema migration, out of scope per the comment
  // above), so two concurrent dismisses that both miss this findFirst
  // could each create their own sentinel row. Ordering by id makes
  // every caller converge on the SAME (oldest) sentinel even if a
  // rare duplicate briefly exists — a harmless orphan, never
  // referenced again, rather than a permanent fork.
  const existing = await db.playlist.findFirst({
    where: { name: DISMISSED_SENTINEL_NAME },
    orderBy: { id: "asc" },
  });
  if (existing) return existing.id;
  const created = await db.playlist.create({
    data: {
      name: DISMISSED_SENTINEL_NAME,
      category: PlaylistCategory.MUST_PLAY,
      description: "Holds dismissed guest song requests so they leave the pending queue. Never shown as a real playlist.",
      order: -1,
    },
  });
  return created.id;
}

// v2.5.2 (review fix): internal control-flow signal for the atomic
// claim-then-write pattern below — never surfaced past the action
// that throws it.
class RequestAlreadyHandledError extends Error {}

const addRequestToPlaylistSchema = z.object({
  requestId: z.string().min(1),
  playlistId: z.string().min(1),
});

// Copies a guest's request into a real playlist as a Song (source =
// requester's name, so the row still shows where it came from) and marks
// the request as placed so it drops out of the pending queue.
export async function addGuestRequestToPlaylist(input: { requestId: string; playlistId: string }) {
  const user = await requireEdit("songs");
  const parsed = addRequestToPlaylistSchema.parse(input);

  const request = await db.songRequest.findUnique({
    where: { id: parsed.requestId },
    include: { guest: { select: { firstName: true, lastName: true } } },
  });
  if (!request) return { ok: false as const, error: "Request not found." };
  if (request.playlistId) return { ok: false as const, error: "This request has already been handled." };

  const playlist = await db.playlist.findUnique({ where: { id: parsed.playlistId }, select: { name: true } });
  if (!playlist) return { ok: false as const, error: "Playlist not found." };

  const requesterName = request.guest ? `${request.guest.firstName} ${request.guest.lastName}`.trim() : "Guest request";

  // v2.5.2 (review fix): the "already handled" check above and the
  // write below used to be two separate steps, so two near-
  // simultaneous triage actions on the same request (one Add, one
  // Dismiss) could both pass the null-check and both write — either
  // two Songs from one request, or a Song followed by a silent
  // reassignment to the dismissed sentinel. updateMany's where clause
  // makes the claim atomic with the check: it can only ever succeed
  // for whichever call gets there first, and the whole claim+create
  // is one transaction, so a lost race never creates an orphan Song.
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
      return { ok: false as const, error: "This request has already been handled." };
    }
    throw err;
  }

  await audit(user, {
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
  return { ok: true as const, playlistName: playlist.name };
}

// Clears a request from the pending queue without adding it to any
// playlist — for requests the couple has decided not to use.
export async function dismissGuestRequest(requestId: string) {
  const user = await requireEdit("songs");
  const request = await db.songRequest.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false as const, error: "Request not found." };
  if (request.playlistId) return { ok: false as const, error: "This request has already been handled." };

  const sentinelId = await getOrCreateDismissedSentinelPlaylistId();
  // v2.5.2 (review fix): atomic claim, same reasoning as
  // addGuestRequestToPlaylist above — a concurrent Add on this same
  // request could otherwise land between this function's own
  // check and write.
  const claim = await db.songRequest.updateMany({
    where: { id: requestId, playlistId: null },
    data: { playlistId: sentinelId },
  });
  if (claim.count === 0) {
    return { ok: false as const, error: "This request has already been handled." };
  }
  await audit(user, {
    action: "dismiss",
    entity: "SongRequest",
    entityId: requestId,
    metadata: { title: request.title, artist: request.artist },
  });
  revalidatePath("/songs");
  return { ok: true as const };
}

// ── Spotify sync ───────────────────────────────────────────────────────────

const setSpotifyUrlSchema = z.object({
  playlistId: z.string().min(1),
  url: z.string().max(500),
});

// Save a Spotify playlist URL (or ID) on the local Playlist row, plus
// fetches the playlist metadata to confirm it's reachable. Doesn't sync
// tracks — that's a separate step the user kicks off explicitly so they
// can review before the local songs get rewritten.
export async function setPlaylistSpotifyUrl(input: { playlistId: string; url: string }) {
  const user = await requireEdit("songs");
  const parsed = setSpotifyUrlSchema.parse(input);

  // Empty input clears the link.
  if (!parsed.url.trim()) {
    await db.playlist.update({
      where: { id: parsed.playlistId },
      data: { spotifyId: null, spotifyUrl: null, lastSyncError: null },
    });
    const pl = await db.playlist.findUnique({
      where: { id: parsed.playlistId },
      select: { name: true },
    });
    await audit(user, {
      action: "spotify_unlink",
      entity: "Playlist",
      entityId: parsed.playlistId,
      metadata: { playlistName: pl?.name ?? null },
    });
    revalidatePath("/songs");
    return { ok: true as const };
  }

  if (!isSpotifyConfigured()) {
    return {
      ok: false as const,
      error:
        "Spotify isn't configured on this server. Ask an admin to set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.",
    };
  }

  const id = parsePlaylistId(parsed.url);
  if (!id) {
    return { ok: false as const, error: "Couldn't recognise that as a Spotify playlist URL or ID." };
  }

  try {
    const meta = await getPlaylistMeta(id);
    await db.playlist.update({
      where: { id: parsed.playlistId },
      data: { spotifyId: id, spotifyUrl: meta.url, lastSyncError: null },
    });
    await audit(user, {
      action: "spotify_link",
      entity: "Playlist",
      entityId: parsed.playlistId,
      metadata: { spotifyId: id, name: meta.name },
    });
    revalidatePath("/songs");
    return { ok: true as const, name: meta.name };
  } catch (err) {
    const msg = err instanceof SpotifyError ? err.message : "Failed to verify Spotify playlist.";
    return { ok: false as const, error: msg };
  }
}

// Pulls every track from the linked Spotify playlist and replaces the
// local Song rows. We deliberately do a wholesale replace rather than a
// merge: the source of truth is Spotify, so a synced playlist mirrors
// exactly what's there. Songs the couple added inside Wedding Hub but
// NOT on the Spotify playlist will be lost on sync — communicated in the
// confirm dialog before the user kicks it off.
export async function syncPlaylistFromSpotify(playlistId: string) {
  const user = await requireEdit("songs");

  if (!isSpotifyConfigured()) {
    return {
      ok: false as const,
      error: "Spotify isn't configured on this server. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.",
    };
  }

  const playlist = await db.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist) {
    return { ok: false as const, error: "Playlist not found." };
  }
  if (!playlist.spotifyId) {
    return { ok: false as const, error: "Link a Spotify playlist URL first." };
  }

  try {
    const tracks = await getPlaylistTracks(playlist.spotifyId);

    // Replace strategy: delete songs that came from a previous sync (have
    // spotifyUri set) and any plain local songs are kept untouched UNLESS
    // they happen to match a Spotify track URI (in which case Spotify
    // wins). Then insert the tracks in playlist order.
    //
    // Why not transactional delete-all-then-insert? Because guest-added
    // songs without a spotifyUri are typically requests we want to keep
    // visible alongside the synced list. We delete only what we wrote.
    await db.song.deleteMany({
      where: { playlistId, spotifyUri: { not: null } },
    });

    if (tracks.length > 0) {
      // Find the highest existing order so synced tracks land after any
      // manually-added ones rather than overwriting their slots.
      const last = await db.song.findFirst({
        where: { playlistId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const startOrder = (last?.order ?? -1) + 1;
      await db.song.createMany({
        data: tracks.map((t, i) => ({
          playlistId,
          title: t.title,
          artist: t.artists.length > 0 ? t.artists.join(", ") : null,
          spotifyUri: t.uri,
          source: "Spotify",
          order: startOrder + i,
        })),
      });
    }

    await db.playlist.update({
      where: { id: playlistId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncError: null,
        lastSyncedSongs: tracks.length,
      },
    });
    await audit(user, {
      action: "spotify_sync",
      entity: "Playlist",
      entityId: playlistId,
      metadata: { tracks: tracks.length },
    });
    revalidatePath("/songs");
    return { ok: true as const, tracks: tracks.length };
  } catch (err) {
    const msg = err instanceof SpotifyError ? err.message : "Sync failed.";
    await db.playlist.update({
      where: { id: playlistId },
      data: { lastSyncError: msg, lastSyncedAt: new Date() },
    });
    await audit(user, {
      action: "spotify_sync_fail",
      entity: "Playlist",
      entityId: playlistId,
      metadata: { error: msg },
    });
    revalidatePath("/songs");
    return { ok: false as const, error: msg };
  }
}
