// v2.4.0: apply bridges for budget + payment proposals — the ONLY
// path through which AI proposals can touch money. Couple-only in
// practice: the underlying actions gate requireEdit("budget") /
// requireEdit("payments") on the session user.
//
// Unit discipline: payloads carry INTEGER PENCE; the budget/payment
// actions parse POUND-STRINGS (parseAmount keeps pounds; parsePence
// multiplies by 100). Every payload amount is formatted here as
// (pence / 100).toFixed(2) so the silent NaN→null parser path and the
// 100x-unit mistake are both unreachable. Values carried from the
// live row are re-posted in the same format today's forms produce:
// Decimal pound columns via .toString(), pence-int columns via the
// same toFixed(2) division.
//
// updateLine and updatePayment are full-record actions (omission
// wipes) — their bridges post every field the parser reads,
// patch-else-current. Fields the AI can never set (a line's actual +
// paid, a payment's paidDate / fileIds / book links) always carry the
// current values byte-identical.

import { PaymentStatus } from "@prisma/client";
import { createCategory, createLine, updateLine } from "@/app/(app)/budget/actions";
import {
  createPayment,
  setPaymentStatus,
  updatePayment,
} from "@/app/(app)/payments/actions";
import { db } from "@/lib/db";
import {
  budgetCategoryCreateSchema,
  budgetLineCreateSchema,
  budgetLineUpdateSchema,
  paymentCreateSchema,
  paymentSetStatusSchema,
  paymentUpdateSchema,
} from "@/lib/ai/proposals/schemas";
import { patchOrCurrent } from "@/lib/ai/apply/common";

/** Integer pence → the pound-string the actions' £ inputs post. */
function penceToPounds(pence: number): string {
  return (pence / 100).toFixed(2);
}

async function applyBudgetCategoryCreate(payload: unknown): Promise<{ id: string }> {
  const parsed = budgetCategoryCreateSchema.parse(payload);
  const fd = new FormData();
  fd.append("name", parsed.name);
  const result = await createCategory(fd);
  if (!result?.id) throw new Error("createCategory did not return an id.");
  return { id: result.id };
}

async function applyBudgetLineCreate(payload: unknown): Promise<{ id: string }> {
  const parsed = budgetLineCreateSchema.parse(payload);
  const fd = new FormData();
  fd.append("categoryId", parsed.categoryId);
  fd.append("description", parsed.description);
  // estimated goes through parseAmount (pounds); perHeadPence through
  // parsePence (pounds → ×100) — both want pound-strings.
  if (parsed.estimatedPence != null) {
    fd.append("estimated", penceToPounds(parsed.estimatedPence));
  }
  if (parsed.supplierId) fd.append("supplierId", parsed.supplierId);
  if (parsed.notes) fd.append("notes", parsed.notes);
  if (parsed.perHeadPence != null) {
    fd.append("perHeadPence", penceToPounds(parsed.perHeadPence));
  }
  if (parsed.headcountSource) fd.append("headcountSource", parsed.headcountSource);
  if (parsed.manualHeadcount != null) {
    fd.append("manualHeadcount", String(parsed.manualHeadcount));
  }
  if (parsed.minimumHeadcount != null) {
    fd.append("minimumHeadcount", String(parsed.minimumHeadcount));
  }
  if (parsed.fundSource) fd.append("fundSource", parsed.fundSource);
  if (parsed.fundLabel) fd.append("fundLabel", parsed.fundLabel);
  // actual + paid deliberately never posted on create — a brand-new
  // line has no spend recorded.
  const result = await createLine(fd);
  if (!result?.id) throw new Error("createLine did not return an id.");
  return { id: result.id };
}

