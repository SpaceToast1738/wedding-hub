"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FundSource, PerHeadSource } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
// v2.8.0: the category/line Zod schemas and the createCategory /
// createLine / updateLine BODIES moved to @/lib/core/money so the MCP
// self-apply path can run the identical write logic (integer-pence
// handling, audit rows, revalidations) without a browser session. This
// file keeps the FormData plumbing plus the requireEdit auth gates —
// human behaviour is unchanged. decimalToNumber is imported back for
// deleteLine's audit metadata (still a session-bound action here).
// v2.8.1: the component schema + createComponent / updateComponent
// bodies likewise moved to @/lib/core/money (budget.component_create /
// budget.component_update self-apply).
import {
  categoryInputSchema,
  componentInputSchema,
  createCategoryCore,
  createComponentCore,
  createLineCore,
  decimalToNumber,
  lineInputSchema,
  renameCategoryCore,
  updateComponentCore,
  updateLineCore,
} from "@/lib/core/money";

// v1.39.0: every audit() call here was previously bare —
// `{ entity, entityId }` only. Per the v1.30.5 standing rule
// every action emits enriched metadata: snapshot fields on
// create / delete, `changedFields` diff on update. Money-sensitive
// surface so the audit log matters more here than most.

export async function createCategory(formData: FormData): Promise<{ id: string }> {
  const user = await requireEdit("budget");
  const parsed = categoryInputSchema.parse({ name: formData.get("name") });
  // v2.8.0: body lives in createCategoryCore.
  return createCategoryCore(user, parsed);
}

// v1.53.0 (C1): result-shape return so caller can render a real
// error toast instead of relying on Next prod redaction. Most
// failures here are FK-blocked deletes (category has lines).
export type DeleteResult = { ok: true } | { ok: false; error: string };

// v1.85.0: rename a BudgetCategory. Same Zod shape as create so length
// + non-empty rules stay consistent.
export async function renameCategory(
  id: string,
  name: string,
): Promise<DeleteResult> {
  const user = await requireEdit("budget");
  try {
    // v2.9.2: body lives in renameCategoryCore (session-free) so the
    // budget.category.update AI apply path renames identically. The core
    // throws "Category not found" for a missing row and no-ops when the
    // name is unchanged, matching the prior inline behaviour.
    await renameCategoryCore(user, id, name);
    return { ok: true };
  } catch (err) {
    console.error("renameCategory failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't rename category" };
  }
}

// v1.85.0: reorder BudgetCategory rows. Caller passes the new
// canonical id-order; server rewrites the `order` column in one
// transaction. Mirrors `reorderComponents` shape.
export async function reorderCategories(
  orderedIds: string[],
): Promise<DeleteResult> {
  const user = await requireEdit("budget");
  try {
    await db.$transaction(
      orderedIds.map((cid, idx) =>
        db.budgetCategory.update({ where: { id: cid }, data: { order: idx } }),
      ),
    );
    await audit(user, {
      action: "budget-category-reorder",
      entity: "BudgetCategory",
      entityId: orderedIds[0] ?? "",
      metadata: { count: orderedIds.length, orderedIds },
    });
    revalidatePath("/budget");
    return { ok: true };
  } catch (err) {
    console.error("reorderCategories failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reorder categories" };
  }
}

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

export async function createLine(formData: FormData): Promise<{ id: string }> {
  const user = await requireEdit("budget");
  const parsed = lineInputSchema.parse({
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
    // v1.86.0: fund fields. Empty string ⇒ null (unassigned).
    fundSource: (formData.get("fundSource") as string) || null,
    fundLabel: formData.get("fundLabel") || null,
  });
  // v2.8.0: body lives in createLineCore.
  return createLineCore(user, parsed);
}

