import { z } from "zod";
import { db } from "@/lib/db";
import { songRemoveSchema } from "@/lib/ai/proposals/schemas";
import { takeProposalSlots } from "./propose-common";
import {
  clipDisplay,
  DELETE_PROPOSED_MESSAGE,
  reasonFromRationale,
} from "./propose-delete-common";
import type { AiTool } from "./types";

// v2.8.0: destructive kind. Bridges to the song.remove apply handler
// (src/lib/ai/apply/deletes.ts) — a PERMANENT delete of one song row
// from its playlist; the playlist itself is untouched.
const inputSchema = z.object({
  songId: z
    .string()
    .min(1)
    .describe("The id of the song to remove — get this from a prior read_songs call."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One or two sentences explaining WHY this song should be removed. Shown to the couple.",
    ),
});

export const proposeSongRemove: AiTool<typeof inputSchema> = {
  name: "propose_song_remove",
  description:
    "Propose PERMANENTLY removing a song from its playlist (the playlist itself is untouched). This is destructive: applying deletes the song row for good (a JSON snapshot is kept on the proposal for manual recovery, but there is no undo button). Use for duplicates, wrong entries, or songs the couple has vetoed — if the song merely belongs on a different playlist, say so in chat instead; moving between playlists is not yet a proposal kind. Requires a songId from read_songs.",
  inputSchema,
  progressLabel: "Proposing song removal…",
  definition: {
    name: "propose_song_remove",
    description:
      "Propose permanently removing a song from its playlist (snapshot-backed, no undo; the playlist survives). Requires songId from a prior read_songs call.",
    input_schema: {
      type: "object",
      properties: {
        songId: { type: "string", description: "From read_songs output." },
        rationale: {
          type: "string",
          description: "One or two sentences explaining why this song should be removed.",
        },
      },
      required: ["songId", "rationale"],
    },
  },
  async handler(input, ctx) {
    const guard = takeProposalSlots(ctx);
    if (guard) return guard;

    const song = await db.song.findUnique({
      where: { id: input.songId },
      select: {
        title: true,
        artist: true,
        playlist: { select: { name: true } },
      },
    });
    if (!song) {
      // No song family in resolveRefs — same prefix style, hand-rolled.
      return {
        ok: false,
        error: `Unknown ids: song:${input.songId}. Use ids from a read tool — never invent ids.`,
      };
    }
    const songLabel = song.artist ? `${song.title} — ${song.artist}` : song.title;

    const payloadResult = songRemoveSchema.safeParse({
      songId: input.songId,
      targetLabel: clipDisplay(songLabel, 200),
      reason: reasonFromRationale(input.rationale),
    });
    if (!payloadResult.success) {
      return {
        ok: false,
        error: `Payload validation failed: ${payloadResult.error.message}`,
      };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: ctx.user.id,
        kind: "song.remove",
        payload: payloadResult.data as unknown as object,
        rationale: input.rationale,
        batchId: ctx.batchId ?? null,
      },
    });

    return {
      ok: true,
      data: {
        proposalId: proposal.id,
        kind: "song.remove",
        title: `Remove "${song.title}"`,
        detail: `from playlist "${song.playlist.name}" · permanent — snapshot kept`,
        message: DELETE_PROPOSED_MESSAGE,
      },
    };
  },
};
