"use server";

import { revalidatePath } from "next/cache";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { FileVisibility, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
import {
  UPLOADS_DIR,
  ensureUploadsDir,
  generateStoredName,
  validateUpload,
} from "@/lib/uploads";
// v2.8.0: the payment Zod schema and the createPayment / updatePayment
// / setPaymentStatus BODIES (including the amount/date parsers and the
// maybeMarkMaterialOrdered side effect) moved to @/lib/core/money so
// the MCP self-apply path can run the identical write logic without a
// browser session. This file keeps the FormData plumbing plus the
// requireEdit auth gates — human behaviour is unchanged.
import {
  createPaymentCore,
  paymentInputSchema,
  setPaymentStatusCore,
  updatePaymentCore,
} from "@/lib/core/money";

// v1.75.0: payments gain `fileIds` (receipts) + optional links to a
// BookBuildMaterial (e.g. Hobbycraft → centerpiece foam) or BookOutfit
// item (e.g. Converse → Jamie's shoes). Linking a BUILD material
// auto-marks it as ordered. Schema in
// `prisma/migrations/20260512000000_payment_receipts_and_book_links/`.

// v1.75.0: read repeated `fileIds` entries out of FormData. The
// inline grid + edit row both submit the receipt list as multiple
// `fileIds` entries with the same key.
function readFileIds(formData: FormData): string[] {
  return formData
    .getAll("fileIds")
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

// AuditableUser: the user shape audit() accepts. Still needed by
// uploadFileForPayment below (a session-bound receipt action that
// stays in this file).
type AuditableUser = Parameters<typeof audit>[0];

// v1.89.0: return the new payment's id so callers (InlinePaymentGrid)
// can chain receipt uploads against it. Pre-v1.89 this returned void,
// which forced the inline grid to display a "couldn't auto-attach"
// warning when the user picked local files. Returning the id closes
// that gap. PaymentForm callers ignore the return value (they call it
// indirectly via `await onSubmit(formData)`) so the wider signature
// is backwards-compatible.
export async function createPayment(formData: FormData): Promise<{ id: string }> {
  const user = await requireEdit("payments");
  const parsed = paymentInputSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    status: formData.get("status") || PaymentStatus.DUE,
    dueDate: formData.get("dueDate") || null,
    paidDate: formData.get("paidDate") || null,
    method: formData.get("method") || null,
    supplierId: formData.get("supplierId") || null,
    notes: formData.get("notes") || null,
    fileIds: readFileIds(formData),
    bookBuildMaterialId: formData.get("bookBuildMaterialId") || null,
    bookOutfitId: formData.get("bookOutfitId") || null,
    budgetLineId: formData.get("budgetLineId") || null,
    budgetLineComponentId: formData.get("budgetLineComponentId") || null,
    // v1.86.0
    fundSource: (formData.get("fundSource") as string) || null,
    fundLabel: formData.get("fundLabel") || null,
  });
  // v2.8.0: body lives in createPaymentCore — component→line
  // resolution, the maybeMarkMaterialOrdered side effect, audit row and
  // every revalidatePath all happen there.
  return createPaymentCore(user, parsed);
}

export async function updatePayment(id: string, formData: FormData) {
  const user = await requireEdit("payments");
  const parsed = paymentInputSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    status: formData.get("status") || PaymentStatus.DUE,
    dueDate: formData.get("dueDate") || null,
    paidDate: formData.get("paidDate") || null,
    method: formData.get("method") || null,
    supplierId: formData.get("supplierId") || null,
    notes: formData.get("notes") || null,
    fileIds: readFileIds(formData),
    bookBuildMaterialId: formData.get("bookBuildMaterialId") || null,
    bookOutfitId: formData.get("bookOutfitId") || null,
    budgetLineId: formData.get("budgetLineId") || null,
    budgetLineComponentId: formData.get("budgetLineComponentId") || null,
    // v1.86.0
    fundSource: (formData.get("fundSource") as string) || null,
    fundLabel: formData.get("fundLabel") || null,
  });
  // v2.8.0: body lives in updatePaymentCore.
  await updatePaymentCore(user, id, parsed);
}

export async function setPaymentStatus(id: string, status: PaymentStatus) {
  const user = await requireEdit("payments");
  // v2.8.0: body lives in setPaymentStatusCore — stamps paidDate on
  // PAID, clears it off-PAID.
  // v2.8.1: pass null for the explicit paidDate override — the core's
  // `null ?? new Date()` yields today on PAID, byte-identical to the
  // status-button behaviour before the override existed.
  await setPaymentStatusCore(user, id, status, null);
}

