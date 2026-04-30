"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

const paymentSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.string().min(1),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.DUE),
  dueDate: z.string().optional().nullable(),
  paidDate: z.string().optional().nullable(),
  method: z.string().max(100).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
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
    },
    include: { supplier: { select: { name: true } } },
  });
  // v1.39.0: enrich with description + amount + supplier so the audit
  // log reads as "Created payment 'Venue balance' £5,000 (Alveston Manor)".
  // Money-sensitive surface — explicit snapshot helps reconcile any
  // disputed entries against payment receipts.
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
    },
  });
  revalidatePath("/payments");
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
  });
  // Read before for the changedFields diff. Capture the supplier name
  // for the audit even when nothing changed (provides context).
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
  };
  await db.payment.update({ where: { id }, data: next });
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
}

export async function setPaymentStatus(id: string, status: PaymentStatus) {
  const user = await requireEdit("payments");
  // Snapshot for the audit — needed for the human-readable summary.
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
  // Snapshot before delete — money-sensitive, log richly.
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
