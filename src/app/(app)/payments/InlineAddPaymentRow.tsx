"use client";

import { useRef, useState, useTransition } from "react";
import { createPayment } from "./actions";
import { createSupplierQuick } from "@/app/(app)/suppliers/actions";
import { notify } from "@/lib/notify";

// v1.74.0: inline quick-add for payments. Replaces the modal popout
// from v1.56.0's AddPaymentToggle pattern. Trade-off: only the two
// minimum-required fields are exposed inline (description + amount,
// plus an optional supplier). Status defaults to DUE; everything else
// (due date, paid date, method, notes) is filled in after creation
// via PaymentRow's existing edit mode.
//
// Enter on either the description or amount input submits the row.
// On success, fields reset and focus returns to description so the
// user can hammer through a stack of receipts without grabbing the
// mouse.
//
// "+ New supplier" toggle: expands a sub-row taking name + category;
// hitting Enter creates the supplier via createSupplierQuick, prepends
// it to the local supplier list, and selects it for the current
// payment-add operation. Avoids the round-trip through /suppliers.

type Supplier = { id: string; name: string };

const NEW_SUPPLIER_VALUE = "__new__";

export function InlineAddPaymentRow({ suppliers: initialSuppliers }: { suppliers: Supplier[] }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [pending, startTransition] = useTransition();
  const descriptionRef = useRef<HTMLInputElement>(null);

  // Local mirror of the suppliers list — gets a new entry prepended
  // when the user creates a supplier inline. The next page revalidate
  // will replace this with the canonical server-rendered list.
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);

  // "+ New supplier" sub-form state.
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierCategory, setSupplierCategory] = useState("");
  const supplierNameRef = useRef<HTMLInputElement>(null);

  function reset() {
    setDescription("");
    setAmount("");
    setSupplierId("");
    descriptionRef.current?.focus();
  }

  function openSupplierForm() {
    setCreatingSupplier(true);
    setSupplierName("");
    setSupplierCategory("");
    setTimeout(() => supplierNameRef.current?.focus(), 0);
  }

  function cancelSupplierForm() {
    setCreatingSupplier(false);
    setSupplierName("");
    setSupplierCategory("");
    descriptionRef.current?.focus();
  }

  function submitSupplier() {
    const trimmedName = supplierName.trim();
    const trimmedCategory = supplierCategory.trim() || "Other";
    if (!trimmedName) {
      notify("error", "Supplier name required");
      supplierNameRef.current?.focus();
      return;
    }
    startTransition(async () => {
      try {
        const created = await createSupplierQuick({
          name: trimmedName,
          category: trimmedCategory,
        });
        setSuppliers((curr) => [{ id: created.id, name: created.name }, ...curr]);
        setSupplierId(created.id);
        setCreatingSupplier(false);
        setSupplierName("");
        setSupplierCategory("");
        notify("success", `Created supplier "${created.name}"`);
        descriptionRef.current?.focus();
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Failed to create supplier");
      }
    });
  }

  function submitPayment() {
    const trimmedDesc = description.trim();
    const trimmedAmt = amount.trim();
    if (!trimmedDesc) {
      notify("error", "Description required");
      descriptionRef.current?.focus();
      return;
    }
    if (!trimmedAmt) {
      notify("error", "Amount required");
      return;
    }
    const fd = new FormData();
    fd.set("description", trimmedDesc);
    fd.set("amount", trimmedAmt);
    fd.set("status", "DUE");
    if (supplierId) fd.set("supplierId", supplierId);
    startTransition(async () => {
      try {
        await createPayment(fd);
        notify("success", `Added "${trimmedDesc}"`);
        reset();
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Failed to add payment");
      }
    });
  }

  function onPaymentKey(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitPayment();
    }
  }
  function onSupplierKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitSupplier();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelSupplierForm();
    }
  }

  function onSupplierSelectChange(value: string) {
    if (value === NEW_SUPPLIER_VALUE) {
      openSupplierForm();
      return;
    }
    setSupplierId(value);
  }

  return (
    <div className="bg-surface border border-border-soft rounded-md shadow-sm p-3 mb-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
            Description
          </label>
          <input
            ref={descriptionRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={onPaymentKey}
            disabled={pending}
            placeholder="e.g. Florist final balance"
            className="w-full text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
          />
        </div>
        <div className="w-28">
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
            Amount £
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={onPaymentKey}
            disabled={pending}
            placeholder="0.00"
            className="w-full text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500 tabular-nums text-right"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
            Supplier
          </label>
          <select
            value={supplierId}
            onChange={(e) => onSupplierSelectChange(e.target.value)}
            onKeyDown={onPaymentKey}
            disabled={pending || creatingSupplier}
            className="w-full text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2 py-1.5 outline-none focus:border-moss-500"
          >
            <option value="">— none —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW_SUPPLIER_VALUE}>+ New supplier…</option>
          </select>
        </div>
        <button
          type="button"
          onClick={submitPayment}
          disabled={pending || creatingSupplier}
          className="text-xs font-medium px-3 py-1.5 rounded-sm border bg-moss-500 text-white border-moss-500 hover:bg-moss-700 hover:border-moss-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "Adding…" : "+ Add"}
        </button>
      </div>

      {creatingSupplier && (
        <div className="mt-3 p-2.5 border border-moss-300 bg-moss-50/40 rounded-sm">
          <div className="text-[10px] font-bold text-moss-700 uppercase tracking-wider mb-1.5">
            New supplier
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Name
              </label>
              <input
                ref={supplierNameRef}
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                onKeyDown={onSupplierKey}
                disabled={pending}
                placeholder="e.g. Paintbox Blooms"
                className="w-full text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Category
              </label>
              <input
                type="text"
                value={supplierCategory}
                onChange={(e) => setSupplierCategory(e.target.value)}
                onKeyDown={onSupplierKey}
                disabled={pending}
                placeholder="e.g. Florist · defaults to Other"
                className="w-full text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
              />
            </div>
            <button
              type="button"
              onClick={submitSupplier}
              disabled={pending}
              className="text-xs font-medium px-3 py-1.5 rounded-sm border bg-moss-500 text-white border-moss-500 hover:bg-moss-700 hover:border-moss-700 disabled:opacity-50 transition-colors"
            >
              {pending ? "Creating…" : "Create supplier"}
            </button>
            <button
              type="button"
              onClick={cancelSupplierForm}
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded-sm border bg-canvas text-ink-secondary border-border-soft hover:border-moss-300 hover:text-moss-700 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-ink-tertiary mt-1.5">
        Press <kbd className="px-1 border border-border-soft rounded-sm bg-canvas text-ink-secondary text-[10px] font-mono">Enter</kbd> to add. Defaults to <em>Due</em>; edit the row to fill in due date, method, or notes.
      </p>
    </div>
  );
}