export async function deletePayment(id: string) {
  const user = await requireEdit("payments");
  const before = await db.payment.findUnique({
    where: { id },
    include: { supplier: { select: { name: true } } },
  });
  await db.payment.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "Payment",
    entityId: id,
    metadata: {
      description: before?.description ?? null,
      amount: before?.amount == null ? null : Number(before.amount.toString()),
      status: before?.status ?? null,
      dueDate: before?.dueDate ?? null,
      supplierName: before?.supplier?.name ?? null,
    },
  });
  revalidatePath("/payments");
}

// v1.75.0: receipt attach/detach + upload-and-attach. Mirrors the
// BUILD card pattern in `book/actions.ts`. Stored as `Payment.fileIds`
// — same shape as `BookBuildCard.fileIds`.

export type PaymentReceiptResult =
  | { ok: true }
  | { ok: false; error: string };

async function uploadFileForPayment(
  user: AuditableUser,
  formFile: File,
): Promise<{ id: string; name: string; mimeType: string }> {
  const validation = validateUpload(formFile);
  if (!validation.ok) throw new Error(`${formFile.name}: ${validation.error}`);
  await ensureUploadsDir();
  const storedName = generateStoredName(validation.mime, formFile.name);
  const fullPath = path.join(UPLOADS_DIR, storedName);
  const bytes = Buffer.from(await formFile.arrayBuffer());
  await writeFile(fullPath, bytes, { mode: 0o640 });
  let created;
  try {
    created = await db.file.create({
      data: {
        name: formFile.name.slice(0, 200),
        storedPath: storedName,
        // Payment receipts default to COUPLE_ONLY since they're
        // money-sensitive — the planner / wedding party shouldn't
        // see receipts for the surprise gifts in the budget.
        folder: "Payment receipts",
        visibility: FileVisibility.COUPLE_ONLY,
        mimeType: validation.mime,
        sizeBytes: formFile.size,
        uploadedById: user.id,
      },
    });
  } catch (err) {
    await unlink(fullPath).catch(() => undefined);
    throw err;
  }
  return created;
}

export async function uploadAndAttachReceipt(
  paymentId: string,
  formData: FormData,
): Promise<PaymentReceiptResult> {
  const user = await requireEdit("payments");
  try {
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return { ok: false, error: "Payment not found" };
    const formFile = formData.get("file");
    if (!(formFile instanceof File) || formFile.size === 0) {
      return { ok: false, error: "No file received." };
    }
    const file = await uploadFileForPayment(user, formFile);
    const next = [...payment.fileIds, file.id];
    await db.payment.update({
      where: { id: paymentId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "payment-receipt-upload",
      entity: "Payment",
      entityId: paymentId,
      metadata: {
        description: payment.description,
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
      },
    });
    revalidatePath("/payments");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't upload" };
  }
}

export async function attachReceiptToPayment(
  paymentId: string,
  fileId: string,
): Promise<PaymentReceiptResult> {
  const user = await requireEdit("payments");
  try {
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return { ok: false, error: "Payment not found" };
    const file = await db.file.findUnique({ where: { id: fileId } });
    if (!file) return { ok: false, error: "File not found" };
    if (payment.fileIds.includes(fileId)) return { ok: true };
    const next = [...payment.fileIds, fileId];
    await db.payment.update({
      where: { id: paymentId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "payment-receipt-attach",
      entity: "Payment",
      entityId: paymentId,
      metadata: {
        description: payment.description,
        fileId,
        fileName: file.name,
      },
    });
    revalidatePath("/payments");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't attach" };
  }
}

export async function detachReceiptFromPayment(
  paymentId: string,
  fileId: string,
): Promise<PaymentReceiptResult> {
  const user = await requireEdit("payments");
  try {
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return { ok: false, error: "Payment not found" };
    if (!payment.fileIds.includes(fileId)) return { ok: true };
    const file = await db.file.findUnique({ where: { id: fileId } });
    const next = payment.fileIds.filter((id) => id !== fileId);
    await db.payment.update({
      where: { id: paymentId },
      data: { fileIds: next },
    });
    await audit(user, {
      action: "payment-receipt-detach",
      entity: "Payment",
      entityId: paymentId,
      metadata: {
        description: payment.description,
        fileId,
        fileName: file?.name ?? null,
      },
    });
    revalidatePath("/payments");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't detach" };
  }
}