async function applyBudgetLineUpdate(payload: unknown): Promise<{ id: string }> {
  const parsed = budgetLineUpdateSchema.parse(payload);

  const current = await db.budgetLine.findUnique({ where: { id: parsed.lineId } });
  if (!current) {
    throw new Error(
      "Budget line not found — it may have been deleted since the proposal was made.",
    );
  }

  const fd = new FormData();
  // categoryId is ALWAYS the current one — the payload has no such
  // field because a wrong category silently relocates the line.
  fd.append("categoryId", current.categoryId);
  fd.append(
    "description",
    parsed.description !== undefined ? parsed.description : current.description,
  );

  const estimated =
    parsed.estimatedPence !== undefined
      ? parsed.estimatedPence === null
        ? null
        : penceToPounds(parsed.estimatedPence)
      : current.estimated?.toString() ?? null;
  if (estimated) fd.append("estimated", estimated);

  // actual + paid are NEVER AI-writable: always the current Decimal
  // values as pound-strings, so a proposal can't pin or unpin the
  // actual-override or fake recorded spend.
  if (current.actual != null) fd.append("actual", current.actual.toString());
  if (current.paid != null) fd.append("paid", current.paid.toString());

  const supplierId = patchOrCurrent(parsed.supplierId, current.supplierId);
  if (supplierId) fd.append("supplierId", supplierId);
  const notes = patchOrCurrent(parsed.notes, current.notes);
  if (notes) fd.append("notes", notes);

  const perHead =
    parsed.perHeadPence !== undefined ? parsed.perHeadPence : current.perHeadPence;
  if (perHead != null) fd.append("perHeadPence", penceToPounds(perHead));

  const headcountSource = patchOrCurrent(parsed.headcountSource, current.headcountSource);
  if (headcountSource) fd.append("headcountSource", headcountSource);
  const manualHeadcount = patchOrCurrent(parsed.manualHeadcount, current.manualHeadcount);
  if (manualHeadcount != null) fd.append("manualHeadcount", String(manualHeadcount));
  const minimumHeadcount = patchOrCurrent(parsed.minimumHeadcount, current.minimumHeadcount);
  if (minimumHeadcount != null) fd.append("minimumHeadcount", String(minimumHeadcount));

  const fundSource = patchOrCurrent(parsed.fundSource, current.fundSource);
  if (fundSource) fd.append("fundSource", fundSource);
  const fundLabel = patchOrCurrent(parsed.fundLabel, current.fundLabel);
  if (fundLabel) fd.append("fundLabel", fundLabel);

  await updateLine(parsed.lineId, fd);
  return { id: parsed.lineId };
}

async function applyPaymentCreate(payload: unknown): Promise<{ id: string }> {
  const parsed = paymentCreateSchema.parse(payload);
  const fd = new FormData();
  fd.append("description", parsed.description);
  fd.append("amount", penceToPounds(parsed.amountPence));
  fd.append("status", parsed.status);
  if (parsed.dueDate) fd.append("dueDate", parsed.dueDate);
  if (parsed.method) fd.append("method", parsed.method);
  if (parsed.supplierId) fd.append("supplierId", parsed.supplierId);
  if (parsed.budgetLineId) fd.append("budgetLineId", parsed.budgetLineId);
  if (parsed.budgetLineComponentId) {
    fd.append("budgetLineComponentId", parsed.budgetLineComponentId);
  }
  if (parsed.fundSource) fd.append("fundSource", parsed.fundSource);
  if (parsed.fundLabel) fd.append("fundLabel", parsed.fundLabel);
  if (parsed.notes) fd.append("notes", parsed.notes);
  // Never posted: paidDate (payment.set_status stamps it), fileIds,
  // bookBuildMaterialId, bookOutfitId (receipts + book links are
  // human-only).
  const result = await createPayment(fd);
  if (!result?.id) throw new Error("createPayment did not return an id.");
  return { id: result.id };
}

