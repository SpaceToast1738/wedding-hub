// v2.8.0: session-free cores for the money write surface (budget +
// payments) — the couple-only half of the T1 self-apply feature.
//
// The MCP agent applies its own proposals over token auth — no Auth.js
// session exists on that path, so the entity-writing halves of the
// budget/payment actions can't live behind `requireEdit()` in a
// "use server" file. They live here instead, taking an explicit
// `user: SessionUser` (same contract as src/lib/core/{tasks,guests,
// schedule,suppliers,book}.ts).
//
// Contract:
// - Cores do NOT authenticate. Callers own the gate. The server-action
//   wrappers in budget/actions.ts + payments/actions.ts run
//   requireEdit("budget"/"payments") before delegating; the AI apply
//   module (src/lib/ai/apply/money.ts) re-asserts the same section gate
//   via canEdit before calling in. budget/payments are COUPLE_ONLY_
//   SECTIONS, so canEdit hard-denies every non-couple user — money
//   stays couple-only end to end, exactly as the human requireEdit did.
//   NEVER export these from a "use server" file: any export there
//   becomes a client-invokable action, and a core that takes `user` as
//   a parameter instead of reading the session would be a forged-user
//   endpoint.
// - Cores keep EVERYTHING after the parse: the integer-pence handling
//   (parseAmount/parsePence on pound-strings), db writes, the
//   component→line resolution, the maybeMarkMaterialOrdered side
//   effect, changedFields diffs, audit rows and every revalidatePath —
//   so human flows through the wrappers stay byte-identical.
// - Cores take the action-schema parse OUTPUT. Wrappers parse FormData;
//   the AI apply path parses its (pence→pound-string) payload through
//   the same exported schemas so validation is identical on both routes.
//   NB the money schemas parse pound-STRINGS (the £ inputs); the
//   pence→number conversion happens INSIDE the cores via parseAmount/
//   parsePence, so the silent NaN→null path and the 100x-unit mistake
//   stay exactly where they were.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FundSource, PaymentStatus, PerHeadSource } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
// Type-only import — a VALUE import from @/lib/actions would drag the
// @/auth (next-auth) module graph into every consumer, breaking the
// isolated tool-registry seam.
import type { SessionUser } from "@/lib/actions";

// ─── Schemas (moved verbatim from budget/actions.ts + payments/actions.ts) ──
//
// Named *InputSchema to stay visually distinct from the AI payload
// schemas in src/lib/ai/proposals/schemas.ts. Exported so both the
// wrappers and the AI apply path validate against the SAME shape.

export const categoryInputSchema = z.object({
  name: z.string().min(1).max(100),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const lineInputSchema = z.object({
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
  // v1.86.0: funding-source tag. Null = unassigned (default). When
  // null, payments + components inherit silently from the line's
  // sibling fields.
  fundSource: z.nativeEnum(FundSource).optional().nullable(),
  fundLabel: z.string().max(120).optional().nullable(),
});
export type LineInput = z.infer<typeof lineInputSchema>;

export const paymentInputSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.string().min(1),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.DUE),
  dueDate: z.string().optional().nullable(),
  paidDate: z.string().optional().nullable(),
  method: z.string().max(100).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  // v1.75.0
  fileIds: z.string().array().default([]),
  bookBuildMaterialId: z.string().optional().nullable(),
  bookOutfitId: z.string().optional().nullable(),
  // v1.79.0: budget line link. When set, this payment's amount rolls
  // into the line's `actual` via the B2 contract.
  budgetLineId: z.string().optional().nullable(),
  // v1.80.0: component-level link.
  budgetLineComponentId: z.string().optional().nullable(),
  // v1.86.0: funding-source override.
  fundSource: z.nativeEnum(FundSource).optional().nullable(),
  fundLabel: z.string().max(120).optional().nullable(),
});
export type PaymentInput = z.infer<typeof paymentInputSchema>;

// ─── Parse helpers (moved verbatim; conversions stay inside the cores) ──

/** Budget amount parser: silently returns null on unparseable/empty. */
function parseAmountOrNull(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[£,\s]/g, ""));
  if (isNaN(n)) return null;
  return n;
}
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
/** Exported: still needed by deleteLine's audit metadata in
 *  budget/actions.ts, which stays a "use server" action. */
export function decimalToNumber(
  d: { toString: () => string } | null | undefined,
): number | null {
  if (d == null) return null;
  const n = Number(d.toString());
  return isNaN(n) ? null : n;
}

