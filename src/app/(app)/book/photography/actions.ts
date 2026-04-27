"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

const titleSchema = z.string().min(1).max(200);
const withWhomSchema = z.array(z.string().min(1).max(100)).max(20).default([]);
const locationSchema = z.string().max(200).nullable().optional();
const notesSchema = z.string().max(2000).nullable().optional();

// Parse a comma-separated names string from a form input. Trims, drops
// empties, dedupes case-insensitively while preserving the first casing.
function parseNames(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.slice(0, 20);
}

export async function createShot(formData: FormData) {
  const user = await requireEdit("book");
  const title = titleSchema.parse(formData.get("title"));
  const withWhom = withWhomSchema.parse(parseNames(formData.get("withWhom")));
  const locationRaw = (formData.get("location") || "").toString().trim();
  const location = locationSchema.parse(locationRaw || null);
  const notesRaw = (formData.get("notes") || "").toString().trim();
  const notes = notesSchema.parse(notesRaw || null);

  // New shots go to the bottom of the list.
  const max = await db.photographyShot.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? 0) + 1;

  const created = await db.photographyShot.create({
    data: { title, withWhom, location: location ?? null, notes: notes ?? null, order },
  });
  await audit(user, { action: "create", entity: "PhotographyShot", entityId: created.id });
  revalidatePath("/book/photography");
}

export async function updateShot(id: string, formData: FormData) {
  const user = await requireEdit("book");
  const title = titleSchema.parse(formData.get("title"));
  const withWhom = withWhomSchema.parse(parseNames(formData.get("withWhom")));
  const locationRaw = (formData.get("location") || "").toString().trim();
  const location = locationSchema.parse(locationRaw || null);
  const notesRaw = (formData.get("notes") || "").toString().trim();
  const notes = notesSchema.parse(notesRaw || null);

  await db.photographyShot.update({
    where: { id },
    data: { title, withWhom, location: location ?? null, notes: notes ?? null },
  });
  await audit(user, { action: "update", entity: "PhotographyShot", entityId: id });
  revalidatePath("/book/photography");
}

export async function toggleShotCaptured(id: string, captured: boolean) {
  const user = await requireEdit("book");
  await db.photographyShot.update({
    where: { id },
    data: { captured, capturedAt: captured ? new Date() : null },
  });
  await audit(user, {
    action: captured ? "capture" : "uncapture",
    entity: "PhotographyShot",
    entityId: id,
  });
  revalidatePath("/book/photography");
}

export async function deleteShot(id: string) {
  const user = await requireEdit("book");
  await db.photographyShot.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "PhotographyShot", entityId: id });
  revalidatePath("/book/photography");
}

// Move a shot up (delta=-1) or down (delta=+1) in the list. Implemented as a
// swap with the neighbour at the requested position so we don't have to
// renumber the whole list on every reorder.
export async function moveShot(id: string, delta: -1 | 1) {
  const user = await requireEdit("book");
  const shots = await db.photographyShot.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, order: true },
  });
  const idx = shots.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const swapIdx = idx + delta;
  if (swapIdx < 0 || swapIdx >= shots.length) return;
  const a = shots[idx]!;
  const b = shots[swapIdx]!;
  await db.$transaction([
    db.photographyShot.update({ where: { id: a.id }, data: { order: b.order } }),
    db.photographyShot.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  await audit(user, { action: "reorder", entity: "PhotographyShot", entityId: id });
  revalidatePath("/book/photography");
}
