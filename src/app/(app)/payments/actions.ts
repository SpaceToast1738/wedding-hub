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
  });
  await audit(user, { action: "create", entity: "Payment", entityId: created.id });
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
  await db.payment.update({
    where: { id },
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
  });
  await audit(user, { action: "update", entity: "Payment", entityId: id });
  revalidatePath("/payments");
}

export async function setPaymentStatus(id: string, status: PaymentStatus) {
  const user = await requireEdit("payments");
  await db.payment.update({
    where: { id },
    data: {
      status,
      paidDate: status === PaymentStatus.PAID ? new Date() : null,
    },
  });
  await audit(user, { action: "status", entity: "Payment", entityId: id, metadata: { status } });
  revalidatePath("/payments");
  revalidatePath("/");
}

export async function deletePayment(id: string) {
  const user = await requireEdit("payments");
  await db.payment.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "Payment", entityId: id });
  revalidatePath("/payments");
}
