"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PlaylistCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
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
  await audit(user, { action: "create", entity: "Playlist", entityId: created.id });
  revalidatePath("/songs");
}

export async function deletePlaylist(id: string) {
  const user = await requireEdit("songs");
  await db.playlist.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "Playlist", entityId: id });
  revalidatePath("/songs");
}

export async function createSong(formData: FormData) {
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
  await audit(user, { action: "create", entity: "Song", entityId: created.id });
  revalidatePath("/songs");
}

export async function deleteSong(id: string) {
  const user = await requireEdit("songs");
  await db.song.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "Song", entityId: id });
  revalidatePath("/songs");
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
    await audit(user, { action: "spotify_unlink", entity: "Playlist", entityId: parsed.playlistId });
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
