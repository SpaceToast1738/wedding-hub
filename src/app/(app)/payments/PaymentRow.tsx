"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { PaymentForm } from "./PaymentForm";
import { deletePayment, setPaymentStatus, updatePayment } from "./actions";
import { formatDate, formatMoneyDecimal, isoForInput } from "@/lib/format";
import type { PaymentStatus } from "@prisma/client";

type Payment = {
  id: string;
  description: string;
  amount: { toString: () => string };
  status: PaymentStatus;
  dueDate: Date | null;
  paidDate: Date | null;
  method: string | null;
  supplierId: string | null;
  notes: string | null;
};

type Supplier = { id: string; name: string };

const STATUS_PILL: Record<string, "PAID" | "SCHEDULED" | "OVERDUE" | "PENDING" | "DECLINED"> = {
  PAID: "PAID",
  SCHEDULED: "SCHEDULED",
  OVERDUE: "OVERDUE",
  DUE: "PENDING",
  CANCELLED: "DECLINED",
};

export function PaymentRow({ payment, suppliers, canEdit }: { payment: Payment; suppliers: Supplier[]; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const supplierName = payment.supplierId ? suppliers.find((s) => s.id === payment.supplierId)?.name : null;

  function markPaid() {
    startTransition(async () => { await setPaymentStatus(payment.id, "PAID"); });
  }
  function unmarkPaid() {
    startTransition(async () => { await setPaymentStatus(payment.id, "DUE"); });
  }
  function onDelete() {
    if (!confirm(`Delete "${payment.description}"?`)) return;
    startTransition(async () => { await deletePayment(payment.id); });
  }

  if (editing) {
    return (
      <tr><td colSpan={7} className="p-3 bg-moss-50/30">
        <PaymentForm
          submitLabel="Save"
          suppliers={suppliers}
          initial={{
            description: payment.description,
            amount: payment.amount.toString(),
            status: payment.status,
            dueDate: isoForInput(payment.dueDate),
            paidDate: isoForInput(payment.paidDate),
            method: payment.method ?? "",
            supplierId: payment.supplierId,
            notes: payment.notes ?? "",
          }}
          onSubmit={async (fd) => { await updatePayment(payment.id, fd); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </td></tr>
    );
  }

  const isPaid = payment.status === "PAID";
  return (
    <tr className="border-b border-border-soft last:border-b-0 hover:bg-muted/30">
      <td className="px-4 py-2.5">
        <div className="text-sm text-ink-primary">{payment.description}</div>
        {payment.notes && <div className="text-xs text-ink-tertiary line-clamp-1">{payment.notes}</div>}
      </td>
      <td className="px-4 py-2.5 text-xs text-ink-tertiary truncate">{supplierName ?? "—"}</td>
      <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-ink-primary">{formatMoneyDecimal(payment.amount)}</td>
      <td className="px-4 py-2.5 text-xs text-ink-secondary">{formatDate(payment.dueDate)}</td>
      <td className="px-4 py-2.5"><StatusPill status={STATUS_PILL[payment.status] ?? "PENDING"} label={payment.status.toLowerCase()} /></td>
      <td className="px-4 py-2.5 text-xs text-ink-tertiary">{payment.method ?? "—"}</td>
      {canEdit && (
        <td className="px-4 py-2.5">
          <div className="flex gap-1 justify-end">
            {isPaid ? (
              <Button variant="ghost" size="sm" onClick={unmarkPaid} disabled={pending}>Unmark paid</Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={markPaid} disabled={pending}>Mark paid</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>×</Button>
          </div>
        </td>
      )}
    </tr>
  );
}
