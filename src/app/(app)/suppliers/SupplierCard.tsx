"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { SupplierForm } from "./SupplierForm";
import { deleteSupplier, setSupplierStatus, updateSupplier } from "./actions";
import { formatMoneyDecimal } from "@/lib/format";
import type { SupplierStatus } from "@prisma/client";

type Supplier = {
  id: string;
  name: string;
  category: string;
  status: SupplierStatus;
  website: string | null;
  notes: string | null;
  amountAgreed: { toString: () => string } | null;
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
    if (!confirm(`Delete supplier "${supplier.name}"?`)) return;
    startTransition(async () => {
      await deleteSupplier(supplier.id);
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
