// v2.4.0: apply bridges for budget + payment proposals — the ONLY
// path through which AI proposals can touch money. Couple-only: the
// budget/payments sections are COUPLE_ONLY_SECTIONS, so the canEdit
// gate below hard-denies every non-couple user — exactly what the
// underlying actions' requireEdit("budget"/"payments") did.
//
// Unit discipline: payloads carry INTEGER PENCE; the money cores parse
// POUND-STRINGS (parseAmount keeps pounds; parsePence multiplies by
// 100). Every payload amount is formatted here as (pence / 100).toFixed(2)
// so the silent NaN→null parser path and the 100x-unit mistake are both
// unreachable. Values carried from the live row are re-formatted in the
// same shape today's forms produce: Decimal pound columns via
// .toString(), pence-int columns via the same toFixed(2) division.
//
// updateLine and updatePayment are full-record cores (omission wipes) —
// their bridges assemble every field the core writes, patch-else-current.
// Fields the AI can never set (a line's actual + paid, a payment's
// paidDate / fileIds / book links) always carry the current values
// byte-identical.
//
// v2.8.0: was a FormData round-trip through the human server actions;
// now assembles the core-input shape (the same Zod parse output those
// actions produced from FormData) and calls the session-free cores in
// @/lib/core/money directly, dropping the browser session the MCP
// self-apply path doesn't have. The requireEdit gate each action ran is
// re-asserted here via requireSectionEdit (canEdit + the same error
// string). Throws on any failure so applyLoadedProposal's claim-rollback
// fires.

import { PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { canEdit, type Section } from "@/lib/permissions";
// Type-only import — erased at compile time, so this module never pulls
// the @/auth graph into the MCP route bundle (same convention as
// src/lib/core/*).
import type { SessionUser } from "@/lib/actions";
import {
  budgetCategoryCreateSchema,
  budgetComponentCreateSchema,
  budgetComponentUpdateSchema,
  budgetLineCreateSchema,
  budgetLineUpdateSchema,
  paymentCreateSchema,
  paymentSetStatusSchema,
  paymentUpdateSchema,
} from "@/lib/ai/proposals/schemas";
import { patchOrCurrent } from "@/lib/ai/apply/common";
import {
  categoryInputSchema,
  componentInputSchema,
  componentUpdateInputSchema,
  createCategoryCore,
  createComponentCore,
  createLineCore,
  createPaymentCore,
  lineInputSchema,
  paymentInputSchema,
  setPaymentStatusCore,
  updateComponentCore,
  updateLineCore,
  updatePaymentCore,
} from "@/lib/core/money";

/** Session-free twin of requireEdit(section) — same error text, but
 *  the user comes from the caller instead of the session (same helper
 *  convention as src/lib/ai/apply/deletes.ts). budget/payments are
 *  COUPLE_ONLY_SECTIONS, so canEdit denies every non-couple caller. */
async function requireSectionEdit(user: SessionUser, section: Section): Promise<void> {
  if (!(await canEdit(user, section))) {
    throw new Error(`Forbidden: no edit access to ${section}`);
  }
}

/** Integer pence → the pound-string the cores' £ parsers expect. */
function penceToPounds(pence: number): string {
  return (pence / 100).toFixed(2);
}

/** v2.8.1: payload paid-date ("YYYY-MM-DD" | null | undefined) → the
 *  Date | null setPaymentStatusCore's optional param expects. A string
 *  parses to a Date; null/undefined both become null (the core's
 *  `null ?? new Date()` then stamps today on PAID). */
function parsePayloadDate(s: string | null | undefined): Date | null {
  return s ? new Date(s) : null;
}

async function applyBudgetCategoryCreate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = budgetCategoryCreateSchema.parse(payload);
  await requireSectionEdit(user, "budget");
  const result = await createCategoryCore(
    user,
    categoryInputSchema.parse({ name: parsed.name }),
  );
  if (!result?.id) throw new Error("createCategory did not return an id.");
  return { id: result.id };
}

