"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { PaymentForm } from "./PaymentForm";
import {
  deletePayment,
  setPaymentStatus,
  updatePayment,
  attachReceiptToPayment,
  detachReceiptFromPayment,
} from "./actions";
import { formatDate, formatMoneyDecimal, isoForInput } from "@/lib/format";
import type { PaymentStatus } from "@prisma/client";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import { notify } from "@/lib/notify";
import { effectiveFundForPayment, formatFundChip, resolveFundLabels, type FundLabels } from "@/lib/funds";
import type { FundSource } from "@prisma/client";

// v1.75.0: PaymentRow extended with link chip (BUILD material / outfit)
// + receipt count chip in read mode, plus minimal edit-mode receipt
// management (attach existing / detach). Editing the link target from
// PaymentRow is preserved as a hidden FormData passthrough — to *change*
// the link, delete and re-add via the inline grid for now.

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
  // v1.75.0
  fileIds: string[];
  bookBuildMaterialId: string | null;
  bookOutfitId: string | null;
  bookBuildMaterial: {
    id: string;
    name: string;
    card: { subsection: { title: string; slug: string } };
  } | null;
  bookOutfitItem: {
    id: string;
    itemLabel: string | null;
    card: {
      personName: string | null;
      subsection: { title: string; slug: string };
    };
  } | null;
  // v1.79.0
  budgetLineId: string | null;
  budgetLine: {
    id: string;
    description: string;
    fundSource: string | null;
    fundLabel: string | null;
    category: { id: string; name: string };
  } | null;
  // v1.80.0
  budgetLineComponentId: string | null;
  budgetLineComponent: {
    id: string;
    label: string;
    fundSource: string | null;
    fundLabel: string | null;
    line: {
      id: string;
      description: string;
      fundSource: string | null;
      fundLabel: string | null;
      category: { id: string; name: string };
    };
  } | null;
  // v1.86.0: own fund. Resolution chain via effectiveFundForPayment:
  // payment > component > line. We display the resolved chip on the
  // row (with "(inherited)" italic when the chip came from a parent).
  fundSource: string | null;
  fundLabel: string | null;
};

type Supplier = { id: string; name: string };
type FileSummary = { id: string; name: string; mimeType: string };
type BudgetCategoryWithLines = {
  id: string;
  name: string;
  lines: {
    id: string;
    description: string;
    components: { id: string; label: string }[];
  }[];
};
const STATUS_PILL: Record<string, "PAID" | "SCHEDULED" | "OVERDUE" | "PENDING" | "DECLINED"> = {
  PAID: "PAID",
  SCHEDULED: "SCHEDULED",
  OVERDUE: "OVERDUE",
  DUE: "PENDING",
  CANCELLED: "DECLINED",
};