async function applyPaymentUpdate(payload: unknown): Promise<{ id: string }> {
  const parsed = paymentUpdateSchema.parse(payload);

  const current = await db.payment.findUnique({ where: { id: parsed.paymentId } });
  if (!current) {
    throw new Error(
      "Payment not found — it may have been deleted since the proposal was made.",
    );
  }

  const fd = new FormData();
  fd.append(
    "description",
    parsed.description !== undefined ? parsed.description : current.description,
  );
  // current.amount is a pound-Decimal — .toString() round-trips
  // byte-identical through parseAmount.
  fd.append(
    "amount",
    parsed.amountPence !== undefined
      ? penceToPounds(parsed.amountPence)
      : current.amount.toString(),
  );
  const nextStatus = parsed.status ?? current.status;
  fd.append("status", nextStatus);

  const dueDate =
    parsed.dueDate !== undefined
      ? parsed.dueDate
      : current.dueDate?.toISOString() ?? null;
  if (dueDate) fd.append("dueDate", dueDate);

  // paidDate is never in the payload but `formData.get("paidDate") ||
  // null` wipes it on omission. Mirror setPaymentStatus's semantics
  // when the STATUS is changing (PAID stamps today, off-PAID clears);
  // otherwise carry the current stamp verbatim — a status-neutral edit
  // must never touch the recorded paid date.
  if (nextStatus !== current.status) {
    if (nextStatus === "PAID") fd.append("paidDate", new Date().toISOString());
    // moving off PAID: omit → updatePayment nulls it, matching the
    // canonical status-flip path.
  } else if (current.paidDate) {
    fd.append("paidDate", current.paidDate.toISOString());
  }

  const method = patchOrCurrent(parsed.method, current.method);
  if (method) fd.append("method", method);
  const supplierId = patchOrCurrent(parsed.supplierId, current.supplierId);
  if (supplierId) fd.append("supplierId", supplierId);
  const notes = patchOrCurrent(parsed.notes, current.notes);
  if (notes) fd.append("notes", notes);

  // Receipts: readFileIds treats omission as [] and REPLACES the
  // array — re-append every current entry, byte-identical, in order.
  for (const fileId of current.fileIds) fd.append("fileIds", fileId);
  // Book links are human-only; omission would null them.
  if (current.bookBuildMaterialId) {
    fd.append("bookBuildMaterialId", current.bookBuildMaterialId);
  }
  if (current.bookOutfitId) fd.append("bookOutfitId", current.bookOutfitId);

  let budgetLineId = patchOrCurrent(parsed.budgetLineId, current.budgetLineId);
  let budgetLineComponentId = patchOrCurrent(
    parsed.budgetLineComponentId,
    current.budgetLineComponentId,
  );
  // Keep the pair CONSISTENT after the independent per-field merge —
  // updatePayment's parent-line resolver only fires when the posted
  // lineId is empty, so it would happily persist a component that
  // belongs to a different line than the posted one.
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
  if (budgetLineId) fd.append("budgetLineId", budgetLineId);
  if (budgetLineComponentId) {
    fd.append("budgetLineComponentId", budgetLineComponentId);
  }

  const fundSource = patchOrCurrent(parsed.fundSource, current.fundSource);
  if (fundSource) fd.append("fundSource", fundSource);
  const fundLabel = patchOrCurrent(parsed.fundLabel, current.fundLabel);
  if (fundLabel) fd.append("fundLabel", fundLabel);

  await updatePayment(parsed.paymentId, fd);
  return { id: parsed.paymentId };
}

async function applyPaymentSetStatus(payload: unknown): Promise<{ id: string }> {
  const parsed = paymentSetStatusSchema.parse(payload);
  // The action itself stamps paidDate = today on PAID and clears it
  // when moving off PAID — the review card says so.
  await setPaymentStatus(parsed.paymentId, parsed.status as PaymentStatus);
  return { id: parsed.paymentId };
}

export async function applyMoneyProposal(
  _user: { id: string; isCouple: boolean },
  kind: string,
  payload: unknown,
): Promise<{ id: string }> {
  switch (kind) {
    case "budget.category.create":
      return applyBudgetCategoryCreate(payload);
    case "budget.line.create":
      return applyBudgetLineCreate(payload);
    case "budget.line.update":
      return applyBudgetLineUpdate(payload);
    case "payment.create":
      return applyPaymentCreate(payload);
    case "payment.update":
      return applyPaymentUpdate(payload);
    case "payment.set_status":
      return applyPaymentSetStatus(payload);
    default:
      throw new Error(`Unknown money proposal kind: ${kind}`);
  }
}