async function applyBudgetLineCreate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = budgetLineCreateSchema.parse(payload);
  await requireSectionEdit(user, "budget");
  // Assemble the same string shape lineSchema produced from FormData
  // (`formData.get(x) || null`). estimated/perHeadPence go through
  // parseAmount/parsePence in the core (pounds); manual/minimum
  // headcount through parseInteger. actual + paid deliberately absent —
  // a brand-new line has no spend recorded.
  const result = await createLineCore(
    user,
    lineInputSchema.parse({
      categoryId: parsed.categoryId,
      description: parsed.description,
      estimated: parsed.estimatedPence != null ? penceToPounds(parsed.estimatedPence) : null,
      actual: null,
      paid: null,
      supplierId: parsed.supplierId || null,
      notes: parsed.notes || null,
      perHeadPence: parsed.perHeadPence != null ? penceToPounds(parsed.perHeadPence) : null,
      headcountSource: parsed.headcountSource || null,
      manualHeadcount: parsed.manualHeadcount != null ? String(parsed.manualHeadcount) : null,
      minimumHeadcount: parsed.minimumHeadcount != null ? String(parsed.minimumHeadcount) : null,
      fundSource: parsed.fundSource || null,
      fundLabel: parsed.fundLabel || null,
    }),
  );
  if (!result?.id) throw new Error("createLine did not return an id.");
  return { id: result.id };
}

async function applyBudgetLineUpdate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = budgetLineUpdateSchema.parse(payload);

  const current = await db.budgetLine.findUnique({ where: { id: parsed.lineId } });
  if (!current) {
    throw new Error(
      "Budget line not found — it may have been deleted since the proposal was made.",
    );
  }

  // categoryId is ALWAYS the current one — the payload has no such
  // field because a wrong category silently relocates the line.
  const estimated =
    parsed.estimatedPence !== undefined
      ? parsed.estimatedPence === null
        ? null
        : penceToPounds(parsed.estimatedPence)
      : current.estimated?.toString() ?? null;
  const supplierId = patchOrCurrent(parsed.supplierId, current.supplierId);
  const notes = patchOrCurrent(parsed.notes, current.notes);
  const perHead =
    parsed.perHeadPence !== undefined ? parsed.perHeadPence : current.perHeadPence;
  const headcountSource = patchOrCurrent(parsed.headcountSource, current.headcountSource);
  const manualHeadcount = patchOrCurrent(parsed.manualHeadcount, current.manualHeadcount);
  const minimumHeadcount = patchOrCurrent(parsed.minimumHeadcount, current.minimumHeadcount);
  const fundSource = patchOrCurrent(parsed.fundSource, current.fundSource);
  const fundLabel = patchOrCurrent(parsed.fundLabel, current.fundLabel);

  // Merge before the gate — same evaluation order as the old FormData
  // bridge (which built the request before updateLine's requireEdit).
  await requireSectionEdit(user, "budget");
  await updateLineCore(
    user,
    parsed.lineId,
    lineInputSchema.parse({
      categoryId: current.categoryId,
      description: parsed.description !== undefined ? parsed.description : current.description,
      estimated: estimated || null,
      // actual + paid are NEVER AI-writable: always the current Decimal
      // values as pound-strings, so a proposal can't pin or unpin the
      // actual-override or fake recorded spend.
      actual: current.actual != null ? current.actual.toString() : null,
      paid: current.paid != null ? current.paid.toString() : null,
      supplierId: supplierId || null,
      notes: notes || null,
      perHeadPence: perHead != null ? penceToPounds(perHead) : null,
      headcountSource: headcountSource || null,
      manualHeadcount: manualHeadcount != null ? String(manualHeadcount) : null,
      minimumHeadcount: minimumHeadcount != null ? String(minimumHeadcount) : null,
      fundSource: fundSource || null,
      fundLabel: fundLabel || null,
    }),
  );
  return { id: parsed.lineId };
}

/** v2.8.1: create a sub-cost component on a budget line. Pence values
 *  are written directly (no £-string round-trip) — the payload already
 *  carries integer pence and componentInputSchema takes number pence. */
async function applyBudgetComponentCreate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = budgetComponentCreateSchema.parse(payload);
  await requireSectionEdit(user, "budget");
  const result = await createComponentCore(
    user,
    componentInputSchema.parse({
      lineId: parsed.lineId,
      label: parsed.label,
      flatPence: parsed.flatPence ?? null,
      perHeadPence: parsed.perHeadPence ?? null,
      headcountSource: parsed.headcountSource ?? null,
      manualHeadcount: parsed.manualHeadcount ?? null,
      minimumHeadcount: parsed.minimumHeadcount ?? null,
      notes: parsed.notes ?? null,
      fundSource: parsed.fundSource ?? null,
      fundLabel: parsed.fundLabel ?? null,
    }),
  );
  if (!result?.id) throw new Error("createComponent did not return an id.");
  return { id: result.id };
}

