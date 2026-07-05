// v2.4.0: playlists + songs + guest song requests. playlistIds are
// what song.add proposals target — with one polarity hazard the tool
// description must keep in the model's face: a block-list playlist
// (isBlockList / DO_NOT_PLAY) means adding a song there BANS it.

import { z } from "zod";
import { db } from "@/lib/db";
import { canView } from "@/lib/permissions";
import type { AiTool } from "./types";

const inputSchema = z.object({
  playlistId: z.string().optional(),
});

export const readSongs: AiTool<typeof inputSchema> = {
  name: "read_songs",
  description:
    "Read music planning state — every playlist (name, category, song count, Spotify link status) plus guests' song requests and which playlist each request was assigned to (null = not yet placed). Pass playlistId to also get that playlist's songs (title, artist, source). WARNING: a playlist with isBlockList=true is a DO-NOT-PLAY list — adding a song there bans it from the wedding, the opposite of a recommendation. Check isBlockList before proposing any song addition.",
  inputSchema,
  progressLabel: "Reading playlists…",
  definition: {
    name: "read_songs",
    description:
      "Read playlists (with playlistIds + song counts), guest song requests, and — when playlistId is given — that playlist's songs. WARNING: a playlist with isBlockList=true is a DO-NOT-PLAY list — adding a song there bans it.",
    input_schema: {
      type: "object",
      properties: {
        playlistId: {
          type: "string",
          description: "Also return this playlist's songs (max 100).",
        },
      },
    },
  },
  async handler(input, ctx) {
    if (!(await canView(ctx.user, "songs"))) {
      return { ok: false, error: "Songs aren't visible to this user." };
    }

    const [playlists, requests] = await Promise.all([
      db.playlist.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          category: true,
          isBlockList: true,
          spotifyId: true,
          spotifyUrl: true,
          _count: { select: { songs: true } },
        },
      }),
      db.songRequest.findMany({
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          title: true,
          artist: true,
          playlistId: true,
          guest: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    let songs: { title: string; artist: string | null; source: string | null }[] | undefined;
    if (input.playlistId) {
      if (!playlists.some((p) => p.id === input.playlistId)) {
        return { ok: false, error: `No playlist with id '${input.playlistId}'.` };
      }
      songs = await db.song.findMany({
        where: { playlistId: input.playlistId },
        orderBy: { order: "asc" },
        take: 100,
        select: { title: true, artist: true, source: true },
      });
    }

    return {
      ok: true,
      data: {
        playlists: playlists.map((p) => ({
          playlistId: p.id,
          name: p.name,
          category: p.category,
          isBlockList: p.isBlockList,
          songCount: p._count.songs,
          spotifyLinked: Boolean(p.spotifyId || p.spotifyUrl),
        })),
        ...(songs ? { playlistId: input.playlistId, songs } : {}),
        songRequests: requests.map((r) => ({
          requestId: r.id,
          title: r.title,
          artist: r.artist,
          guestName: `${r.guest.firstName} ${r.guest.lastName}`.trim(),
          assignedPlaylistId: r.playlistId,
        })),
      },
    };
  },
};
