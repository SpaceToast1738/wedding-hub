"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SupplierStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
// v2.8.0: the create/update cores + shared pieces (schemas,
// parseAmount, the follow-up auto-task cascade) moved to
// src/lib/core/suppliers.ts so the MCP self-apply path can run them
// session-free with an explicit user. The wrappers below stay the
// ONLY exports here — "use server" exports are client-invokable, so
// the auth-free cores must never appear in this file's export list.
import {
  createSupplierCommunicationCore,
  createSupplierContactCore,
  createSupplierCore,
  parseAmount,
  supplierCommunicationInputSchema,
  supplierContactInputSchema,
  supplierInputSchema,
  updateSupplierCore,
} from "@/lib/core/suppliers";
// v2.8.0: setSupplierCustomField's body extracted to a session-free
// core so the MCP self-apply path runs identical write logic without a
// browser session. The wrapper keeps the requireEdit("suppliers") gate.
import { setSupplierCustomFieldCore } from "@/lib/core/misc";

// v2.8.0: parse + auth + delegate. Everything after the Zod parse
// (db write, audit, revalidate, return shape) lives in
// createSupplierCore so the AI apply path shares one implementation.
export async function createSupplier(formData: FormData): Promise<{ id: string }> {
  const user = await requireEdit("suppliers");
  const parsed = supplierInputSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    status: formData.get("status") || SupplierStatus.SHORTLIST,
    website: formData.get("website") || null,
    notes: formData.get("notes") || null,
    amountAgreed: formData.get("amountAgreed") || null,
  });
  return createSupplierCore(user, parsed);
}

// v1.74.0: minimal supplier create that returns the new id, used by
// the inline-add-payment flow on /payments. The standard
// `createPayment` form-action returns void; callers that need the id
// (so they can immediately link a freshly-created supplier to a
// freshly-created payment) use this instead. Same auth + audit + Zod
// validation as `createSupplier`.
export async function createSupplierQuick({
  name,
  category,
}: {
  name: string;
  category: string;
}): Promise<{ id: string; name: string }> {
  const user = await requireEdit("suppliers");
  const parsed = supplierInputSchema.parse({
    name,
    category,
    status: SupplierStatus.SHORTLIST,
    website: null,
    notes: null,
    amountAgreed: null,
  });
  const created = await db.supplier.create({
    data: {
      name: parsed.name,
      category: parsed.category,
      status: parsed.status,
      website: null,
      notes: null,
      amountAgreed: null,
    },
  });
  await audit(user, {
    action: "create",
    entity: "Supplier",
    entityId: created.id,
    metadata: {
      name: created.name,
      category: created.category,
      status: created.status,
      origin: "payments-inline-add",
    },
  });
  revalidatePath("/suppliers");
  revalidatePath("/payments");
  return { id: created.id, name: created.name };
}

// v2.8.0: parse + auth + delegate — the changedFields diff + write
// live in updateSupplierCore.
export async function updateSupplier(id: string, formData: FormData) {
  const user = await requireEdit("suppliers");
  const parsed = supplierInputSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    status: formData.get("status") || SupplierStatus.SHORTLIST,
    website: formData.get("website") || null,
    notes: formData.get("notes") || null,
    amountAgreed: formData.get("amountAgreed") || null,
  });
  await updateSupplierCore(user, id, parsed);
}

export async function setSupplierStatus(id: string, status: SupplierStatus) {
  const user = await requireEdit("suppliers");
  const before = await db.supplier.findUnique({
    where: { id },
    select: { name: true, status: true },
  });
  await db.supplier.update({ where: { id }, data: { status } });
  await audit(user, {
    action: "status",
    entity: "Supplier",
    entityId: id,
    metadata: {
      name: before?.name ?? null,
      previousStatus: before?.status ?? null,
      status,
    },
  });
  revalidatePath("/suppliers");
}