/** v2.8.1: full-record update of a component. No lineId in the payload
 *  (a wrong line would silently relocate the component), so the bridge
 *  loads the current row and carries every field the payload omits —
 *  same patch-else-current shape as applyBudgetLineUpdate. */
async function applyBudgetComponentUpdate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = budgetComponentUpdateSchema.parse(payload);

  const current = await db.budgetLineComponent.findUnique({
    where: { id: parsed.componentId },
  });
  if (!current) {
    throw new Error(
      "Budget component not found — it may have been deleted since the proposal was made.",
    );
  }

  // label is non-nullable; the rest are patch-else-current. Pence stay
  // integers throughout. The parse coerces the AI's string enums to the
  // Prisma enum types the core writes.
  const merged = componentUpdateInputSchema.parse({
    label: parsed.label !== undefined ? parsed.label : current.label,
    flatPence: parsed.flatPence !== undefined ? parsed.flatPence : current.flatPence,
    perHeadPence: parsed.perHeadPence !== undefined ? parsed.perHeadPence : current.perHeadPence,
    headcountSource: patchOrCurrent(parsed.headcountSource, current.headcountSource),
    manualHeadcount: patchOrCurrent(parsed.manualHeadcount, current.manualHeadcount),
    minimumHeadcount: patchOrCurrent(parsed.minimumHeadcount, current.minimumHeadcount),
    notes: patchOrCurrent(parsed.notes, current.notes),
    fundSource: patchOrCurrent(parsed.fundSource, current.fundSource),
    fundLabel: patchOrCurrent(parsed.fundLabel, current.fundLabel),
  });

  // Merge before the gate — same evaluation order as the other bridges.
  await requireSectionEdit(user, "budget");
  await updateComponentCore(user, parsed.componentId, merged);
  return { id: parsed.componentId };
}

async function applyPaymentCreate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = paymentCreateSchema.parse(payload);
  await requireSectionEdit(user, "payments");
  // Never set: paidDate (payment.set_status stamps it), fileIds,
  // bookBuildMaterialId, bookOutfitId (receipts + book links are
  // human-only).
  const result = await createPaymentCore(
    user,
    paymentInputSchema.parse({
      description: parsed.description,
      amount: penceToPounds(parsed.amountPence),
      status: parsed.status,
      dueDate: parsed.dueDate || null,
      paidDate: null,
      method: parsed.method || null,
      supplierId: parsed.supplierId || null,
      notes: parsed.notes || null,
      fileIds: [],
      bookBuildMaterialId: null,
      bookOutfitId: null,
      budgetLineId: parsed.budgetLineId || null,
      budgetLineComponentId: parsed.budgetLineComponentId || null,
      fundSource: parsed.fundSource || null,
      fundLabel: parsed.fundLabel || null,
    }),
  );
  if (!result?.id) throw new Error("createPayment did not return an id.");
  return { id: result.id };
}

