// v2.8.0: session-free cores for the supplier write surface (T1
// self-apply).
//
// The MCP agent applies supplier.* proposals over token auth — no
// Auth.js session exists on that path, so the entity-writing halves of
// createSupplier / updateSupplier / createSupplierCommunication /
// createSupplierContact can't live behind `requireEdit()` in the
// "use server" file. They live here instead, taking an explicit
// `user: SessionUser`.
//
// Contract (same as src/lib/core/guests.ts):
// - No auth here. Server-action wrappers in
//   src/app/(app)/suppliers/actions.ts run requireEdit("suppliers")
//   before delegating; the AI apply dispatch passes its
//   already-verified user. NEVER export these from a "use server"
//   file — that would mint unauthenticated client-invokable actions.
// - Cores keep everything after the parse: db writes, the follow-up
//   auto-task cascade, audit rows, revalidatePath calls, and return
//   values — human flows through the wrappers stay byte-identical.
// - Cores take the action-schema parse OUTPUT; the schemas are
//   exported so the AI apply path validates against the same shape
//   the wrappers do.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SupplierStatus, Priority, TaskStatus, TaskType } from "@prisma/client";
import { db } from "@/lib/db";
// Type-only import from actions: a VALUE import would drag the
// @/auth (next-auth) module graph into every registry consumer.
import type { SessionUser } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { decideFollowUpTask } from "@/lib/supplier-follow-up";

// v2.8.0: moved verbatim from src/app/(app)/suppliers/actions.ts
// (where they were module-private). Named *InputSchema to stay
// visually distinct from the AI payload schemas in
// src/lib/ai/proposals/schemas.ts (supplierCreateSchema etc.).
export const supplierInputSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  status: z.nativeEnum(SupplierStatus).default(SupplierStatus.SHORTLIST),
  website: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  amountAgreed: z.string().optional().nullable(),
});
export type SupplierInput = z.infer<typeof supplierInputSchema>;

export function parseAmount(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[£,\s]/g, ""));
  return isNaN(n) ? null : n;
}

export async function createSupplierCore(
  user: SessionUser,
  parsed: SupplierInput,
): Promise<{ id: string }> {
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
  await logAudit({
    userId: user.id,
    action: "create",
    entity: "Supplier",
    entityId: created.id,
    metadata: {
      name: created.name,
      category: created.category,
      status: created.status,
    },
  });
  revalidatePath("/suppliers");
  // v2.3.0: return the id so the AI proposal apply-bridge can link the
  // AiProposal to the row it just produced. Only call site
  // (AddSupplierToggle.tsx) discards the return value today — same
  // non-breaking precedent as createTask / createHousehold / createGuest.
  return { id: created.id };
}

export async function updateSupplierCore(
  user: SessionUser,
  id: string,
  parsed: SupplierInput,
): Promise<void> {
  // Read before for changedFields diff.
  const before = await db.supplier.findUnique({ where: { id } });
  const next = {
    name: parsed.name,
    category: parsed.category,
    status: parsed.status,
    website: parsed.website ?? null,
    notes: parsed.notes ?? null,
    amountAgreed: parseAmount(parsed.amountAgreed ?? null),
  };
  await db.supplier.update({ where: { id }, data: next });
  const changedFields: string[] = [];
  if (before) {
    if (before.name !== next.name) changedFields.push("name");
    if (before.category !== next.category) changedFields.push("category");
    if (before.status !== next.status) changedFields.push("status");
    if (before.website !== next.website) changedFields.push("website");
    if (before.notes !== next.notes) changedFields.push("notes");
    const beforeAmount = before.amountAgreed == null ? null : Number(before.amountAgreed.toString());
    if (beforeAmount !== next.amountAgreed) changedFields.push("amountAgreed");
  }
  await logAudit({
    userId: user.id,
    action: "update",
    entity: "Supplier",
    entityId: id,
    metadata: {
      name: next.name,
      changedFields,
    },
  });
  revalidatePath("/suppliers");
}

// ── Supplier sub-resources ────────────────────────────────────────────────

export const supplierContactInputSchema = z.object({
  supplierId: z.string().min(1),
  name: z.string().min(1).max(200),
  role: z.string().max(100).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  primary: z.boolean().optional(),
});
export type SupplierContactInput = z.infer<typeof supplierContactInputSchema>;

export async function createSupplierContactCore(
  user: SessionUser,
  parsed: SupplierContactInput,
): Promise<void> {
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
  // Lookup supplier name for the audit row. Cheap — single field.
  const supplier = await db.supplier.findUnique({
    where: { id: parsed.supplierId },
    select: { name: true },
  });
  await logAudit({
    userId: user.id,
    action: "create",
    entity: "SupplierContact",
    metadata: {
      supplierId: parsed.supplierId,
      supplierName: supplier?.name ?? null,
      contactName: parsed.name,
      role: parsed.role ?? null,
      primary: !!parsed.primary,
    },
  });
  revalidatePath(`/suppliers/${parsed.supplierId}`);
  revalidatePath("/today/day-of");
}

export const supplierCommunicationInputSchema = z.object({
  supplierId: z.string().min(1),
  channel: z.enum(["email", "call", "meeting", "message"]),
  summary: z.string().min(1).max(5000),
  followUpAt: z.string().optional().nullable(),
  // v2.6.3: when the contact actually happened, for backfilling a call
  // logged after the fact. Optional — blank leaves createdAt on its
  // column default (now()) same as before.
  occurredAt: z.string().optional().nullable(),
});
export type SupplierCommunicationInput = z.infer<typeof supplierCommunicationInputSchema>;

export async function createSupplierCommunicationCore(
  user: SessionUser,
  parsed: SupplierCommunicationInput,
): Promise<void> {
  const followUpAt = parsed.followUpAt ? new Date(parsed.followUpAt) : null;
  const occurredAt = parsed.occurredAt ? new Date(parsed.occurredAt) : null;

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
        // v2.6.3: backfilled entries override the createdAt default —
        // omitting the key entirely (rather than passing undefined)
        // keeps the column's @default(now()) in effect when blank.
        ...(occurredAt ? { createdAt: occurredAt } : {}),
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
          // v1.96.0: assignees m2m. Supplier follow-up tasks
          // historically had a single owner; preserve that intent
          // by connecting one user when the caller supplies one.
          assignees: taskData.assigneeId
            ? { connect: [{ id: taskData.assigneeId }] }
            : undefined,
          tags: taskData.tags,
        },
      });
      taskId = task.id;
    }
    return { comm, taskId };
  });

  await logAudit({
    userId: user.id,
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
    await logAudit({
    userId: user.id,
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
