"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BookSubsectionVisibility } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit, requireUser } from "@/lib/actions";

const sectionSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "slug: lowercase letters, numbers, dashes only"),
  title: z.string().min(1).max(120),
});

const subsectionSchema = z.object({
  sectionId: z.string().min(1),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(120),
  body: z.string().max(20000).optional().nullable(),
});

export async function createBookSection(formData: FormData) {
  const user = await requireEdit("book");
  const parsed = sectionSchema.parse({
    slug: formData.get("slug"),
    title: formData.get("title"),
  });
  const last = await db.bookSection.findFirst({ orderBy: { order: "desc" } });
  const created = await db.bookSection.create({
    data: { slug: parsed.slug, title: parsed.title, order: (last?.order ?? -1) + 1 },
  });
  await audit(user, { action: "create", entity: "BookSection", entityId: created.id });
  revalidatePath("/book");
}

export async function deleteBookSection(id: string) {
  const user = await requireEdit("book");
  await db.bookSection.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "BookSection", entityId: id });
  revalidatePath("/book");
}

export async function createBookSubsection(formData: FormData) {
  const user = await requireEdit("book");
  const parsed = subsectionSchema.parse({
    sectionId: formData.get("sectionId"),
    slug: formData.get("slug"),
    title: formData.get("title"),
    body: formData.get("body") || null,
  });
  const last = await db.bookSubsection.findFirst({ where: { sectionId: parsed.sectionId }, orderBy: { order: "desc" } });
  const created = await db.bookSubsection.create({
    data: {
      sectionId: parsed.sectionId,
      slug: parsed.slug,
      title: parsed.title,
      body: parsed.body ?? null,
      order: (last?.order ?? -1) + 1,
    },
  });
  await audit(user, { action: "create", entity: "BookSubsection", entityId: created.id });
  revalidatePath("/book");
  const section = await db.bookSection.findUnique({ where: { id: parsed.sectionId } });
  if (section) revalidatePath(`/book/${section.slug}`);
}

export async function updateBookSubsection(id: string, formData: FormData) {
  const user = await requireEdit("book");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  if (!title) throw new Error("Title is required");
  const updated = await db.bookSubsection.update({
    where: { id },
    data: { title, body: body || null },
    include: { section: true },
  });
  await audit(user, { action: "update", entity: "BookSubsection", entityId: id });
  revalidatePath("/book");
  revalidatePath(`/book/${updated.section.slug}`);
}

export async function deleteBookSubsection(id: string) {
  const user = await requireEdit("book");
  const sub = await db.bookSubsection.findUnique({ where: { id }, include: { section: true } });
  await db.bookSubsection.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "BookSubsection", entityId: id });
  revalidatePath("/book");
  if (sub) revalidatePath(`/book/${sub.section.slug}`);
}

// C1 (v1.14.0): only the couple can flip a subsection's visibility.
// Same shape as the A6 file-visibility gate (post-audit lockdown):
// non-couple users with edit-on-book can edit content, but only the
// couple decides what's couple-only.
export async function setBookSubsectionVisibility(
  id: string,
  visibility: BookSubsectionVisibility,
) {
  const user = await requireUser();
  if (!user.isCouple) {
    throw new Error("Forbidden: only the couple can change page visibility");
  }
  const sub = await db.bookSubsection.update({
    where: { id },
    data: { visibility },
    include: { section: true },
  });
  await audit(user, {
    action: "visibility",
    entity: "BookSubsection",
    entityId: id,
    metadata: { visibility },
  });
  revalidatePath("/book");
  revalidatePath(`/book/${sub.section.slug}`);
}

// v1.24.0: same gate, applied at the BookSection level so the couple
// can hide a whole section (not just individual pages). Mirrors the
// subsection action above 1:1.
export async function setBookSectionVisibility(
  id: string,
  visibility: BookSubsectionVisibility,
) {
  const user = await requireUser();
  if (!user.isCouple) {
    throw new Error("Forbidden: only the couple can change section visibility");
  }
  const section = await db.bookSection.update({
    where: { id },
    data: { visibility },
  });
  await audit(user, {
    action: "visibility",
    entity: "BookSection",
    entityId: id,
    metadata: { visibility },
  });
  revalidatePath("/book");
  revalidatePath(`/book/${section.slug}`);
}
