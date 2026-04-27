"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

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

export async function createCategory(formData: FormData) {
  const user = await requireEdit("budget");
  const parsed = categorySchema.parse({ name: formData.get("name") });
  const last = await db.budgetCategory.findFirst({ orderBy: { order: "desc" } });
  const order = (last?.order ?? -1) + 1;
  const created = await db.budgetCategory.create({ data: { name: parsed.name, order } });
  await audit(user, { action: "create", entity: "BudgetCategory", entityId: created.id });
  revalidatePath("/budget");
}

export async function deleteCategory(id: string) {
  const user = await requireEdit("budget");
  await db.budgetCategory.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "BudgetCategory", entityId: id });
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
  });
  await audit(user, { action: "create", entity: "BudgetLine", entityId: created.id });
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
  await db.budgetLine.update({
    where: { id },
    data: {
      categoryId: parsed.categoryId,
      description: parsed.description,
      estimated: parseAmount(parsed.estimated ?? null),
      actual: parseAmount(parsed.actual ?? null),
      paid: parseAmount(parsed.paid ?? null),
      supplierId: parsed.supplierId || null,
      notes: parsed.notes ?? null,
    },
  });
  await audit(user, { action: "update", entity: "BudgetLine", entityId: id });
  revalidatePath("/budget");
}

export async function deleteLine(id: string) {
  const user = await requireEdit("budget");
  await db.budgetLine.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "BudgetLine", entityId: id });
  revalidatePath("/budget");
}
