import { z } from "zod";
import { db } from "@/lib/db";
import { songAddSchema } from "@/lib/ai/proposals/schemas";
import { unknownIdsError } from "./validate-refs";
import { takeProposalSlots } from "./propose-common";
import type { AiTool } from "./types";

// confirmBlockList is propose-time only — it never enters the payload.
// It exists because "add this song to the do-not-play list" and "add
// this song somewhere" are opposite requests with identical shapes.
const inputSchema = z.object({
  playlistId: z
    .string()
    .min(1)
    .describe("Playlist id — get this from read_songs, never invent one."),
  title: z.string().min(1).max(200),
  artist: z.string().max(200).optional(),
  source: z.string().max(100).optional().describe('Where it came from, e.g. "guest request".'),
  confirmBlockList: z
    .boolean()
    .optional()
    .describe("Required true when targeting the do-NOT-play list — adding a song there bans it."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One or two sentences explaining WHY this song fits the playlist."),
});

export const proposeSongAdd: AiTool<typeof inputSchema> = {
  name: "propose_song_add",
  description:
    "Propose adding a song to an existing playlist. Requires a playlistId from read_songs. CAREFUL with polarity: adding a song to the do-NOT-play list BANS it from the wedding — that needs confirmBlockList:true and only when the user explicitly wants the song banned. Include a rationale.",
  inputSchema,
  progressLabel: "Proposing song…",
  definition: {
    name: "propose_song_add",
    description:
      "Propose adding a song to a playlist. Adding to the do-not-play list bans the song — that requires confirmBlockList:true.",
    input_schema: {
      type: "object",
      properties: {
        playlistId: { type: "string", description: "Playlist id from read_songs." },
        title: { type: "string", description: "Song title." },
        artist: { type: "string", description: "Artist name. Optional but strongly preferred." },
        source: {
          type: "string",
          description: 'Where the suggestion came from, e.g. "guest request", "couple".',
        },
        confirmBlockList: {
          type: "boolean",
          description:
            "Must be true when the target playlist is the do-NOT-play list. Only pass it when the user explicitly wants the song banned.",
        },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this song fits the playlist.",
        },
      },
      required: ["playlistId", "title", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const playlist = await db.playlist.findUnique({
      where: { id: input.playlistId },
      select: { name: true, category: true, isBlockList: true },
    });
    if (!playlist) {
      return { ok: false, error: unknownIdsError([`playlist:${input.playlistId}`]) };
    }

    // createPlaylist forces isBlockList for DO_NOT_PLAY, but imported /
    // seeded rows may predate that — check both signals.
    const isBlockList = playlist.isBlockList || playlist.category === "DO_NOT_PLAY";
    if (isBlockList && input.confirmBlockList !== true) {
      return {
        ok: false,
        error:
          "That's the do-NOT-play list — adding a song there bans it. Pass confirmBlockList:true only if the user explicitly wants it banned.",
      };
    }

    const payloadResult = songAddSchema.safeParse({
      playlistId: input.playlistId,
      title: input.title,
      artist: input.artist ?? null,
      source: input.source ?? null,
    });
    if (!payloadResult.success) {
      return { ok: false, error: `Payload validation failed: ${payloadResult.error.message}` };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "song.add",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    const detail = `→ ${playlist.name}${isBlockList ? " (do-NOT-play list — this bans the song)" : ""}`;

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "song.add",
        title: `${input.title}${input.artist ? ` — ${input.artist}` : ""}`,
        detail,
        message:
          "Proposal queued. It will show up in the panel for the couple to Apply or Dismiss.",
      },
    };
  },
};
