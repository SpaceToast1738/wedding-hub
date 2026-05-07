"use server";

import { revalidatePath } from "next/cache";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { FileVisibility, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
import {
  UPLOADS_DIR,
  ensureUploadsDir,
  generateStoredName,
  validateUpload,
} from "@/lib/uploads";

// v1.75.0: payments gain `fileIds` (receipts) + optional links to a
// BookBuildMaterial (e.g. Hobbycraft → centerpiece foam) or BookOutfit
// item (e.g. Converse → Jamie's shoes). Linking a BUILD material
// auto-marks it as ordered. Schema in
// `prisma/migrations/20260512000000_payment_receipts_and_book_links/`.

const paymentSchema = z.object({
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
});

function parseAmount(s: string): number {
  const n = Number(String(s).replace(/[£,\s]/g, ""));
  if (isNaN(n)) throw new Error("Amount must be a number");
  return n;
}
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// v1.75.0: read repeated `fileIds` entries out of FormData. The
// inline grid + edit row both submit the receipt list as multiple
// `fileIds` entries with the same key.
function readFileIds(formData: FormData): string[] {
  return formData
    .getAll("fileIds")
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

// v1.75.0: side effect — when a payment is linked to a BUILD material
// that's currently `ordered: false`, flip it to true. Captures an
// audit trail so the BUILD card history shows where the order flag
// came from. Skipped (and silently no-op) if the material is already
// ordered or the link target doesn't exist.
type AuditableUser = Parameters<typeof audit>[0];

async function maybeMarkMaterialOrdered(
  user: AuditableUser,
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
  await audit(user, {
    action: "build-material-ordered-by-payment",
    entity: "BookBuildMaterial",
    entityId: materialId,
    metadata: { paymentId, materialName: material.name },
  });
}

export async function createPayment(formData: FormData) {
  const user = await requireEdit("payments");
  const parsed = paymentSchema.parse({
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
  });
  const created = await db.payment.create({
    data: {
      description: parsed.description,
      amount: parseAmount(parsed.amount),
      status: parsed.status,
      dueDate: parseDate(parsed.dueDate),
      paidDate: parseDate(parsed.paidDate),
      method: parsed.method ?? null,
      supplierId: parsed.supplierId || null,
      notes: parsed.notes ?? null,
      fileIds: parsed.fileIds,
      bookBuildMaterialId: parsed.bookBuildMaterialId || null,
      bookOutfitId: parsed.bookOutfitId || null,
    },
    include: { supplier: { select: { name: true } } },
  });
  await maybeMarkMaterialOrdered(
    user,
    parsed.bookBuildMaterialId || null,
    created.id,
  );
  await audit(user, {
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
    },
  });
  revalidatePath("/payments");
  // v1.75.0: BUILD material `ordered` flag changed → revalidate the
  // book section the material lives under.
  if (parsed.bookBuildMaterialId) revalidatePath("/book", "layout");
}

export async function updatePayment(id: string, formData: FormData) {
  const user = await requireEdit("payments");
  const parsed = paymentSchema.parse({
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
  });
  const before = await db.payment.findUnique({
    where: { id },
    include: { supplier: { select: { name: true } } },
  });
  const next = {
    description: parsed.description,
    amount: parseAmount(parsed.amount),
    status: parsed.status,
    dueDate: parseDate(parsed.dueDate),
    paidDate: parseDate(parsed.paidDate),
    method: parsed.method ?? null,
    supplierId: parsed.supplierId || null,
    notes: parsed.notes ?? null,
    fileIds: parsed.fileIds,
    bookBuildMaterialId: parsed.bookBuildMaterialId || null,
    bookOutfitId: parsed.bookOutfitId || null,
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
      before.fileIds.some((id, i) => next.fileIds[i] !== id)
    )
      changedFields.push("fileIds");
    if (before.bookBuildMaterialId !== next.bookBuildMaterialId)
      changedFields.push("bookBuildMaterialId");
    if (before.bookOutfitId !== next.bookOutfitId)
      changedFields.push("bookOutfitId");
  }
  await audit(user, {
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
}

export async function setPaymentStatus(id: string, status: PaymentStatus) {
  const user = await requireEdit("payments");
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
  await audit(user, {
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