// v1.53.0 (C1): result-shape return so the caller can render a real
// error toast instead of relying on the action throwing into Next's
// production redactor (which surfaces a generic overlay). Failures
// here are usually FK-blocked deletes (e.g. a payment row references
// the supplier) — the user wants to see "Can't delete: 3 payments
// still linked", not silent.
export type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteSupplier(id: string): Promise<DeleteResult> {
  const user = await requireEdit("suppliers");
  try {
    // Snapshot before delete.
    const before = await db.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            contacts: true,
            contracts: true,
            communications: true,
            payments: true,
            tasks: true,
          },
        },
      },
    });
    await db.supplier.delete({ where: { id } });
    await audit(user, {
      action: "delete",
      entity: "Supplier",
      entityId: id,
      metadata: {
        name: before?.name ?? null,
        category: before?.category ?? null,
        status: before?.status ?? null,
        contactCount: before?._count.contacts ?? 0,
        contractCount: before?._count.contracts ?? 0,
        paymentCount: before?._count.payments ?? 0,
      },
    });
    revalidatePath("/suppliers");
    return { ok: true };
  } catch (err) {
    console.error("deleteSupplier failed", err);
    const msg = err instanceof Error ? err.message : "Couldn't delete supplier";
    return { ok: false, error: msg };
  }
}

// ── Supplier sub-resources ────────────────────────────────────────────────

// v2.8.0: parse + auth + delegate — the primary-swap transaction +
// audit live in createSupplierContactCore.
export async function createSupplierContact(formData: FormData) {
  const user = await requireEdit("suppliers");
  const parsed = supplierContactInputSchema.parse({
    supplierId: formData.get("supplierId"),
    name: formData.get("name"),
    role: formData.get("role") || null,
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    primary: formData.get("primary") === "on",
  });
  await createSupplierContactCore(user, parsed);
}

export async function deleteSupplierContact(id: string, supplierId: string) {
  const user = await requireEdit("suppliers");
  // Snapshot the contact before delete so the audit reads usefully.
  const before = await db.supplierContact.findUnique({
    where: { id },
    include: { supplier: { select: { name: true } } },
  });
  await db.supplierContact.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "SupplierContact",
    entityId: id,
    metadata: {
      supplierId,
      supplierName: before?.supplier.name ?? null,
      contactName: before?.name ?? null,
      role: before?.role ?? null,
    },
  });
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/today/day-of");
}

// v2.8.0: parse + auth + delegate — the comm + auto-task transaction
// (decideFollowUpTask cascade) lives in createSupplierCommunicationCore.
export async function createSupplierCommunication(formData: FormData) {
  const user = await requireEdit("suppliers");
  const parsed = supplierCommunicationInputSchema.parse({
    supplierId: formData.get("supplierId"),
    channel: formData.get("channel"),
    summary: formData.get("summary"),
    followUpAt: formData.get("followUpAt") || null,
    occurredAt: formData.get("occurredAt") || null,
  });
  await createSupplierCommunicationCore(user, parsed);
}

export async function deleteSupplierCommunication(id: string, supplierId: string) {
  const user = await requireEdit("suppliers");
  // Snapshot the comm before delete so the audit row reads usefully.
  const before = await db.supplierCommunication.findUnique({
    where: { id },
    include: { supplier: { select: { name: true } } },
  });
  await db.supplierCommunication.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "SupplierCommunication",
    entityId: id,
    metadata: {
      supplierId,
      supplierName: before?.supplier.name ?? null,
      channel: before?.channel ?? null,
      summaryLength: before?.summary?.length ?? 0,
    },
  });
  revalidatePath(`/suppliers/${supplierId}`);
}

const contractSchema = z.object({
  supplierId: z.string().min(1),
  signed: z.boolean().optional(),
  signedAt: z.string().optional().nullable(),
  amount: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  // v2.4.3: optional link to an uploaded File (the signed contract PDF
  // etc). The column existed since the model was added but nothing
  // could ever set it.
  fileId: z.string().optional().nullable(),
});