/** Payment amount parser: THROWS on unparseable (the £ field is
 *  required, unlike a budget line's optional estimate). */
function parsePaymentAmount(s: string): number {
  const n = Number(String(s).replace(/[£,\s]/g, ""));
  if (isNaN(n)) throw new Error("Amount must be a number");
  return n;
}
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// v1.75.0: side effect — when a payment is linked to a BUILD material
// that's currently `ordered: false`, flip it to true. Captures an
// audit trail so the BUILD card history shows where the order flag
// came from. Skipped (and silently no-op) if the material is already
// ordered or the link target doesn't exist.
async function maybeMarkMaterialOrdered(
  user: SessionUser,
  materialId: string | null,
  paymentId: string,
): Promise<void> {
  if (!materialId) return;
  const material = await db.bookBuildMaterial.findUnique({
    where: { id: materialId },
    include: { card: { select: { subsectionId: true } } },
  });
  if (!material || material.ordered) return;
  await db.bookBuildMaterial.update({
    where: { id: materialId },
    data: { ordered: true },
  });
  await logAudit({
    userId: user.id,
    action: "build-material-ordered-by-payment",
    entity: "BookBuildMaterial",
    entityId: materialId,
    metadata: { paymentId, materialName: material.name },
  });
}

// ─── Budget cores ───────────────────────────────────────────────────

/** v2.8.0: extracted body of createCategory. */
export async function createCategoryCore(
  user: SessionUser,
  parsed: CategoryInput,
): Promise<{ id: string }> {
  const last = await db.budgetCategory.findFirst({ orderBy: { order: "desc" } });
  const order = (last?.order ?? -1) + 1;
  const created = await db.budgetCategory.create({ data: { name: parsed.name, order } });
  await logAudit({
    userId: user.id,
    action: "create",
    entity: "BudgetCategory",
    entityId: created.id,
    metadata: { name: created.name, order: created.order },
  });
  revalidatePath("/budget");
  // v2.4.0: return the id so the AI apply-bridge can link the row.
  return { id: created.id };
}

/** v2.8.0: extracted body of createLine. */
export async function createLineCore(
  user: SessionUser,
  parsed: LineInput,
): Promise<{ id: string }> {
  const created = await db.budgetLine.create({
    data: {
      categoryId: parsed.categoryId,
      description: parsed.description,
      estimated: parseAmountOrNull(parsed.estimated ?? null),
      actual: parseAmountOrNull(parsed.actual ?? null),
      paid: parseAmountOrNull(parsed.paid ?? null),
      supplierId: parsed.supplierId || null,
      notes: parsed.notes ?? null,
      perHeadPence: parsePence(parsed.perHeadPence ?? null),
      headcountSource: parsed.headcountSource ?? null,
      manualHeadcount: parseInteger(parsed.manualHeadcount ?? null),
      minimumHeadcount: parseInteger(parsed.minimumHeadcount ?? null),
      fundSource: parsed.fundSource ?? null,
      fundLabel: (parsed.fundLabel?.trim() || null) ?? null,
    },
    include: { category: { select: { name: true } } },
  });
  await logAudit({
    userId: user.id,
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
      // v1.86.0: fund snapshot for audit.
      fundSource: created.fundSource,
      fundLabel: created.fundLabel,
    },
  });
  revalidatePath("/budget");
  // v2.4.0: return the id so the AI apply-bridge can link the row.
  return { id: created.id };
}

/** v2.8.0: extracted body of updateLine. Void-returning, matching the
 *  original action (the caller already knows the lineId). */
