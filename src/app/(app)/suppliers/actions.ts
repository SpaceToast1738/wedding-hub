"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SupplierStatus, Priority, TaskStatus, TaskType } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireEdit } from "@/lib/actions";
import { decideFollowUpTask } from "@/lib/supplier-follow-up";

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

// ── Supplier sub-resources ────────────────────────────────────────────────

const contactSchema = z.object({
  supplierId: z.string().min(1),
  name: z.string().min(1).max(200),
  role: z.string().max(100).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  primary: z.boolean().optional(),
});

export async function createSupplierContact(formData: FormData) {
  const user = await requireEdit("suppliers");
  const parsed = contactSchema.parse({
    supplierId: formData.get("supplierId"),
    name: formData.get("name"),
    role: formData.get("role") || null,
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    primary: formData.get("primary") === "on",
  });

  // If marking primary, unmark any other contact on this supplier first.
  await db.$transaction([
    ...(parsed.primary
      ? [db.supplierContact.updateMany({
          where: { supplierId: parsed.supplierId, primary: true },
          data: { primary: false },
        })]
      : []),
    db.supplierContact.create({
      data: {
        supplierId: parsed.supplierId,
        name: parsed.name,
        role: parsed.role ?? null,
        email: parsed.email ?? null,
        phone: parsed.phone ?? null,
        primary: !!parsed.primary,
      },
    }),
  ]);
  await audit(user, { action: "create", entity: "SupplierContact", metadata: { supplierId: parsed.supplierId } });
  revalidatePath(`/suppliers/${parsed.supplierId}`);
  revalidatePath("/today/day-of");
}

export async function deleteSupplierContact(id: string, supplierId: string) {
  const user = await requireEdit("suppliers");
  await db.supplierContact.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "SupplierContact", entityId: id });
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/today/day-of");
}

const communicationSchema = z.object({
  supplierId: z.string().min(1),
  channel: z.enum(["email", "call", "meeting", "message"]),
  summary: z.string().min(1).max(5000),
  followUpAt: z.string().optional().nullable(),
});

export async function createSupplierCommunication(formData: FormData) {
  const user = await requireEdit("suppliers");
  const parsed = communicationSchema.parse({
    supplierId: formData.get("supplierId"),
    channel: formData.get("channel"),
    summary: formData.get("summary"),
    followUpAt: formData.get("followUpAt") || null,
  });
  const followUpAt = parsed.followUpAt ? new Date(parsed.followUpAt) : null;

  // Need the supplier name for the auto-task title. One round-trip
  // before the transaction; cheap and avoids Prisma's interactive-tx
  // cost when there's no follow-up.
  const supplier = await db.supplier.findUnique({
    where: { id: parsed.supplierId },
    select: { name: true },
  });
  if (!supplier) throw new Error("Supplier not found");

  // B3 (v1.11.0): if a follow-up date is set, the comm + auto-task
  // must land atomically. If task creation fails for any reason, the
  // comm rolls back too — better than a silent ghost-task in /tasks.
  const result = await db.$transaction(async (tx) => {
    const comm = await tx.supplierCommunication.create({
      data: {
        supplierId: parsed.supplierId,
        channel: parsed.channel,
        summary: parsed.summary,
        followUpAt,
        createdById: user.id,
      },
    });
    const taskData = decideFollowUpTask({
      supplierId: parsed.supplierId,
      supplierName: supplier.name,
      commId: comm.id,
      followUpAt,
      createdById: user.id,
    });
    let taskId: string | null = null;
    if (taskData) {
      const task = await tx.task.create({
        data: {
          title: taskData.title,
          type: TaskType[taskData.type],
          status: TaskStatus[taskData.status],
          priority: Priority[taskData.priority],
          dueDate: taskData.dueDate,
          assigneeId: taskData.assigneeId,
          tags: taskData.tags,
        },
      });
      taskId = task.id;
    }
    return { comm, taskId };
  });

  await audit(user, {
    action: "create",
    entity: "SupplierCommunication",
    entityId: result.comm.id,
    metadata: {
      supplierId: parsed.supplierId,
      channel: parsed.channel,
      autoTaskId: result.taskId,
    },
  });
  if (result.taskId) {
    await audit(user, {
      action: "create",
      entity: "Task",
      entityId: result.taskId,
      metadata: {
        autoFromCommId: result.comm.id,
        supplierId: parsed.supplierId,
      },
    });
  }
  revalidatePath(`/suppliers/${parsed.supplierId}`);
  if (result.taskId) revalidatePath("/tasks");
}

export async function deleteSupplierCommunication(id: string, supplierId: string) {
  const user = await requireEdit("suppliers");
  await db.supplierCommunication.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "SupplierCommunication", entityId: id });
  revalidatePath(`/suppliers/${supplierId}`);
}

const contractSchema = z.object({
  supplierId: z.string().min(1),
  signed: z.boolean().optional(),
  signedAt: z.string().optional().nullable(),
  amount: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function createSupplierContract(formData: FormData) {
  const user = await requireEdit("suppliers");
  const parsed = contractSchema.parse({
    supplierId: formData.get("supplierId"),
    signed: formData.get("signed") === "on",
    signedAt: formData.get("signedAt") || null,
    amount: formData.get("amount") || null,
    notes: formData.get("notes") || null,
  });
  const signedAt = parsed.signedAt ? new Date(parsed.signedAt) : parsed.signed ? new Date() : null;
  const amount = parsed.amount ? parseAmount(parsed.amount) : null;
  const created = await db.supplierContract.create({
    data: {
      supplierId: parsed.supplierId,
      signed: !!parsed.signed,
      signedAt,
      amount,
      notes: parsed.notes ?? null,
    },
  });
  await audit(user, {
    action: "create",
    entity: "SupplierContract",
    entityId: created.id,
    metadata: { supplierId: parsed.supplierId },
  });
  revalidatePath(`/suppliers/${parsed.supplierId}`);
}

export async function deleteSupplierContract(id: string, supplierId: string) {
  const user = await requireEdit("suppliers");
  await db.supplierContract.delete({ where: { id } });
  await audit(user, { action: "delete", entity: "SupplierContract", entityId: id });
  revalidatePath(`/suppliers/${supplierId}`);
}
