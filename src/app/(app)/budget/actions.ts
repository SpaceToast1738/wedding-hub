"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PerHeadSource } from "@prisma/client";
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
  // v1.77.0: variable / per-head pricing fields. perHeadPence is sent
  // as pounds-with-decimal text (the £ input) and parsed to integer
  // pence; headcountSource null means the line is flat-estimated; a
  // non-null source with a null perHeadPence is treated as not-yet-
  // configured and falls back to flat.
  perHeadPence: z.string().optional().nullable(),
  headcountSource: z.nativeEnum(PerHeadSource).optional().nullable(),
  manualHeadcount: z.string().optional().nullable(),
  // v1.81.0: vendor minimum-cover floor.
  minimumHeadcount: z.string().optional().nullable(),
});

function parsePence(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[£,\s]/g, ""));
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}
function parseInteger(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseInt(String(s).trim(), 10);
  return isNaN(n) ? null : n;
}

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

// v1.53.0 (C1): result-shape return so caller can render a real
// error toast instead of relying on Next prod redaction. Most
// failures here are FK-blocked deletes (category has lines).
export type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteCategory(id: string): Promise<DeleteResult> {
  const user = await requireEdit("budget");
  try {
    // Snapshot before delete so the audit row reads usefully even
    // after the row is gone.
    const before = await db.budgetCategory.findUnique({
      where: { id },
      include: { _count: { select: { lines: true } } },
    });
    if (before && before._count.lines > 0) {
      // Friendlier than a Prisma FK-violation message: tell the user
      // to clear the lines first. (Schema may not enforce this — if
      // cascade is set, the delete would succeed and silently nuke
      // every line. Belt-and-braces.)
      return {
        ok: false,
        error: `Can't delete "${before.name}" — ${before._count.lines} line${before._count.lines === 1 ? "" : "s"} still in this category.`,
      };
    }
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
    return { ok: true };
  } catch (err) {
    console.error("deleteCategory failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't delete category",
    };
  }
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
    perHeadPence: formData.get("perHeadPence") || null,
    headcountSource: (formData.get("headcountSource") as string) || null,
    manualHeadcount: formData.get("manualHeadcount") || null,
    minimumHeadcount: formData.get("minimumHeadcount") || null,
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
      perHeadPence: parsePence(parsed.perHeadPence ?? null),
      headcountSource: parsed.headcountSource ?? null,
      manualHeadcount: parseInteger(parsed.manualHeadcount ?? null),
      minimumHeadcount: parseInteger(parsed.minimumHeadcount ?? null),
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
      perHeadPence: created.perHeadPence,
      headcountSource: created.headcountSource,
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
    perHeadPence: formData.get("perHeadPence") || null,
    headcountSource: (formData.get("headcountSource") as string) || null,
    manualHeadcount: formData.get("manualHeadcount") || null,
    minimumHeadcount: formData.get("minimumHeadcount") || null,
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
    perHeadPence: parsePence(parsed.perHeadPence ?? null),
    headcountSource: parsed.headcountSource ?? null,
    manualHeadcount: parseInteger(parsed.manualHeadcount ?? null),
    minimumHeadcount: parseInteger(parsed.minimumHeadcount ?? null),
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
    if (before.perHeadPence !== next.perHeadPence) changedFields.push("perHeadPence");
    if (before.headcountSource !== next.headcountSource) changedFields.push("headcountSource");
    if (before.manualHeadcount !== next.manualHeadcount) changedFields.push("manualHeadcount");
    if (before.minimumHeadcount !== next.minimumHeadcount) changedFields.push("minimumHeadcount");
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

export async function deleteLine(id: string): Promise<DeleteResult> {
  const user = await requireEdit("budget");
  try {
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
    return { ok: true };
  } catch (err) {
    console.error("deleteLine failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't delete line",
    };
  }
}

// ── v1.80.0: BudgetLineComponent CRUD ─────────────────────────────
//
// Sub-cost rows on a BudgetLine. Each component is either flat or
// per-head (mirrors the line shape). The line's effective estimated
// = sum of components when components exist; line-level flat/perHead
// fields are preserved but hidden by the UI while components exist.

const componentSchema = z.object({
  lineId: z.string().min(1),
  label: z.string().min(1).max(200),
  // Flat OR per-head — caller sends pence values. Sender enforces
  // mutual exclusion in the UI; server keeps both as nullable so a
  // dirty payload can still save without rejection.
  flatPence: z.number().int().min(0).optional().nullable(),
  perHeadPence: z.number().int().min(0).optional().nullable(),
  headcountSource: z.nativeEnum(PerHeadSource).optional().nullable(),
  manualHeadcount: z.number().int().min(0).optional().nullable(),
  // v1.81.0: vendor minimum-cover floor.
  minimumHeadcount: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function createComponent(payload: {
  lineId: string;
  label: string;
  flatPence?: number | null;
  perHeadPence?: number | null;
  headcountSource?: PerHeadSource | null;
  manualHeadcount?: number | null;
  minimumHeadcount?: number | null;
  notes?: string | null;
}): Promise<DeleteResult & { componentId?: string }> {
  const user = await requireEdit("budget");
  try {
    const parsed = componentSchema.parse(payload);
    const line = await db.budgetLine.findUnique({
      where: { id: parsed.lineId },
      include: { _count: { select: { components: true } } },
    });
    if (!line) return { ok: false, error: "Budget line not found" };
    const created = await db.budgetLineComponent.create({
      data: {
        lineId: parsed.lineId,
        label: parsed.label,
        flatPence: parsed.flatPence ?? null,
        perHeadPence: parsed.perHeadPence ?? null,
        headcountSource: parsed.headcountSource ?? null,
        manualHeadcount: parsed.manualHeadcount ?? null,
        minimumHeadcount: parsed.minimumHeadcount ?? null,
        notes: parsed.notes ?? null,
        order: line._count.components,
      },
    });
    await audit(user, {
      action: "budget-component-create",
      entity: "BudgetLineComponent",
      entityId: created.id,
      metadata: {
        lineId: parsed.lineId,
        lineDescription: line.description,
        label: parsed.label,
        flatPence: parsed.flatPence ?? null,
        perHeadPence: parsed.perHeadPence ?? null,
        headcountSource: parsed.headcountSource ?? null,
      },
    });
    revalidatePath("/budget");
    return { ok: true, componentId: created.id };
  } catch (err) {
    console.error("createComponent failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't create component" };
  }
}

export async function updateComponent(
  id: string,
  payload: {
    label: string;
    flatPence?: number | null;
    perHeadPence?: number | null;
    headcountSource?: PerHeadSource | null;
    manualHeadcount?: number | null;
    minimumHeadcount?: number | null;
    notes?: string | null;
  },
): Promise<DeleteResult> {
  const user = await requireEdit("budget");
  try {
    const before = await db.budgetLineComponent.findUnique({
      where: { id },
      include: { line: { select: { description: true } } },
    });
    if (!before) return { ok: false, error: "Component not found" };
    await db.budgetLineComponent.update({
      where: { id },
      data: {
        label: payload.label,
        flatPence: payload.flatPence ?? null,
        perHeadPence: payload.perHeadPence ?? null,
        headcountSource: payload.headcountSource ?? null,
        manualHeadcount: payload.manualHeadcount ?? null,
        minimumHeadcount: payload.minimumHeadcount ?? null,
        notes: payload.notes ?? null,
      },
    });
    const changedFields: string[] = [];
    if (before.label !== payload.label) changedFields.push("label");
    if (before.flatPence !== (payload.flatPence ?? null)) changedFields.push("flatPence");
    if (before.perHeadPence !== (payload.perHeadPence ?? null)) changedFields.push("perHeadPence");
    if (before.headcountSource !== (payload.headcountSource ?? null)) changedFields.push("headcountSource");
    if (before.manualHeadcount !== (payload.manualHeadcount ?? null)) changedFields.push("manualHeadcount");
    if (before.minimumHeadcount !== (payload.minimumHeadcount ?? null)) changedFields.push("minimumHeadcount");
    if (before.notes !== (payload.notes ?? null)) changedFields.push("notes");
    await audit(user, {
      action: "budget-component-update",
      entity: "BudgetLineComponent",
      entityId: id,
      metadata: {
        lineDescription: before.line.description,
        label: payload.label,
        changedFields,
      },
    });
    revalidatePath("/budget");
    return { ok: true };
  } catch (err) {
    console.error("updateComponent failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't update component" };
  }
}

export async function deleteComponent(id: string): Promise<DeleteResult> {
  const user = await requireEdit("budget");
  try {
    const before = await db.budgetLineComponent.findUnique({
      where: { id },
      include: { line: { select: { description: true } } },
    });
    await db.budgetLineComponent.delete({ where: { id } });
    await audit(user, {
      action: "budget-component-delete",
      entity: "BudgetLineComponent",
      entityId: id,
      metadata: {
        label: before?.label ?? null,
        lineDescription: before?.line.description ?? null,
        flatPence: before?.flatPence ?? null,
        perHeadPence: before?.perHeadPence ?? null,
      },
    });
    revalidatePath("/budget");
    return { ok: true };
  } catch (err) {
    console.error("deleteComponent failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't delete component" };
  }
}

export async function reorderComponents(
  lineId: string,
  orderedIds: string[],
): Promise<DeleteResult> {
  const user = await requireEdit("budget");
  try {
    await db.$transaction(
      orderedIds.map((cid, idx) =>
        db.budgetLineComponent.update({
          where: { id: cid },
          data: { order: idx },
        }),
      ),
    );
    await audit(user, {
      action: "budget-component-reorder",
      entity: "BudgetLine",
      entityId: lineId,
      metadata: { count: orderedIds.length },
    });
    revalidatePath("/budget");
    return { ok: true };
  } catch (err) {
    console.error("reorderComponents failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reorder" };
  }
}