export async function updateLine(id: string, formData: FormData) {
  const user = await requireEdit("budget");
  const parsed = lineInputSchema.parse({
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
    // v1.86.0: fund fields.
    fundSource: (formData.get("fundSource") as string) || null,
    fundLabel: formData.get("fundLabel") || null,
  });
  // v2.8.0: body lives in updateLineCore.
  await updateLineCore(user, id, parsed);
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

// v2.8.1: parse + auth + delegate. The componentSchema and the
// create/update bodies moved to @/lib/core/money (componentInputSchema /
// createComponentCore / updateComponentCore) so the AI apply path shares
// one implementation. Behaviour is byte-identical: the cores throw on a
// missing line/component, and this wrapper's catch maps that to the same
// { ok:false, error } shape ("Budget line not found" / "Component not
// found") the inline version returned.
export async function createComponent(payload: {
  lineId: string;
  label: string;
  flatPence?: number | null;
  perHeadPence?: number | null;
  headcountSource?: PerHeadSource | null;
  manualHeadcount?: number | null;
  minimumHeadcount?: number | null;
  notes?: string | null;
  // v1.86.0: optional fund override.
  fundSource?: FundSource | null;
  fundLabel?: string | null;
}): Promise<DeleteResult & { componentId?: string }> {
  const user = await requireEdit("budget");
  try {
    const parsed = componentInputSchema.parse(payload);
    const created = await createComponentCore(user, parsed);
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
    // v1.86.0
    fundSource?: FundSource | null;
    fundLabel?: string | null;
  },
): Promise<DeleteResult> {
  const user = await requireEdit("budget");
  try {
    // The human path never validated this payload (it wrote fields
    // directly), so keep passing it straight through — updateComponentCore
    // takes exactly this shape minus lineId.
    await updateComponentCore(user, id, payload);
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

// ── v1.86.0: fund quick-action helpers ────────────────────────────
//
// Tiny dedicated actions so the per-row fund chip on /budget can
// flip the fund + free-text label in one call without revalidating
// the whole line / component schema. Use these when ONLY the fund
// is changing; use updateLine / updateComponent for any other edit.

const fundQuickSchema = z.object({
  fundSource: z.nativeEnum(FundSource).optional().nullable(),
  fundLabel: z.string().max(120).optional().nullable(),
});

export async function setLineFund(
  id: string,
  payload: { fundSource?: FundSource | null; fundLabel?: string | null },
): Promise<DeleteResult> {
  const user = await requireEdit("budget");
  try {
    const parsed = fundQuickSchema.parse(payload);
    const before = await db.budgetLine.findUnique({
      where: { id },
      select: { id: true, description: true, fundSource: true, fundLabel: true },
    });
    if (!before) return { ok: false, error: "Budget line not found" };
    const nextLabel = (parsed.fundLabel?.trim() || null) ?? null;
    const nextSource = parsed.fundSource ?? null;
    if (before.fundSource === nextSource && before.fundLabel === nextLabel) {
      return { ok: true }; // no-op
    }
    await db.budgetLine.update({
      where: { id },
      data: { fundSource: nextSource, fundLabel: nextLabel },
    });
    const changedFields: string[] = [];
    if (before.fundSource !== nextSource) changedFields.push("fundSource");
    if (before.fundLabel !== nextLabel) changedFields.push("fundLabel");
    await audit(user, {
      action: "budget-line-fund-set",
      entity: "BudgetLine",
      entityId: id,
      metadata: {
        description: before.description,
        priorFundSource: before.fundSource,
        priorFundLabel: before.fundLabel,
        fundSource: nextSource,
        fundLabel: nextLabel,
        changedFields,
      },
    });
    revalidatePath("/budget");
    return { ok: true };
  } catch (err) {
    console.error("setLineFund failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't set fund" };
  }
}

export async function setComponentFund(
  id: string,
  payload: { fundSource?: FundSource | null; fundLabel?: string | null },
): Promise<DeleteResult> {
  const user = await requireEdit("budget");
  try {
    const parsed = fundQuickSchema.parse(payload);
    const before = await db.budgetLineComponent.findUnique({
      where: { id },
      select: {
        id: true,
        label: true,
        fundSource: true,
        fundLabel: true,
        line: { select: { description: true } },
      },
    });
    if (!before) return { ok: false, error: "Component not found" };
    const nextLabel = (parsed.fundLabel?.trim() || null) ?? null;
    const nextSource = parsed.fundSource ?? null;
    if (before.fundSource === nextSource && before.fundLabel === nextLabel) {
      return { ok: true };
    }
    await db.budgetLineComponent.update({
      where: { id },
      data: { fundSource: nextSource, fundLabel: nextLabel },
    });
    const changedFields: string[] = [];
    if (before.fundSource !== nextSource) changedFields.push("fundSource");
    if (before.fundLabel !== nextLabel) changedFields.push("fundLabel");
    await audit(user, {
      action: "budget-component-fund-set",
      entity: "BudgetLineComponent",
      entityId: id,
      metadata: {
        label: before.label,
        lineDescription: before.line.description,
        priorFundSource: before.fundSource,
        priorFundLabel: before.fundLabel,
        fundSource: nextSource,
        fundLabel: nextLabel,
        changedFields,
      },
    });
    revalidatePath("/budget");
    return { ok: true };
  } catch (err) {
    console.error("setComponentFund failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't set fund" };
  }
}
