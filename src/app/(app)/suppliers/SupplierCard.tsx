"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { SupplierForm } from "./SupplierForm";
import { deleteSupplier, setSupplierStatus, updateSupplier } from "./actions";
import { formatMoneyDecimal } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";

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

// v2.5.1: exported so SupplierDetailClient's header bar can reuse the
// exact same status→pill mapping and option list. Previously the
// detail page kept its own local copy that mapped CONTACTED/QUOTED to
// "LEAD" instead of "PENDING" — cosmetic drift meant the same status
// looked different depending which page you were on. One source of
// truth now.
export const STATUS_TO_PILL: Record<string, "LEAD" | "BOOKED" | "PAID" | "DECLINED" | "PENDING"> = {
  SHORTLIST: "LEAD",
  CONTACTED: "PENDING",
  QUOTED: "PENDING",
  BOOKED: "BOOKED",
  PAID: "PAID",
  REJECTED: "DECLINED",
};

export const STATUS_OPTIONS: SupplierStatus[] = [
  "SHORTLIST", "CONTACTED", "QUOTED", "BOOKED", "PAID", "REJECTED",
];

export function SupplierCard({
  supplier,
  canEdit,
  showMoney,
}: {
  supplier: Supplier;
  canEdit: boolean;
  /** v1.76.0: gates the Agreed line in read mode + the amountAgreed
   *  input in edit mode. When false, edit submits preserve the
   *  existing amountAgreed via a hidden input so non-money editors
   *  don't clobber it. */
  showMoney: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  function changeStatus(next: SupplierStatus) {
    startTransition(async () => {
      await setSupplierStatus(supplier.id, next);
      // v2.5.1 (ADHD closing touch): the status select had no
      // feedback at all on save — a quick-win action (bump a supplier
      // a stage) deserves a quick acknowledgment so the loop closes.
      notify("success", `${supplier.name} → ${next.charAt(0) + next.slice(1).toLowerCase()}`);
    });
  }

  async function onDelete() {
    // v1.60.0 (P2): enrich the confirm dialog with the snapshot fields
    // we already have on the card — status, agreed amount, last
    // contact. v1.62.0: now rendered via the shared ConfirmDialog
    // component (custom UI), so the snapshot fields appear as a
    // structured node instead of `\n`-joined plaintext.
    const lastComm = supplier.communications[0];
    if (!(await confirm({
      title: `Delete supplier "${supplier.name}"?`,
      body: (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs mb-3">
            <dt className="text-ink-tertiary">Category</dt>
            <dd className="text-ink-secondary">{supplier.category}</dd>
            <dt className="text-ink-tertiary">Status</dt>
            <dd className="text-ink-secondary">{supplier.status}</dd>
            {supplier.amountAgreed && (
              <>
                <dt className="text-ink-tertiary">Agreed</dt>
                <dd className="text-ink-secondary">£{formatMoneyDecimal(supplier.amountAgreed)}</dd>
              </>
            )}
            {lastComm && (
              <>
                <dt className="text-ink-tertiary">Last contact</dt>
                <dd className="text-ink-secondary">{formatRelativeDate(lastComm.createdAt)} ({lastComm.channel.toLowerCase()})</dd>
              </>
            )}
          </dl>
          <p className="text-xs text-ink-tertiary">
            If this supplier has linked tasks, payments, or contracts, the delete will fail and you&apos;ll be told what&apos;s blocking it.
          </p>
        </>
      ),
      confirmLabel: "Delete",
      tone: "danger",
    }))) return;
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
          showMoney={showMoney}
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
    // v2.5.1: `relative` makes this the containing block for the name
    // link's stretched-link pseudo-element below, so the whole card
    // becomes a click target instead of just the small name text.
    // hover:shadow-md gives a visible affordance that it's clickable.
    <div className="relative bg-surface border border-border-soft rounded-md p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/suppliers/${supplier.id}`}
            // after:absolute after:inset-0 stretches an invisible hit
            // area over the nearest positioned ancestor (the card div
            // above) — the classic "stretched link" trick. The anchor
            // itself stays position:static so its pseudo-element
            // bubbles up to cover the whole card, not just its own text.
            className="text-sm font-semibold text-ink-primary truncate hover:text-moss-700 hover:underline after:absolute after:inset-0 after:content-['']"
            title="Open supplier details"
          >
            {supplier.name}
          </Link>
          <div className="text-xs text-ink-tertiary">{supplier.category}</div>
        </div>
        <StatusPill status={STATUS_TO_PILL[supplier.status] ?? "LEAD"} label={supplier.status.toLowerCase()} />
      </div>
      {showMoney && supplier.amountAgreed && (
        <div className="text-xs text-ink-secondary">
          Agreed · <span className="font-semibold text-ink-primary">{formatMoneyDecimal(supplier.amountAgreed)}</span>
        </div>
      )}
      {supplier.website && (
        // relative z-10: sits above the name link's stretched overlay
        // so it stays independently clickable (opens the website, not
        // the detail page).
        <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="relative z-10 text-xs text-moss-500 hover:underline truncate">
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
          // v2.5.1: bumped from text-[11px] to text-xs and dropped the
          // stacked /80 opacity on top of an already-dim ink-tertiary
          // — this line is read content (what/when), not label chrome.
          <div className="text-xs text-ink-tertiary line-clamp-2" title={last.summary}>
            <span className="text-ink-tertiary">Last ({last.channel}, {formatRelativeDate(last.createdAt)}):</span>{" "}
            <span className="text-ink-secondary">{summary}</span>
          </div>
        );
      })()}
      {canEdit && (
        // relative z-10: keeps the status select + Edit/Delete buttons
        // independently clickable above the name link's stretched
        // overlay (otherwise every click here would navigate instead).
        <div className="relative z-10 flex flex-wrap items-center gap-1.5 mt-1 pt-2 border-t border-border-soft">
          <select
            value={supplier.status}
            onChange={(e) => changeStatus(e.target.value as SupplierStatus)}
            disabled={pending}
            aria-label={`Change status for ${supplier.name}`}
            className="text-xs bg-canvas border border-border-soft rounded-sm px-1.5 py-0.5 text-ink-secondary outline-none min-h-[40px] sm:min-h-0"
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