export function PaymentRow({
  payment,
  suppliers,
  files,
  budgetCategories,
  canEdit,
  fundLabelSource,
}: {
  payment: Payment;
  suppliers: Supplier[];
  files: FileSummary[];
  budgetCategories: BudgetCategoryWithLines[];
  canEdit: boolean;
  // v1.86.0: couple's first names so the fund chip can render
  // "Bryony" / "Jamie" instead of "Bride" / "Groom" fallbacks.
  fundLabelSource: { brideFirst: string; groomFirst: string };
}) {
  const fundLabels = resolveFundLabels(fundLabelSource);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const supplierName = payment.supplierId ? suppliers.find((s) => s.id === payment.supplierId)?.name : null;
  const confirm = useConfirm();

  function markPaid() {
    startTransition(async () => { await setPaymentStatus(payment.id, "PAID"); });
  }
  function unmarkPaid() {
    startTransition(async () => { await setPaymentStatus(payment.id, "DUE"); });
  }
  async function onDelete() {
    if (!(await confirm({ title: `Delete "${payment.description}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => { await deletePayment(payment.id); });
  }

  // v1.75.0: receipt attach / detach in edit mode.
  function attachExisting(fileId: string) {
    startTransition(async () => {
      const r = await attachReceiptToPayment(payment.id, fileId);
      if (r.ok) notify("success", "Receipt attached");
      else notify("error", r.error);
    });
  }
  async function detach(fileId: string, fileName: string | null) {
    if (!(await confirm({ title: `Detach receipt${fileName ? ` "${fileName}"` : ""}?`, confirmLabel: "Detach", tone: "danger" }))) return;
    startTransition(async () => {
      const r = await detachReceiptFromPayment(payment.id, fileId);
      if (r.ok) notify("success", "Receipt detached");
      else notify("error", r.error);
    });
  }

  if (editing) {
    return (
      <tr><td colSpan={8} className="p-3 bg-moss-50/30">
        <PaymentForm
          submitLabel="Save"
          suppliers={suppliers}
          budgetCategories={budgetCategories}
          initial={{
            description: payment.description,
            amount: payment.amount.toString(),
            status: payment.status,
            dueDate: isoForInput(payment.dueDate),
            paidDate: isoForInput(payment.paidDate),
            method: payment.method ?? "",
            supplierId: payment.supplierId,
            notes: payment.notes ?? "",
            budgetLineId: payment.budgetLineId,
            budgetLineComponentId: payment.budgetLineComponentId,
            // v1.86.0
            fundSource: payment.fundSource,
            fundLabel: payment.fundLabel,
          }}
          // v1.75.0: preserve the existing link + receipt list across
          // saves — PaymentForm appends these as hidden inputs.
          hiddenFields={{
            bookBuildMaterialId: payment.bookBuildMaterialId,
            bookOutfitId: payment.bookOutfitId,
            fileIds: payment.fileIds,
          }}
          onSubmit={async (fd) => { await updatePayment(payment.id, fd); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
        {/* Receipts panel — independent of the form, uses
            attach/detach actions directly so the user can manage
            receipts without re-saving the form. */}
        <div className="mt-3 p-2.5 border border-border-soft bg-canvas/40 rounded-sm">
          <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1.5">
            Receipts ({payment.fileIds.length})
          </div>
          {payment.fileIds.length === 0 && (
            <p className="text-[11px] text-ink-tertiary italic mb-1.5">No receipts attached.</p>
          )}
          {payment.fileIds.length > 0 && (
            <ul className="space-y-1 mb-2">
              {payment.fileIds.map((fid) => {
                const f = files.find((x) => x.id === fid);
                return (
                  <li key={fid} className="flex items-center gap-2 text-xs">
                    <a
                      href={`/api/files/${fid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info hover:underline truncate max-w-[280px]"
                    >
                      {f?.name ?? fid}
                    </a>
                    <button
                      type="button"
                      onClick={() => detach(fid, f?.name ?? null)}
                      disabled={pending}
                      className="text-ink-tertiary hover:text-danger px-1"
                      title="Detach"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {/* Pick existing only — upload-from-edit deferred to a
              follow-up since it requires multipart wiring. Receipts
              already in /files can be attached here. */}
          <details className="text-[11px]">
            <summary className="cursor-pointer text-ink-secondary hover:text-moss-700">
              + Attach existing file
            </summary>
            <div className="mt-1 max-h-40 overflow-y-auto border border-border-soft rounded-sm">
              {files.length === 0 && (
                <p className="text-[11px] text-ink-tertiary p-2 italic">
                  No files in /files yet. Upload via the Files page first.
                </p>
              )}
              {files
                .filter((f) => !payment.fileIds.includes(f.id))
                .map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => attachExisting(f.id)}
                    disabled={pending}
                    className="w-full text-left px-2 py-1 hover:bg-moss-50 text-ink-secondary truncate"
                  >
                    {f.name}
                  </button>
                ))}
            </div>
          </details>
        </div>
      </td></tr>
    );
  }

  const isPaid = payment.status === "PAID";
  // v1.75.0: link chip resolution. BUILD material wins if both happen
  // to be set (shouldn't, but defensive).
  const linkChip = payment.bookBuildMaterial
    ? {
        emoji: "🔨",
        label: `${payment.bookBuildMaterial.name}`,
        href: `/book/${payment.bookBuildMaterial.card.subsection.slug}`,
        title: `${payment.bookBuildMaterial.card.subsection.title} — ${payment.bookBuildMaterial.name}`,
      }
    : payment.bookOutfitItem
    ? {
        emoji: "👔",
        label: [
          payment.bookOutfitItem.card.personName,
          payment.bookOutfitItem.itemLabel,
        ]
          .filter(Boolean)
          .join(" — "),
        href: `/book/${payment.bookOutfitItem.card.subsection.slug}`,
        title: payment.bookOutfitItem.card.subsection.title,
      }
    : null;

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
      {/* v1.75.0: linked / receipts column. v1.79.0: + budgetLine chip. */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {linkChip && (
            <Link
              href={linkChip.href}
              title={linkChip.title}
              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-sm border bg-moss-50 border-moss-100 text-moss-700 hover:border-moss-300 truncate max-w-[180px]"
            >
              <span aria-hidden>{linkChip.emoji}</span>
              <span className="truncate">{linkChip.label}</span>
            </Link>
          )}
          {/* v1.80.0: component-level link wins for the chip label
              (more specific). */}
          {payment.budgetLineComponent ? (
            <Link
              href="/budget"
              title={`Budget: ${payment.budgetLineComponent.line.category.name} → ${payment.budgetLineComponent.line.description} → ${payment.budgetLineComponent.label}`}
              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-sm border bg-info/10 border-info/30 text-info hover:border-info truncate max-w-[220px]"
            >
              <span aria-hidden>📊</span>
              <span className="truncate">
                {payment.budgetLineComponent.line.description} · {payment.budgetLineComponent.label}
              </span>
            </Link>
          ) : payment.budgetLine ? (
            <Link
              href="/budget"
              title={`Budget: ${payment.budgetLine.category.name} → ${payment.budgetLine.description}`}
              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-sm border bg-info/10 border-info/30 text-info hover:border-info truncate max-w-[180px]"
            >
              <span aria-hidden>📊</span>
              <span className="truncate">{payment.budgetLine.category.name}</span>
            </Link>
          ) : null}
          {payment.fileIds.length > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-sm border bg-canvas border-border-soft text-ink-tertiary"
              title={`${payment.fileIds.length} receipt${payment.fileIds.length === 1 ? "" : "s"}`}
            >
              📎 {payment.fileIds.length}
            </span>
          )}
          {/* v1.86.0: fund chip. Resolved via payment > component >
              line. Shows "(inherited)" italic when the fund came from
              a parent. Hidden when nothing in the chain has a fund set. */}
          <FundChipForPayment payment={payment} labels={fundLabels} />
          {!linkChip && !payment.budgetLine && !payment.budgetLineComponent && payment.fileIds.length === 0 && (
            <span className="text-[11px] text-ink-tertiary">—</span>
          )}
        </div>
      </td>
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

// v1.86.0: render the payment's effective fund chip. Walks the
// resolution chain (payment > component > line); shows "(inherited)"
// italic when the chip came from a parent. Hidden when nothing in
// the chain has a fund set.
function FundChipForPayment({
  payment,
  labels,
}: {
  payment: Payment;
  labels: FundLabels;
}) {
  // The `Payment` types in this file widen fundSource to `string |
  // null` to keep the Prisma-client import out of the row's surface
  // area. Cast back to FundSource | null at the resolver boundary —
  // any value in the column was inserted via the Zod-validated
  // server action so the values are necessarily enum members.
  const lineCarrier = payment.budgetLine
    ? {
        fundSource: payment.budgetLine.fundSource as FundSource | null,
        fundLabel: payment.budgetLine.fundLabel,
      }
    : null;
  const compCarrier = payment.budgetLineComponent
    ? {
        fundSource: payment.budgetLineComponent.fundSource as FundSource | null,
        fundLabel: payment.budgetLineComponent.fundLabel,
      }
    : null;
  const fallbackLine = payment.budgetLineComponent?.line
    ? {
        fundSource: payment.budgetLineComponent.line.fundSource as FundSource | null,
        fundLabel: payment.budgetLineComponent.line.fundLabel,
      }
    : lineCarrier;
  const resolved = effectiveFundForPayment(
    {
      fundSource: payment.fundSource as FundSource | null,
      fundLabel: payment.fundLabel,
    },
    compCarrier,
    fallbackLine,
  );
  if (resolved.fund === "UNASSIGNED") return null;
  const display = formatFundChip(resolved.fund, resolved.label, labels);
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-sm border bg-canvas border-border-soft text-ink-secondary"
      title={resolved.inherited ? `${display} (inherited from budget line)` : display}
    >
      <span aria-hidden>▣</span>
      <span className="truncate max-w-[140px]">{display}</span>
      {resolved.inherited && (
        <span className="italic text-ink-tertiary text-[10px]">(inh.)</span>
      )}
    </span>
  );
}
