"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PlaylistCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

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