export async function updateLineCore(
  user: SessionUser,
  id: string,
  parsed: LineInput,
): Promise<void> {
  // Read before so the audit row can diff old vs new on the fields
  // the user actually changed.
  const before = await db.budgetLine.findUnique({
    where: { id },
    include: { category: { select: { name: true } } },
  });
  const next = {
    categoryId: parsed.categoryId,
    description: parsed.description,
    estimated: parseAmountOrNull(parsed.estimated ?? null),
    actual: parseAmountOrNull(parsed.actual ?? null),
    paid: parseAmountOrNull(parsed.paid ?? null),
    supplierId: parsed.supplierId || null,
    notes: parsed.notes ?? null,
    perHeadPence: parsePence(parsed.perHeadPence ?? null),
    headcountSource: parsed.headcountSource ?? null,
    manualHeadcount: parseInteger(parsed.manualHeadcount ?? null),
    minimumHeadcount: parseInteger(parsed.minimumHeadcount ?? null),
    fundSource: parsed.fundSource ?? null,
    fundLabel: (parsed.fundLabel?.trim() || null) ?? null,
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
    if (before.fundSource !== next.fundSource) changedFields.push("fundSource");
    if (before.fundLabel !== next.fundLabel) changedFields.push("fundLabel");
  }
  await logAudit({
    userId: user.id,
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

// ─── Payment cores ──────────────────────────────────────────────────

/** v2.8.0: extracted body of createPayment. Returns the new id so the
 *  inline grid (and the AI apply-bridge) can chain receipt uploads. */
export async function createPaymentCore(
  user: SessionUser,
  parsed: PaymentInput,
): Promise<{ id: string }> {
  // v1.80.0: when a component is targeted, the line FK is implied
  // (the component's parent). Resolve it once so the row carries
  // both — payments rendered on /budget can show under the line even
  // if the user only picked the component.
  let resolvedLineId = parsed.budgetLineId || null;
  if (parsed.budgetLineComponentId && !resolvedLineId) {
    const comp = await db.budgetLineComponent.findUnique({
      where: { id: parsed.budgetLineComponentId },
      select: { lineId: true },
    });
    if (comp) resolvedLineId = comp.lineId;
  }
  const created = await db.payment.create({
    data: {
      description: parsed.description,
      amount: parsePaymentAmount(parsed.amount),
      status: parsed.status,
      dueDate: parseDate(parsed.dueDate),
      paidDate: parseDate(parsed.paidDate),
      method: parsed.method ?? null,
      supplierId: parsed.supplierId || null,
      notes: parsed.notes ?? null,
      fileIds: parsed.fileIds,
      bookBuildMaterialId: parsed.bookBuildMaterialId || null,
      bookOutfitId: parsed.bookOutfitId || null,
      budgetLineId: resolvedLineId,
      budgetLineComponentId: parsed.budgetLineComponentId || null,
      fundSource: parsed.fundSource ?? null,
      fundLabel: (parsed.fundLabel?.trim() || null) ?? null,
    },
    include: { supplier: { select: { name: true } } },
  });
  await maybeMarkMaterialOrdered(
    user,
    parsed.bookBuildMaterialId || null,
    created.id,
  );
  await logAudit({
    userId: user.id,
    action: "create",
    entity: "Payment",
    entityId: created.id,
    metadata: {
      description: created.description,
      amount: Number(created.amount.toString()),
      status: created.status,
      dueDate: created.dueDate,
      supplierId: created.supplierId,
      supplierName: created.supplier?.name ?? null,
      // v1.75.0
      receiptCount: parsed.fileIds.length,
      bookBuildMaterialId: parsed.bookBuildMaterialId || null,
      bookOutfitId: parsed.bookOutfitId || null,
      // v1.79.0
      budgetLineId: resolvedLineId,
      // v1.80.0
      budgetLineComponentId: parsed.budgetLineComponentId || null,
      // v1.86.0
      fundSource: created.fundSource,
      fundLabel: created.fundLabel,
    },
  });
  revalidatePath("/payments");
  // v1.75.0: BUILD material `ordered` flag changed → revalidate the
  // book section the material lives under.
  if (parsed.bookBuildMaterialId) revalidatePath("/book", "layout");
  // v1.79.0: payment linked to a budget line → /budget actuals
  // auto-recompute (B2 contract). v1.80.0: component link → same.
  if (resolvedLineId || parsed.budgetLineComponentId) revalidatePath("/budget");
  return { id: created.id };
}

/** v2.8.0: extracted body of updatePayment. Void-returning, matching
 *  the original action (the caller already knows the paymentId). */
export async function updatePaymentCore(
  user: SessionUser,
  id: string,
  parsed: PaymentInput,
): Promise<void> {
  const before = await db.payment.findUnique({
    where: { id },
    include: { supplier: { select: { name: true } } },
  });
  // v1.80.0: resolve component → parent line so the rollup stays
  // consistent regardless of which FK the UI picked.
  let resolvedLineId = parsed.budgetLineId || null;
  if (parsed.budgetLineComponentId && !resolvedLineId) {
    const comp = await db.budgetLineComponent.findUnique({
      where: { id: parsed.budgetLineComponentId },
      select: { lineId: true },
    });
    if (comp) resolvedLineId = comp.lineId;
  }
  const next = {
    description: parsed.description,
    amount: parsePaymentAmount(parsed.amount),
    status: parsed.status,
    dueDate: parseDate(parsed.dueDate),
    paidDate: parseDate(parsed.paidDate),
    method: parsed.method ?? null,
    supplierId: parsed.supplierId || null,
    notes: parsed.notes ?? null,
    fileIds: parsed.fileIds,
    bookBuildMaterialId: parsed.bookBuildMaterialId || null,
    bookOutfitId: parsed.bookOutfitId || null,
    budgetLineId: resolvedLineId,
    budgetLineComponentId: parsed.budgetLineComponentId || null,
    // v1.86.0
    fundSource: parsed.fundSource ?? null,
    fundLabel: (parsed.fundLabel?.trim() || null) ?? null,
  };
  await db.payment.update({ where: { id }, data: next });
  // Side effect: if the link target changed and the new target is a
  // BUILD material that's not yet ordered, mark it. We don't unmark
  // the previous target on detach — the user may have actually
  // ordered it; clearing the flag silently would lose information.
  if (
    parsed.bookBuildMaterialId &&
    parsed.bookBuildMaterialId !== before?.bookBuildMaterialId
  ) {
    await maybeMarkMaterialOrdered(user, parsed.bookBuildMaterialId, id);
  }
  const changedFields: string[] = [];
  if (before) {
    if (before.description !== next.description) changedFields.push("description");
    if (Number(before.amount.toString()) !== next.amount) changedFields.push("amount");
    if (before.status !== next.status) changedFields.push("status");
    if ((before.dueDate?.getTime() ?? null) !== (next.dueDate?.getTime() ?? null))
      changedFields.push("dueDate");
    if ((before.paidDate?.getTime() ?? null) !== (next.paidDate?.getTime() ?? null))
      changedFields.push("paidDate");
    if (before.method !== next.method) changedFields.push("method");
    if (before.supplierId !== next.supplierId) changedFields.push("supplierId");
    if (before.notes !== next.notes) changedFields.push("notes");
    // v1.75.0
    if (
      before.fileIds.length !== next.fileIds.length ||
      before.fileIds.some((fid, i) => next.fileIds[i] !== fid)
    )
      changedFields.push("fileIds");
    if (before.bookBuildMaterialId !== next.bookBuildMaterialId)
      changedFields.push("bookBuildMaterialId");
    if (before.bookOutfitId !== next.bookOutfitId)
      changedFields.push("bookOutfitId");
    if (before.budgetLineId !== next.budgetLineId)
      changedFields.push("budgetLineId");
    if (before.budgetLineComponentId !== next.budgetLineComponentId)
      changedFields.push("budgetLineComponentId");
    // v1.86.0
    if (before.fundSource !== next.fundSource) changedFields.push("fundSource");
    if (before.fundLabel !== next.fundLabel) changedFields.push("fundLabel");
  }
  await logAudit({
    userId: user.id,
    action: "update",
    entity: "Payment",
    entityId: id,
    metadata: {
      description: next.description,
      amount: next.amount,
      supplierName: before?.supplier?.name ?? null,
      changedFields,
    },
  });
  revalidatePath("/payments");
  if (changedFields.includes("bookBuildMaterialId")) revalidatePath("/book", "layout");
  if (
    changedFields.includes("budgetLineId") ||
    changedFields.includes("budgetLineComponentId") ||
    changedFields.includes("amount") ||
    changedFields.includes("status") ||
    // v1.86.0: a fund change moves money between buckets on /budget
    changedFields.includes("fundSource") ||
    changedFields.includes("fundLabel")
  )
    revalidatePath("/budget");
}

/** v2.8.0: extracted body of setPaymentStatus. Void-returning. Stamps
 *  today's paidDate on PAID; clears it when moving off PAID. */
export async function setPaymentStatusCore(
  user: SessionUser,
  id: string,
  status: PaymentStatus,
): Promise<void> {
  const before = await db.payment.findUnique({
    where: { id },
    include: { supplier: { select: { name: true } } },
  });
  await db.payment.update({
    where: { id },
    data: {
      status,
      paidDate: status === PaymentStatus.PAID ? new Date() : null,
    },
  });
  await logAudit({
    userId: user.id,
    action: "status",
    entity: "Payment",
    entityId: id,
    metadata: {
      status,
      previousStatus: before?.status ?? null,
      description: before?.description ?? null,
      amount: before?.amount == null ? null : Number(before.amount.toString()),
      supplierName: before?.supplier?.name ?? null,
    },
  });
  revalidatePath("/payments");
  revalidatePath("/");
}