async function applyPaymentUpdate(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = paymentUpdateSchema.parse(payload);

  const current = await db.payment.findUnique({ where: { id: parsed.paymentId } });
  if (!current) {
    throw new Error(
      "Payment not found — it may have been deleted since the proposal was made.",
    );
  }

  const nextStatus = parsed.status ?? current.status;

  const dueDate =
    parsed.dueDate !== undefined
      ? parsed.dueDate
      : current.dueDate?.toISOString() ?? null;

  // v2.8.1: an explicit payload paidDate wins over the status default —
  // a "YYYY-MM-DD" string sets it, null clears it. When paidDate is
  // OMITTED (undefined) we keep the pre-v2.8.1 behaviour: mirror
  // setPaymentStatus's semantics on a status change (PAID stamps today,
  // off-PAID clears), otherwise carry the current stamp verbatim so a
  // status-neutral edit never touches the recorded paid date.
  let paidDate: string | null;
  if (parsed.paidDate !== undefined) {
    paidDate = parsed.paidDate === null ? null : new Date(parsed.paidDate).toISOString();
  } else if (nextStatus !== current.status) {
    paidDate = nextStatus === "PAID" ? new Date().toISOString() : null;
  } else {
    paidDate = current.paidDate ? current.paidDate.toISOString() : null;
  }

  const method = patchOrCurrent(parsed.method, current.method);
  const supplierId = patchOrCurrent(parsed.supplierId, current.supplierId);
  const notes = patchOrCurrent(parsed.notes, current.notes);

  let budgetLineId = patchOrCurrent(parsed.budgetLineId, current.budgetLineId);
  let budgetLineComponentId = patchOrCurrent(
    parsed.budgetLineComponentId,
    current.budgetLineComponentId,
  );
  // Keep the pair CONSISTENT after the independent per-field merge —
  // the core's parent-line resolver only fires when the posted lineId
  // is empty, so it would happily persist a component that belongs to a
  // different line than the posted one.
  if (parsed.budgetLineId === null && parsed.budgetLineComponentId === undefined) {
    // "null detaches from the budget" — dropping only the line while a
    // component link survives would make the resolver silently re-fill
    // the line from the component's parent. Detach both.
    budgetLineComponentId = null;
  }
  if (budgetLineComponentId) {
    const component = await db.budgetLineComponent.findUnique({
      where: { id: budgetLineComponentId },
      select: { lineId: true },
    });
    if (!component) {
      throw new Error("The linked budget component no longer exists — re-propose.");
    }
    if (budgetLineId && budgetLineId !== component.lineId) {
      throw new Error(
        "That budget line doesn't match the payment's component link — detach or re-link the component too.",
      );
    }
    budgetLineId = component.lineId;
  }

  const fundSource = patchOrCurrent(parsed.fundSource, current.fundSource);
  const fundLabel = patchOrCurrent(parsed.fundLabel, current.fundLabel);

  // Merge before the gate — same evaluation order as the old FormData
  // bridge (which built the request before updatePayment's requireEdit).
  await requireSectionEdit(user, "payments");
  await updatePaymentCore(
    user,
    parsed.paymentId,
    paymentInputSchema.parse({
      description: parsed.description !== undefined ? parsed.description : current.description,
      // current.amount is a pound-Decimal — .toString() round-trips
      // byte-identical through parseAmount.
      amount:
        parsed.amountPence !== undefined
          ? penceToPounds(parsed.amountPence)
          : current.amount.toString(),
      status: nextStatus,
      dueDate: dueDate || null,
      paidDate,
      method: method || null,
      supplierId: supplierId || null,
      notes: notes || null,
      // Receipts: the core treats the array as a full replace — re-post
      // every current entry, byte-identical, in order.
      fileIds: current.fileIds,
      // Book links are human-only; omission would null them.
      bookBuildMaterialId: current.bookBuildMaterialId || null,
      bookOutfitId: current.bookOutfitId || null,
      budgetLineId: budgetLineId || null,
      budgetLineComponentId: budgetLineComponentId || null,
      fundSource: fundSource || null,
      fundLabel: fundLabel || null,
    }),
  );
  return { id: parsed.paymentId };
}

async function applyPaymentSetStatus(
  user: SessionUser,
  payload: unknown,
): Promise<{ id: string }> {
  const parsed = paymentSetStatusSchema.parse(payload);
  await requireSectionEdit(user, "payments");
  // The core stamps paidDate on PAID and clears it when moving off PAID —
  // the review card says so. v2.8.1: an explicit payload paidDate is
  // stamped instead of today; omitted/null defers to today (the core's
  // `parsePayloadDate(...) ?? new Date()`).
  await setPaymentStatusCore(
    user,
    parsed.paymentId,
    parsed.status as PaymentStatus,
    parsePayloadDate(parsed.paidDate),
  );
  return { id: parsed.paymentId };
}

export async function applyMoneyProposal(
  user: SessionUser,
  kind: string,
  payload: unknown,
): Promise<{ id: string }> {
  switch (kind) {
    case "budget.category.create":
      return applyBudgetCategoryCreate(user, payload);
    case "budget.line.create":
      return applyBudgetLineCreate(user, payload);
    case "budget.line.update":
      return applyBudgetLineUpdate(user, payload);
    // v2.8.1: budget-line components. execute.ts routes every budget.*
    // kind to applyMoneyProposal by prefix, so these two cases fully wire
    // the apply path — no execute.ts dispatch edit is needed.
    case "budget.component_create":
      return applyBudgetComponentCreate(user, payload);
    case "budget.component_update":
      return applyBudgetComponentUpdate(user, payload);
    case "payment.create":
      return applyPaymentCreate(user, payload);
    case "payment.update":
      return applyPaymentUpdate(user, payload);
    case "payment.set_status":
      return applyPaymentSetStatus(user, payload);
    default:
      throw new Error(`Unknown money proposal kind: ${kind}`);
  }
}
