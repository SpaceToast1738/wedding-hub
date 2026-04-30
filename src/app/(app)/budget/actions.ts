"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

// v1.39.0: every audit() call here was previously bare —
// `{ entity, entityId }` only. Per the v1.30.5 standing rule
// every action emits enriched metadata: snapshot fields on
// create / delete, `changedFields` diff on update. Money-sensitive
// surface so the audit log matters more here than most.

const categorySchema = z.object({
  name: z.string().min(1).max(100),
});

const lineSchema = z.object({
  categoryId: z.string().min(1),
  description: z.string().min(1).max(200),
  estimated: z.string().optional().nullable(),
  actual: z.string().optional().nullable(),
  paid: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

function parseAmount(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[£,\s]/g, ""));
  return isNaN(n) ? null : n;
}

function decimalToNumber(d: { toString: () => string } | null | undefined): number | null {
  if (d == null) return null;
  const n = Number(d.toString());
  return isNaN(n) ? null : n;
}

export async function createCategory(formData: FormData) {
  const user = await requireEdit("budget");
  const parsed = categorySchema.parse({ name: formData.get("name") });
  const last = await db.budgetCategory.findFirst({ orderBy: { order: "desc" } });
  const order = (last?.order ?? -1) + 1;
  const created = await db.budgetCategory.create({ data: { name: parsed.name, order } });
  await audit(user, {
    action: "create",
    entity: "BudgetCategory",
    entityId: created.id,
    metadata: { name: created.name, order: created.order },
  });
  revalidatePath("/budget");
}

export async function deleteCategory(id: string) {
  const user = await requireEdit("budget");
  // Snapshot before delete so the audit row reads usefully even
  // after the row is gone.
  const before = await db.budgetCategory.findUnique({
    where: { id },
    include: { _count: { select: { lines: true } } },
  });
  await db.budgetCategory.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "BudgetCategory",
    entityId: id,
    metadata: {
      name: before?.name ?? null,
      lineCount: before?._count.lines ?? 0,
    },
  });
  revalidatePath("/budget");
}

export async function createLine(formData: FormData) {
  const user = await requireEdit("budget");
  const parsed = lineSchema.parse({
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
    estimated: formData.get("estimated") || null,
    actual: formData.get("actual") || null,
    paid: formData.get("paid") || null,
    supplierId: formData.get("supplierId") || null,
    notes: formData.get("notes") || null,
  });
  const created = await db.budgetLine.create({
    data: {
      categoryId: parsed.categoryId,
      description: parsed.description,
      estimated: parseAmount(parsed.estimated ?? null),
      actual: parseAmount(parsed.actual ?? null),
      paid: parseAmount(parsed.paid ?? null),
      supplierId: parsed.supplierId || null,
      notes: parsed.notes ?? null,
    },
    include: { category: { select: { name: true } } },
  });
  await audit(user, {
    action: "create",
    entity: "BudgetLine",
    entityId: created.id,
    metadata: {
      description: created.description,
      categoryName: created.category.name,
      estimated: decimalToNumber(created.estimated),
      actual: decimalToNumber(created.actual),
      paid: decimalToNumber(created.paid),
      supplierId: created.supplierId,
    },
  });
  revalidatePath("/budget");
}

export async function updateLine(id: string, formData: FormData) {
  const user = await requireEdit("budget");
  const parsed = lineSchema.parse({
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
    estimated: formData.get("estimated") || null,
    actual: formData.get("actual") || null,
    paid: formData.get("paid") || null,
    supplierId: formData.get("supplierId") || null,
    notes: formData.get("notes") || null,
  });
  // Read before so the audit row can diff old vs new on the fields
  // the user actually changed.
  const before = await db.budgetLine.findUnique({
    where: { id },
    include: { category: { select: { name: true } } },
  });
  const next = {
    categoryId: parsed.categoryId,
    description: parsed.description,
    estimated: parseAmount(parsed.estimated ?? null),
    actual: parseAmount(parsed.actual ?? null),
    paid: parseAmount(parsed.paid ?? null),
    supplierId: parsed.supplierId || null,
    notes: parsed.notes ?? null,
  };
  await db.budgetLine.update({ where: { id }, data: next });

  const changedFields: string[] = [];
  if (before) {
    if (before.categoryId !== next.categoryId) changedFields.push("categoryId");
    if (before.description !== next.description) changedFields.push("description");
    if (decimalToNumber(before.estimated) !== next.estimated) changedFields.push("estimated");
    if (decimalToNumber(before.actual) !== next.actual) changedFields.push("actual");
    if (decimalToNumber(before.paid) !== next.paid) changedFields.push("paid");
    if (before.supplierId !== next.supplierId) changedFields.push("supplierId");
    if (before.notes !== next.notes) changedFields.push("notes");
  }
  await audit(user, {
    action: "update",
    entity: "BudgetLine",
    entityId: id,
    metadata: {
      description: next.description,
      categoryName: before?.category.name ?? null,
      changedFields,
    },
  });
  revalidatePath("/budget");
}

export async function deleteLine(id: string) {
  const user = await requireEdit("budget");
  const before = await db.budgetLine.findUnique({
    where: { id },
    include: { category: { select: { name: true } } },
  });
  await db.budgetLine.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "BudgetLine",
    entityId: id,
    metadata: {
      description: before?.description ?? null,
      categoryName: before?.category.name ?? null,
      estimated: decimalToNumber(before?.estimated),
      actual: decimalToNumber(before?.actual),
      paid: decimalToNumber(before?.paid),
    },
  });
  revalidatePath("/budget");
}
