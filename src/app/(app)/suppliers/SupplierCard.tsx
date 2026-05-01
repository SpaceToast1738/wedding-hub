"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { SupplierForm } from "./SupplierForm";
import { deleteSupplier, setSupplierStatus, updateSupplier } from "./actions";
import { formatMoneyDecimal } from "@/lib/format";
import { notify } from "@/lib/notify";

// Local mirror of `formatRelativeDate` from SupplierDetailClient — keep
// in sync if the contract changes (would centralise in @/lib/format if
// a third caller turned up).
function formatRelativeDate(d: Date): string {
  const now = Date.now();
  const diffMs = now - new Date(d).getTime();
  const days = Math.round(diffMs / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
import type { SupplierStatus } from "@prisma/client";

type Supplier = {
  id: string;
  name: string;
  category: string;
  status: SupplierStatus;
  website: string | null;
  notes: string | null;
  amountAgreed: { toString: () => string } | null;
  // B4: most-recent SupplierCommunication, if any. Empty array when
  // none — Prisma's `take: 1` returns an array.
  communications: { summary: string; createdAt: Date; channel: string }[];
};

const STATUS_TO_PILL: Record<string, "LEAD" | "BOOKED" | "PAID" | "DECLINED" | "PENDING"> = {
  SHORTLIST: "LEAD",
  CONTACTED: "PENDING",
  QUOTED: "PENDING",
  BOOKED: "BOOKED",
  PAID: "PAID",
  REJECTED: "DECLINED",
};

const STATUS_OPTIONS: SupplierStatus[] = [
  "SHORTLIST", "CONTACTED", "QUOTED", "BOOKED", "PAID", "REJECTED",
];

export function SupplierCard({ supplier, canEdit }: { supplier: Supplier; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function changeStatus(next: SupplierStatus) {
    startTransition(async () => {
      await setSupplierStatus(supplier.id, next);
    });
  }

  function onDelete() {
    // v1.60.0 (P2): enrich the confirm dialog with the snapshot fields
    // we already have on the card — status, agreed amount, last
    // contact. Pre-fix the dialog was just `Delete "X"?` with no
    // context, and FK-blocked deletes silently failed (now they
    // toast — but the couple can also see the consequences before
    // confirming).
    const lines: string[] = [];
    lines.push(`Delete supplier "${supplier.name}"?`);
    lines.push("");
    lines.push(`Category: ${supplier.category}`);
    lines.push(`Status: ${supplier.status}`);
    if (supplier.amountAgreed) {
      lines.push(`Agreed: £${formatMoneyDecimal(supplier.amountAgreed)}`);
    }
    const lastComm = supplier.communications[0];
    if (lastComm) {
      lines.push(`Last contact: ${formatRelativeDate(lastComm.createdAt)} (${lastComm.channel.toLowerCase()})`);
    }
    lines.push("");
    lines.push("If this supplier has linked tasks, payments, or contracts, the delete will fail and you'll be told what's blocking it.");
    if (!confirm(lines.join("\n"))) return;
    startTransition(async () => {
      // v1.53.0 (C1): result-shape — show a real toast on FK-blocked
      // delete instead of relying on Next prod redaction (silent
      // failure with no row removed).
      const res = await deleteSupplier(supplier.id);
      if (res.ok) notify("success", "Supplier deleted");
      else notify("error", res.error);
    });
  }

  if (editing) {
    return (
      <div className="bg-surface border border-moss-100 rounded-md p-4 shadow-md">
        <SupplierForm
          submitLabel="Save"
          initial={{
            name: supplier.name,
            category: supplier.category,
            status: supplier.status,
            website: supplier.website ?? "",
            notes: supplier.notes ?? "",
            amountAgreed: supplier.amountAgreed ? supplier.amountAgreed.toString() : "",
          }}
          onSubmit={async (fd) => {
            await updateSupplier(supplier.id, fd);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border-soft rounded-md p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/suppliers/${supplier.id}`}
            className="text-sm font-semibold text-ink-primary truncate hover:text-moss-700 hover:underline"
            title="Open supplier details"
          >
            {supplier.name}
          </Link>
          <div className="text-xs text-ink-tertiary">{supplier.category}</div>
        </div>
        <StatusPill status={STATUS_TO_PILL[supplier.status] ?? "LEAD"} label={supplier.status.toLowerCase()} />
      </div>
      {supplier.amountAgreed && (
        <div className="text-xs text-ink-secondary">
          Agreed · <span className="font-semibold text-ink-primary">{formatMoneyDecimal(supplier.amountAgreed)}</span>
        </div>
      )}
      {supplier.website && (
        <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-xs text-moss-500 hover:underline truncate">
          {supplier.website.replace(/^https?:\/\//, "")}
        </a>
      )}
      {supplier.notes && <p className="text-xs text-ink-secondary line-clamp-3 whitespace-pre-wrap">{supplier.notes}</p>}
      {supplier.communications[0] && (() => {
        const last = supplier.communications[0];
        const summary = last.summary.length > 80
          ? `${last.summary.slice(0, 80).trimEnd()}…`
          : last.summary;
        return (
          <div className="text-[11px] text-ink-tertiary line-clamp-2" title={last.summary}>
            <span className="text-ink-tertiary/80">Last ({last.channel}, {formatRelativeDate(last.createdAt)}):</span>{" "}
            <span className="text-ink-secondary">{summary}</span>
          </div>
        );
      })()}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1 pt-2 border-t border-border-soft">
          <select
            value={supplier.status}
            onChange={(e) => changeStatus(e.target.value as SupplierStatus)}
            disabled={pending}
            className="text-xs bg-canvas border border-border-soft rounded-sm px-1.5 py-0.5 text-ink-secondary outline-none"
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>Delete</Button>
        </div>
      )}
    </div>
  );
}
