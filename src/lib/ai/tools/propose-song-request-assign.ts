import { z } from "zod";
import { db } from "@/lib/db";
import { songRequestAssignSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// v2.8.1 (Tier 2, Slice 3): triage a pending guest song request onto a
// playlist. Bridges to the song_request.assign apply handler
// (src/lib/ai/apply/misc.ts) → addGuestRequestToPlaylistCore, which
// atomically claims the request and creates the corresponding Song
// (crediting the requester) so it drops out of the pending queue.
//
// confirmBlockList is propose-time only — it never enters the payload. It
// exists because assigning a request to the do-NOT-play list BANS the
// song, the opposite of the usual "add it" intent (same fence as
// propose_song_add).
const inputSchema = z.object({
  requestId: z
    .string()
    .min(1)
    .describe("Pending guest song-request id from read_songs. Never invent one."),
  playlistId: z
    .string()
    .min(1)
    .describe("Target playlist id from read_songs."),
  confirmBlockList: z
    .boolean()
    .optional()
    .describe(
      "Required true when the target is the do-NOT-play list — assigning a request there bans the song.",
    ),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this request belongs on that playlist. Shown to the couple.",
    ),
});

export const proposeSongRequestAssign: AiTool<typeof inputSchema> = {
  name: "propose_song_request_assign",
  description:
    "Propose assigning a pending guest song request to a playlist — this copies the request into the playlist as a song (crediting the requester) and clears it from the pending queue. Requires a requestId AND a playlistId from read_songs. The request must still be unassigned. CAREFUL with polarity: assigning to the do-NOT-play list BANS the song — that needs confirmBlockList:true and only when the user explicitly wants it banned.",
  inputSchema,
  progressLabel: "Proposing song-request assignment…",
  definition: {
    name: "propose_song_request_assign",
    description:
      "Propose assigning a pending guest song request to a playlist (copies it in, clears the pending queue). Assigning to the do-not-play list bans the song — requires confirmBlockList:true. Requires requestId + playlistId from a prior read_songs call.",
    input_schema: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
          description: "Pending guest song-request id from read_songs.",
        },
        playlistId: { type: "string", description: "Target playlist id from read_songs." },
        confirmBlockList: {
          type: "boolean",
          description:
            "Must be true when the target playlist is the do-NOT-play list. Only pass it when the user explicitly wants the song banned.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this request fits the playlist.",
        },
      },
      required: ["requestId", "playlistId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const [request, playlist] = await Promise.all([
      db.songRequest.findUnique({
        where: { id: input.requestId },
        select: {
          title: true,
          artist: true,
          playlistId: true,
          guest: { select: { firstName: true, lastName: true } },
        },
      }),
      db.playlist.findUnique({
        where: { id: input.playlistId },
        select: { name: true, category: true, isBlockList: true },
      }),
    ]);

    // No songRequest family in resolveRefs — same prefix style, hand-rolled.
    const invalid: string[] = [];
    if (!request) invalid.push(`songRequest:${input.requestId}`);
    if (!playlist) invalid.push(`playlist:${input.playlistId}`);
    if (invalid.length || !request || !playlist) {
      return { ok: false, error: unknownIdsError(invalid) };
    }

    if (request.playlistId) {
      return {
        ok: false,
        error: "That request has already been handled — it's no longer in the pending queue.",
      };
    }

    // createPlaylist forces isBlockList for DO_NOT_PLAY, but imported /
    // seeded rows may predate that — check both signals (same as
    // propose_song_add).
    const isBlockList = playlist.isBlockList || playlist.category === "DO_NOT_PLAY";
    if (isBlockList && input.confirmBlockList !== true) {
      return {
        ok: false,
        error:
          "That's the do-NOT-play list — assigning a request there bans the song. Pass confirmBlockList:true only if the user explicitly wants it banned.",
      };
    }

    const payloadResult = songRequestAssignSchema.safeParse({
      requestId: input.requestId,
      playlistId: input.playlistId,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "song_request.assign",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const requester = request.guest
      ? `${request.guest.firstName} ${request.guest.lastName}`.trim()
      : "a guest";
    const songLabel = `${request.title}${request.artist ? ` — ${request.artist}` : ""}`;

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "song_request.assign",
        title: `Assign "${songLabel}" → ${playlist.name}`,
        detail: `requested by ${requester}${isBlockList ? " · do-NOT-play list — this bans the song" : ""}`,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
