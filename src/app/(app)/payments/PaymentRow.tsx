"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { BarChart3, Hammer, Paperclip, Shirt } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { PaymentForm } from "./PaymentForm";
import {
  deletePayment,
  setPaymentStatus,
  updatePayment,
  attachReceiptToPayment,
  detachReceiptFromPayment,
  uploadAndAttachReceipt,
} from "./actions";
import { formatDate, formatMoneyDecimal, formatRelativeDue, isoForInput } from "@/lib/format";
import type { PaymentStatus } from "@prisma/client";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import { notify } from "@/lib/notify";
import { effectiveFundForPayment, formatFundChip, resolveFundLabels, type FundLabels } from "@/lib/funds";
import type { FundSource } from "@prisma/client";

// v2.6.0 (design pass finding 1): OVERDUE is a manual status nobody
// actually sets in practice — a payment sitting at DUE or SCHEDULED
// with a due date in the past is functionally overdue regardless of
// what the enum column says. Derived at render time so it can't drift
// from reality the way the manual status can. Exported so /payments
// can group + sort by this derived status too.
export function isPaymentOverdue(payment: { status: string; dueDate: Date | null }): boolean {
  // v2.5.2 (review fix): a manually-set OVERDUE status must agree
  // with the derived date-based check, or the StatusPill (which reads
  // the raw status) and the due-date cell (which read only the
  // derived check) disagreed for that one path — the pill said
  // "overdue" while the date rendered in plain, uncoloured text.
  if (payment.status === "OVERDUE") return true;
  if (payment.status !== "DUE" && payment.status !== "SCHEDULED") return false;
  if (!payment.dueDate) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = payment.dueDate;
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return dueDay.getTime() < today.getTime();
}

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
type FileSummary = { id: string; name: string; mimeType: string; folder: string | null };
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
  layout = "table",
  editing,
  onEditToggle,
}: {
  payment: Payment;
  suppliers: Supplier[];
  files: FileSummary[];
  budgetCategories: BudgetCategoryWithLines[];
  canEdit: boolean;
  // v1.86.0: couple's first names so the fund chip can render
  // "Bryony" / "Jamie" instead of "Bride" / "Groom" fallbacks.
  fundLabelSource: { brideFirst: string; groomFirst: string };
  // v2.6.0 (design pass finding 2): PaymentsList mounts this component
  // TWICE per payment — once in the desktop <table> (layout="table",
  // hidden below sm) and once in the sm:hidden mobile card list
  // (layout="card"). `editing` is lifted to PaymentsList so toggling
  // Edit on one copy can't desync from the other mid-viewport-change.
  // Standalone callers (none currently) get sane defaults.
  layout?: "table" | "card";
  editing?: boolean;
  onEditToggle?: (next: boolean) => void;
}) {
  const fundLabels = resolveFundLabels(fundLabelSource);
  // Fallback local state lets PaymentRow still work if ever rendered
  // without a lifted `editing` prop (defensive — PaymentsList always
  // supplies one today).
  const [localEditing, setLocalEditing] = useState(false);
  const isEditing = editing ?? localEditing;
  const setEditing = onEditToggle ?? setLocalEditing;
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

  // v1.89.0: upload one OR many receipts from the device. Each file
  // goes through `uploadAndAttachReceipt` so we get the standard
  // MIME + size validation, audit row, and Files-row creation.
  const fileInputRef = useRef<HTMLInputElement>(null);
  function uploadLocalFiles(picked: File[]) {
    if (picked.length === 0) return;
    startTransition(async () => {
      let okCount = 0;
      for (const file of picked) {
        const fd = new FormData();
        fd.set("file", file);
        const res = await uploadAndAttachReceipt(payment.id, fd);
        if (res.ok) {
          okCount += 1;
        } else {
          notify("error", `"${file.name}": ${res.error}`);
        }
      }
      if (okCount > 0) {
        notify(
          "success",
          `Uploaded ${okCount} receipt${okCount === 1 ? "" : "s"}`,
        );
      }
    });
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

  if (isEditing) {
    const form = (
      <>
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
                      className="text-info hover:underline truncate max-w-[280px] flex items-baseline gap-1.5"
                      title={f?.folder ? `${f.folder} / ${f.name}` : f?.name ?? fid}
                    >
                      {/* v1.89.2: show the folder name as a muted
                          prefix chip so files with similar names are
                          distinguishable at a glance. */}
                      {f?.folder && (
                        <span className="text-[10px] text-ink-tertiary uppercase tracking-wider">
                          {f.folder}
                        </span>
                      )}
                      <span className="truncate">{f?.name ?? fid}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => detach(fid, f?.name ?? null)}
                      disabled={pending}
                      className="text-ink-tertiary hover:text-danger px-1"
                      title="Detach"
                      aria-label={`Detach ${f?.name ?? fid}`}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {/* v1.89.0: inline multi-file upload landed here.
              Receipts already in /files can still be attached via
              the "+ Attach existing file" disclosure below. */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              uploadLocalFiles(picked);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
            className="text-[11px] mb-1.5 px-2 py-1 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700 disabled:opacity-50"
          >
            ↑ Upload receipt{payment.fileIds.length > 0 ? " (more)" : ""} — one or many
          </button>
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
              {/* v1.89.2: group available files by folder so the
                  picker is scannable when there are many files
                  across multiple folders. */}
              {(() => {
                const groups = new Map<string, FileSummary[]>();
                for (const f of files) {
                  if (payment.fileIds.includes(f.id)) continue;
                  const key = f.folder ?? "Uncategorised";
                  const list = groups.get(key);
                  if (list) list.push(f);
                  else groups.set(key, [f]);
                }
                return Array.from(groups.entries()).map(([folder, list]) => (
                  <div key={folder}>
                    <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider px-2 pt-1.5 pb-0.5 bg-canvas/40 sticky top-0">
                      {folder}
                    </div>
                    {list.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => attachExisting(f.id)}
                        disabled={pending}
                        className="w-full text-left px-2 py-1 hover:bg-moss-50 text-ink-secondary truncate"
                        title={`${folder} / ${f.name}`}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </details>
        </div>
      </>
    );
    if (layout === "card") {
      return <div className="p-3 bg-moss-50/30">{form}</div>;
    }
    return (
      <tr>
        <td colSpan={8} className="p-3 bg-moss-50/30">
          {form}
        </td>
      </tr>
    );
  }

  const isPaid = payment.status === "PAID";
  // v1.75.0: link chip resolution. BUILD material wins if both happen
  // to be set (shouldn't, but defensive).
  const linkChip = payment.bookBuildMaterial
    ? {
        icon: Hammer,
        label: `${payment.bookBuildMaterial.name}`,
        href: `/book/${payment.bookBuildMaterial.card.subsection.slug}`,
        title: `${payment.bookBuildMaterial.card.subsection.title} — ${payment.bookBuildMaterial.name}`,
      }
    : payment.bookOutfitItem
    ? {
        icon: Shirt,
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

  // v2.6.0 (design pass finding 1): derive overdue at render time — see
  // isPaymentOverdue above. When true, the status pill flips to the
  // existing OVERDUE styling and the due-date cell switches to danger
  // color + formatRelativeDue's relative text, regardless of what the
  // manual `status` column actually says.
  const derivedOverdue = isPaymentOverdue(payment);
  const pillStatus = derivedOverdue ? "OVERDUE" : STATUS_PILL[payment.status] ?? "PENDING";
  const pillLabel = derivedOverdue ? "overdue" : payment.status.toLowerCase();

  // v2.6.0: shared between the table row and the mobile card so the two
  // layouts don't drift apart — only the surrounding structure differs.
  const chipsRow = (
    <>
      {linkChip && (
        <Link
          href={linkChip.href}
          title={linkChip.title}
          className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-sm border bg-moss-50 border-moss-100 text-moss-700 hover:border-moss-300 truncate max-w-[180px]"
        >
          <linkChip.icon aria-hidden className="w-3 h-3 flex-shrink-0" />
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
          <BarChart3 aria-hidden className="w-3 h-3 flex-shrink-0" />
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
          <BarChart3 aria-hidden className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{payment.budgetLine.category.name}</span>
        </Link>
      ) : null}
      {payment.fileIds.length > 0 && (
        <span
          className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-sm border bg-canvas border-border-soft text-ink-tertiary"
          title={`${payment.fileIds.length} receipt${payment.fileIds.length === 1 ? "" : "s"}`}
        >
          <Paperclip aria-hidden className="w-3 h-3" />
          {payment.fileIds.length}
        </span>
      )}
      {/* v1.86.0: fund chip. Resolved via payment > component >
          line. Shows "(inherited)" italic when the fund came from
          a parent. Hidden when nothing in the chain has a fund set. */}
      <FundChipForPayment payment={payment} labels={fundLabels} />
    </>
  );
  const hasChips =
    !!linkChip ||
    !!payment.budgetLine ||
    !!payment.budgetLineComponent ||
    payment.fileIds.length > 0 ||
    resolvePaymentFundChip(payment).fund !== "UNASSIGNED";

  if (layout === "card") {
    // v2.6.0 (design pass finding 2): mobile stacked card. Pre-fix,
    // phones only got the horizontally-scrolling table, which pushed
    // Mark paid and the Paid/Status columns off-screen.
    return (
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm text-ink-primary font-medium">{payment.description}</div>
            {supplierName && <div className="text-xs text-ink-tertiary mt-0.5">{supplierName}</div>}
            {payment.notes && <div className="text-xs text-ink-tertiary line-clamp-1 mt-0.5">{payment.notes}</div>}
          </div>
          <div className="text-sm font-semibold text-ink-primary tabular-nums shrink-0">
            {formatMoneyDecimal(payment.amount)}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-2">
          <span className={`text-xs ${derivedOverdue ? "text-danger font-medium" : "text-ink-secondary"}`}>
            {derivedOverdue ? formatRelativeDue(payment.dueDate) : formatDate(payment.dueDate)}
          </span>
          <StatusPill status={pillStatus} label={pillLabel} />
        </div>
        {hasChips && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2">{chipsRow}</div>
        )}
        {canEdit && (
          <div className="mt-3 space-y-2">
            {/* v2.6.0: full-width Mark paid — the primary action
                shouldn't require a precise tap on a small button. */}
            {isPaid ? (
              <Button variant="ghost" size="sm" className="w-full" onClick={unmarkPaid} disabled={pending}>Unmark paid</Button>
            ) : (
              <Button variant="secondary" size="sm" className="w-full" onClick={markPaid} disabled={pending}>Mark paid</Button>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setEditing(true)} disabled={pending}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>Delete</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <tr className="border-b border-border-soft last:border-b-0 hover:bg-muted/30">
      <td className="px-4 py-2.5">
        <div className="text-sm text-ink-primary">{payment.description}</div>
        {payment.notes && <div className="text-xs text-ink-tertiary line-clamp-1">{payment.notes}</div>}
      </td>
      <td className="px-4 py-2.5 text-xs text-ink-tertiary truncate">{supplierName ?? "—"}</td>
      <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-ink-primary">{formatMoneyDecimal(payment.amount)}</td>
      <td className={`px-4 py-2.5 text-xs ${derivedOverdue ? "text-danger font-medium" : "text-ink-secondary"}`}>
        {derivedOverdue ? formatRelativeDue(payment.dueDate) : formatDate(payment.dueDate)}
      </td>
      <td className="px-4 py-2.5"><StatusPill status={pillStatus} label={pillLabel} /></td>
      <td className="px-4 py-2.5 text-xs text-ink-tertiary">{payment.method ?? "—"}</td>
      {/* v1.75.0: linked / receipts column. v1.79.0: + budgetLine chip. */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {chipsRow}
          {!hasChips && <span className="text-[11px] text-ink-tertiary">—</span>}
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

// v1.86.0: resolve a payment's effective fund. Walks the resolution
// chain (payment > component > line). Extracted from FundChipForPayment
// (v2.6.0) so PaymentRow can also ask "would a fund chip even render?"
// without duplicating the chain logic — used to decide whether the
// mobile card's chip row needs to appear at all.
function resolvePaymentFundChip(payment: Payment) {
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
  return effectiveFundForPayment(
    {
      fundSource: payment.fundSource as FundSource | null,
      fundLabel: payment.fundLabel,
    },
    compCarrier,
    fallbackLine,
  );
}

// v1.86.0: render the payment's effective fund chip. Hidden when
// nothing in the chain has a fund set; shows "(inherited)" italic when
// the chip came from a parent.
function FundChipForPayment({
  payment,
  labels,
}: {
  payment: Payment;
  labels: FundLabels;
}) {
  const resolved = resolvePaymentFundChip(payment);
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

// v2.6.0 (design pass): groups + renders the whole payments list. Two
// things pre-fix lived only as a flat table sorted by the raw status
// enum: (a) OVERDUE payments buried under the entire paid pile because
// the enum order put PAID/OVERDUE wherever the DB felt like, and (b)
// the ADHD-relevant "what do I do next" question had no structural
// answer beyond scanning the sort order.
//
// Now the list buckets into plain-language groups — Needs attention
// (overdue or due) → Coming up (scheduled) → Done (paid) — so the
// page's structure itself answers that question. Cancelled sits in
// its own collapsed section at the bottom so it doesn't add noise to
// the common case (ADHD note: keep extra chips/sections restrained).
//
// Each bucket renders as BOTH a desktop table (hidden below sm) and a
// mobile card list (sm:hidden) — see PaymentRow's `layout` prop.
// `editingId` lives here (not in PaymentRow) so the desktop and mobile
// copies of the same payment can't desync mid-edit if the viewport
// changes.
export function PaymentsList({
  payments,
  suppliers,
  files,
  budgetCategories,
  canEdit,
  fundLabelSource,
}: {
  payments: Payment[];
  suppliers: Supplier[];
  files: FileSummary[];
  budgetCategories: BudgetCategoryWithLines[];
  canEdit: boolean;
  fundLabelSource: { brideFirst: string; groomFirst: string };
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

  const dueDateMs = (p: Payment) => (p.dueDate ? p.dueDate.getTime() : Infinity);
  const paidDateMs = (p: Payment) => (p.paidDate ? p.paidDate.getTime() : -Infinity);

  // Every payment lands in exactly one bucket — the four groups below
  // are exhaustive over the five PaymentStatus values plus the derived-
  // overdue check (a SCHEDULED payment whose date has passed still
  // reads as "needs attention", not "coming up").
  const needsAttention = payments
    .filter((p) => p.status === "DUE" || p.status === "OVERDUE" || isPaymentOverdue(p))
    .sort((a, b) => dueDateMs(a) - dueDateMs(b));
  const comingUp = payments
    .filter((p) => p.status === "SCHEDULED" && !isPaymentOverdue(p))
    .sort((a, b) => dueDateMs(a) - dueDateMs(b));
  const done = payments
    .filter((p) => p.status === "PAID")
    .sort((a, b) => paidDateMs(b) - paidDateMs(a));
  const cancelled = payments.filter((p) => p.status === "CANCELLED");

  const groups: { key: string; label: string; items: Payment[] }[] = [
    { key: "attention", label: "Needs attention", items: needsAttention },
    { key: "upcoming", label: "Coming up", items: comingUp },
    { key: "done", label: "Done", items: done },
  ];
  const colCount = canEdit ? 8 : 7;

  const sharedRowProps = (p: Payment) => ({
    payment: p,
    suppliers,
    files,
    budgetCategories,
    canEdit,
    fundLabelSource,
    editing: editingId === p.id,
    onEditToggle: (v: boolean) => setEditingId(v ? p.id : null),
  });

  return (
    <div className="bg-surface border border-border-soft rounded-md shadow-sm overflow-hidden">
      {/* Desktop / tablet: one table, with a small labelled header row
          between groups. Hidden below sm — see the card list below. */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* v2.6.0: header text promoted from ink-tertiary to
                ink-secondary — column headers are informational, not
                decorative. */}
            <tr className="border-b border-border-soft text-[10px] font-bold text-ink-secondary uppercase tracking-wider bg-canvas">
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-left">Supplier</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-left">Due</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Method</th>
              <th className="px-4 py-2 text-left">Linked / Receipts</th>
              {canEdit && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) =>
              g.items.length === 0 ? null : (
                <Fragment key={g.key}>
                  <tr>
                    <td colSpan={colCount} className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-secondary bg-canvas border-b border-border-soft">
                      {g.label} · {g.items.length}
                    </td>
                  </tr>
                  {g.items.map((p) => (
                    <PaymentRow key={p.id} layout="table" {...sharedRowProps(p)} />
                  ))}
                </Fragment>
              ),
            )}
            {cancelled.length > 0 && (
              <>
                <tr>
                  <td colSpan={colCount} className="p-0">
                    <button
                      type="button"
                      onClick={() => setShowCancelled((v) => !v)}
                      className="w-full text-left px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-tertiary hover:text-ink-secondary bg-canvas border-b border-border-soft"
                      aria-expanded={showCancelled}
                    >
                      {showCancelled ? "▾" : "▸"} Cancelled · {cancelled.length}
                    </button>
                  </td>
                </tr>
                {showCancelled &&
                  cancelled.map((p) => <PaymentRow key={p.id} layout="table" {...sharedRowProps(p)} />)}
              </>
            )}
          </tbody>
        </table>
      </div>
      {/* v2.6.0 (design pass finding 2): mobile stacked-card list. Each
          payment renders as a self-contained card instead of the
          table's cramped, horizontally-scrolling cells. */}
      <div className="sm:hidden">
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <div key={g.key}>
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-secondary bg-canvas border-b border-border-soft">
                {g.label} · {g.items.length}
              </div>
              <div className="divide-y divide-border-soft">
                {g.items.map((p) => (
                  <PaymentRow key={p.id} layout="card" {...sharedRowProps(p)} />
                ))}
              </div>
            </div>
          ),
        )}
        {cancelled.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowCancelled((v) => !v)}
              className="w-full text-left px-3 py-2.5 min-h-[40px] text-[11px] font-bold uppercase tracking-wider text-ink-tertiary hover:text-ink-secondary bg-canvas border-b border-border-soft"
              aria-expanded={showCancelled}
            >
              {showCancelled ? "▾" : "▸"} Cancelled · {cancelled.length}
            </button>
            {showCancelled && (
              <div className="divide-y divide-border-soft">
                {cancelled.map((p) => (
                  <PaymentRow key={p.id} layout="card" {...sharedRowProps(p)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
