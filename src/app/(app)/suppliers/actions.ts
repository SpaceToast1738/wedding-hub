"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SupplierStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";

const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  status: z.nativeEnum(SupplierStatus).default(SupplierStatus.SHORTLIST),
  website: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  amountAgreed: z.string().optional().nullable(),
});

function parseAmount(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[£,\s]/g, ""));
  return isNaN(n) ? null : n;
}

export async function createSupplier(formData: FormData) {
  const user = await requireEdit("suppliers");
  const parsed = supplierSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    status: formData.get("status") || SupplierStatus.SHORTLIST,
    website: formData.get("website") || null,
    notes: formData.get("notes") || null,
    amountAgreed: formData.get("amountAgreed") || null,
  });
  const created = await db.supplier.create({
    data: {
      name: parsed.name,
      category: parsed.category,
      status: parsed.status,
      website: parsed.website ?? null,
      notes: parsed.notes ?? null,
      amountAgreed: parseAmount(parsed.amountAgreed ?? null),
    },
  });
  await audit(user, { action: "create", entity: "Supplier", entityId: created.id });
  revalidatePath("/suppliers");
}

export async function updateSupplier(id: string, formData: FormData) {
  const user = await requireEdit("suppliers");
  const parsed = supplierSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    status: formData.get("status") || SupplierStatus.SHORTLIST,
    website: formData.get("website") || null,
    notes: formData.get("notes") || null,
    amountAgreed: formData.get("amountAgreed") || null,
  });
  await db.supplier.update({
    where: { id },
    data: {
      name: parsed.name,
      category: parsed.category,
      status: parsed.status,
      website: parsed.website ?? null,
      notes: parsed.notes ?? null,
      amountAgreed: parseAmount(parsed.amountAgreed ?? null),
    },
  });
  await audit(user, { action: "update", entity: "Supplier", entityId: id });
  revalidatePath("/suppliers");
}

export async function setSupplierStatus(id: string, status: SupplierStatus) {
  const user = await requireEdit("suppliers");
  await db.supplier.update({ where: { id }, data: { status } });
  await audit(user, { action: "status", entity: "Supplier", entityId: id, metadata: { status } });
  revalidatePath("/suppliers");
}

export async function deleteSupplier(id: string) {
  const user = await requireEdit("suppliers");
  await db.supplier.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "Supplier", entityId: id });
  revalidatePath("/suppliers");
}