export async function createSupplierContract(formData: FormData) {
  const user = await requireEdit("suppliers");
  const parsed = contractSchema.parse({
    supplierId: formData.get("supplierId"),
    signed: formData.get("signed") === "on",
    signedAt: formData.get("signedAt") || null,
    amount: formData.get("amount") || null,
    notes: formData.get("notes") || null,
    fileId: formData.get("fileId") || null,
  });
  const signedAt = parsed.signedAt ? new Date(parsed.signedAt) : parsed.signed ? new Date() : null;
  const amount = parsed.amount ? parseAmount(parsed.amount) : null;
  // A hallucinated/stale file id must not FK-fail the whole create —
  // verify and drop silently (the attach action below covers fix-up).
  const fileId =
    parsed.fileId &&
    (await db.file.findUnique({ where: { id: parsed.fileId }, select: { id: true } }))
      ? parsed.fileId
      : null;
  const created = await db.supplierContract.create({
    data: {
      supplierId: parsed.supplierId,
      signed: !!parsed.signed,
      signedAt,
      amount,
      notes: parsed.notes ?? null,
      fileId,
    },
  });
  // Lookup supplier name for the audit row.
  const supplier = await db.supplier.findUnique({
    where: { id: parsed.supplierId },
    select: { name: true },
  });
  await audit(user, {
    action: "create",
    entity: "SupplierContract",
    entityId: created.id,
    metadata: {
      supplierId: parsed.supplierId,
      supplierName: supplier?.name ?? null,
      signed: created.signed,
      signedAt: created.signedAt,
      amount: created.amount == null ? null : Number(created.amount.toString()),
    },
  });
  revalidatePath(`/suppliers/${parsed.supplierId}`);
}

/** v2.4.3: attach (or detach with null) an uploaded File to an
 *  existing contract row. Result-shaped so the client can toast the
 *  error instead of relying on prod redaction. */
export async function setSupplierContractFile(
  id: string,
  fileId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireEdit("suppliers");
  try {
    const contract = await db.supplierContract.findUnique({
      where: { id },
      select: { supplierId: true, supplier: { select: { name: true } } },
    });
    if (!contract) return { ok: false, error: "Contract not found" };
    let fileName: string | null = null;
    if (fileId) {
      const file = await db.file.findUnique({
        where: { id: fileId },
        select: { id: true, name: true },
      });
      if (!file) return { ok: false, error: "File not found — upload it on /files first" };
      fileName = file.name;
    }
    await db.supplierContract.update({ where: { id }, data: { fileId } });
    await audit(user, {
      action: "update",
      entity: "SupplierContract",
      entityId: id,
      metadata: {
        supplierId: contract.supplierId,
        supplierName: contract.supplier.name,
        changedFields: ["fileId"],
        fileName,
      },
    });
    revalidatePath(`/suppliers/${contract.supplierId}`);
    return { ok: true };
  } catch (err) {
    console.error("setSupplierContractFile failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't attach the file",
    };
  }
}

export async function deleteSupplierContract(id: string, supplierId: string) {
  const user = await requireEdit("suppliers");
  // Snapshot before delete.
  const before = await db.supplierContract.findUnique({
    where: { id },
    include: { supplier: { select: { name: true } } },
  });
  await db.supplierContract.delete({ where: { id } });
  await audit(user, {
    action: "delete",
    entity: "SupplierContract",
    entityId: id,
    metadata: {
      supplierId,
      supplierName: before?.supplier.name ?? null,
      signed: before?.signed ?? null,
      amount: before?.amount == null ? null : Number(before.amount.toString()),
    },
  });
  revalidatePath(`/suppliers/${supplierId}`);
}

// ── v1.22.0: per-supplier custom field value writes ─────────────────────
// Mirrors v1.15.0's `setGuestCustomField`. Validation in
// parseCustomFieldValue. Permission gate: requireEdit("suppliers").
// Rejects mismatched field.entity so a Guest field can't accidentally
// land on a Supplier row.

export async function setSupplierCustomField(
  supplierId: string,
  fieldId: string,
  rawValue: string | null,
) {
  const user = await requireEdit("suppliers");
  // v2.8.0: body lives in setSupplierCustomFieldCore — def validation,
  // typed merge, audit row and revalidation all happen there so the AI
  // apply path shares one implementation.
  await setSupplierCustomFieldCore(user, supplierId, fieldId, rawValue);
}
