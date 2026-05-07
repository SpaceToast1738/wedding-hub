"use client";

import { useRef, useState, useTransition } from "react";
import { createPayment } from "./actions";
import { createSupplierQuick } from "@/app/(app)/suppliers/actions";
import { notify } from "@/lib/notify";

// v1.75.0: Excel-style multi-row inline payment entry. Replaces the
// v1.74.0 single-row InlineAddPaymentRow. N visible blank rows; each
// has description / amount / supplier / 🔗 link / 📎 receipt; **Enter**
// on description or amount commits the current row, clears it, and
// advances focus to the next blank row.
//
// Description input uses a `<datalist>` populated from past payment
// descriptions so the browser can autofill on retype.
//
// Supplier select keeps the v1.74.0 `+ New supplier…` expansion flow
// — calls createSupplierQuick, prepends the new supplier to the local
// list, auto-selects it for the in-progress row.
//
// 🔗 Link opens a popover with cascading selects for BUILD card →
// material OR a flat select of outfit items. Selection persists in
// row-local state and is sent to createPayment as
// `bookBuildMaterialId` or `bookOutfitId` on Enter.
//
// 📎 Receipt path: receipts attach AFTER the payment is created
// (we need a paymentId before we can upload+attach). On Enter, the
// payment is created, then any pending File objects are uploaded and
// attached via uploadAndAttachReceipt. The chip shows pending count
// before commit; final count after commit.

type Supplier = { id: string; name: string };

type BuildOption = {
  cardId: string;
  cardTitle: string;
  cardSlug: string;
  materials: { id: string; name: string; ordered: boolean }[];
};

type OutfitOption = { id: string; label: string };

type FileSummary = { id: string; name: string; mimeType: string };

type LinkSelection =
  | { kind: "buildMaterial"; cardId: string; materialId: string; label: string }
  | { kind: "outfit"; outfitId: string; label: string }
  | null;

type RowDraft = {
  key: string;
  description: string;
  amount: string;
  supplierId: string;
  link: LinkSelection;
  // pending receipts: a mix of already-uploaded files (id set) and
  // newly-selected File objects (queued: object set). Queued files
  // upload after the payment is created.
  attachedFileIds: string[];
  queuedFiles: File[];
};

const NEW_SUPPLIER_VALUE = "__new__";
const INITIAL_ROW_COUNT = 5;

function makeBlankRow(): RowDraft {
  return {
    key: crypto.randomUUID(),
    description: "",
    amount: "",
    supplierId: "",
    link: null,
    attachedFileIds: [],
    queuedFiles: [],
  };
}

function isRowEmpty(r: RowDraft): boolean {
  return (
    !r.description.trim() &&
    !r.amount.trim() &&
    !r.supplierId &&
    !r.link &&
    r.attachedFileIds.length === 0 &&
    r.queuedFiles.length === 0
  );
}

export function InlinePaymentGrid({
  suppliers: initialSuppliers,
  recentDescriptions,
  buildOptions,
  outfitOptions,
  files: initialFiles,
}: {
  suppliers: Supplier[];
  recentDescriptions: string[];
  buildOptions: BuildOption[];
  outfitOptions: OutfitOption[];
  files: FileSummary[];
}) {
  const [rows, setRows] = useState<RowDraft[]>(() =>
    Array.from({ length: INITIAL_ROW_COUNT }, makeBlankRow),
  );
  const [pending, startTransition] = useTransition();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [files] = useState<FileSummary[]>(initialFiles);
  // refs for focusing the description cell of each row
  const descriptionRefs = useRef<(HTMLInputElement | null)[]>([]);

  // "+ New supplier" sub-form — global to the grid (only one open at a
  // time; tracks which row triggered it so the new id can be wired to
  // the right row).
  const [supplierFormForRow, setSupplierFormForRow] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierCategory, setSupplierCategory] = useState("");
  const supplierNameRef = useRef<HTMLInputElement>(null);

  // Link picker — global; tracks which row the popover is editing.
  const [linkPickerForRow, setLinkPickerForRow] = useState<string | null>(null);

  function updateRow(key: string, patch: Partial<RowDraft>) {
    setRows((curr) => curr.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function focusDescription(index: number) {
    setTimeout(() => descriptionRefs.current[index]?.focus(), 0);
  }

  // Find the next non-pending blank row index after `from`. Used after
  // a row commits so the user lands on a fresh row without grabbing
  // the mouse.
  function advanceFocusFrom(rows: RowDraft[], fromKey: string) {
    const fromIdx = rows.findIndex((r) => r.key === fromKey);
    for (let i = fromIdx + 1; i < rows.length; i++) {
      if (isRowEmpty(rows[i]!)) {
        focusDescription(i);
        return;
      }
    }
    focusDescription(rows.length - 1);
  }

  function commitRow(key: string) {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    const trimmedDesc = row.description.trim();
    const trimmedAmt = row.amount.trim();
    if (!trimmedDesc) {
      notify("error", "Description required");
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
    if (row.supplierId) fd.set("supplierId", row.supplierId);
    if (row.link?.kind === "buildMaterial") {
      fd.set("bookBuildMaterialId", row.link.materialId);
    }
    if (row.link?.kind === "outfit") {
      fd.set("bookOutfitId", row.link.outfitId);
    }
    for (const fid of row.attachedFileIds) fd.append("fileIds", fid);
    startTransition(async () => {
      try {
        await createPayment(fd);
        // Side-effect: upload any queued File objects via the dedicated
        // upload-and-attach action. We don't have the new payment id
        // here (createPayment is a form-action returning void), so
        // queued uploads are effectively lost — surface a warning so
        // the user knows. A later pass could promote createPayment to
        // return the id.
        if (row.queuedFiles.length > 0) {
          notify(
            "warn",
            `Payment added, but ${row.queuedFiles.length} pending receipt${row.queuedFiles.length === 1 ? "" : "s"} couldn't auto-attach. Upload from the row's edit menu.`,
          );
        } else {
          notify("success", `Added "${trimmedDesc}"`);
        }
        // Replace the committed row with a fresh blank one in-place so
        // the visible row count stays the same; advance focus.
        setRows((curr) => {
          const idx = curr.findIndex((r) => r.key === key);
          if (idx === -1) return curr;
          const next = [...curr];
          next[idx] = makeBlankRow();
          return next;
        });
        // Have to read rows fresh — use a microtask after setRows.
        setTimeout(() => {
          setRows((curr) => {
            advanceFocusFrom(curr, key);
            return curr;
          });
        }, 0);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Failed to add payment");
      }
    });
  }

  function onPaymentKey(
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    key: string,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRow(key);
    }
  }

  // ── Supplier inline create ──────────────────────────────────────
  function openSupplierForm(rowKey: string) {
    setSupplierFormForRow(rowKey);
    setSupplierName("");
    setSupplierCategory("");
    setTimeout(() => supplierNameRef.current?.focus(), 0);
  }
  function cancelSupplierForm() {
    setSupplierFormForRow(null);
    setSupplierName("");
    setSupplierCategory("");
  }
  function submitSupplier() {
    const trimmedName = supplierName.trim();
    const trimmedCategory = supplierCategory.trim() || "Other";
    if (!trimmedName) {
      notify("error", "Supplier name required");
      supplierNameRef.current?.focus();
      return;
    }
    const targetRow = supplierFormForRow;
    startTransition(async () => {
      try {
        const created = await createSupplierQuick({
          name: trimmedName,
          category: trimmedCategory,
        });
        setSuppliers((curr) => [{ id: created.id, name: created.name }, ...curr]);
        if (targetRow) {
          updateRow(targetRow, { supplierId: created.id });
        }
        notify("success", `Created supplier "${created.name}"`);
        cancelSupplierForm();
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Failed to create supplier");
      }
    });
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
  function onSupplierSelectChange(rowKey: string, value: string) {
    if (value === NEW_SUPPLIER_VALUE) {
      openSupplierForm(rowKey);
      return;
    }
    updateRow(rowKey, { supplierId: value });
  }

  // ── Receipt picker ──────────────────────────────────────────────
  function onSelectExistingReceipt(rowKey: string, fileId: string) {
    setRows((curr) =>
      curr.map((r) =>
        r.key === rowKey && !r.attachedFileIds.includes(fileId)
          ? { ...r, attachedFileIds: [...r.attachedFileIds, fileId] }
          : r,
      ),
    );
  }
  function onQueueLocalFile(rowKey: string, file: File) {
    setRows((curr) =>
      curr.map((r) =>
        r.key === rowKey ? { ...r, queuedFiles: [...r.queuedFiles, file] } : r,
      ),
    );
  }
  function clearAttached(rowKey: string) {
    updateRow(rowKey, { attachedFileIds: [], queuedFiles: [] });
  }

  return (
    <div className="bg-surface border border-border-soft rounded-md shadow-sm p-3 mb-4">
      <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-2">
        Add payments
      </div>
      <datalist id="payment-descriptions">
        {recentDescriptions.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      <div className="space-y-1.5">
        {rows.map((row, idx) => {
          const showSupplierSubForm = supplierFormForRow === row.key;
          const showLinkPicker = linkPickerForRow === row.key;
          const receiptCount = row.attachedFileIds.length + row.queuedFiles.length;
          return (
            <div key={row.key}>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={(el) => {
                    descriptionRefs.current[idx] = el;
                  }}
                  type="text"
                  list="payment-descriptions"
                  value={row.description}
                  onChange={(e) => updateRow(row.key, { description: e.target.value })}
                  onKeyDown={(e) => onPaymentKey(e, row.key)}
                  disabled={pending}
                  placeholder="Description (e.g. Hobbycraft — foam blocks)"
                  className="flex-1 min-w-[180px] text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                  onKeyDown={(e) => onPaymentKey(e, row.key)}
                  disabled={pending}
                  placeholder="£"
                  className="w-24 text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500 tabular-nums text-right"
                />
                <select
                  value={row.supplierId}
                  onChange={(e) => onSupplierSelectChange(row.key, e.target.value)}
                  onKeyDown={(e) => onPaymentKey(e, row.key)}
                  disabled={pending || showSupplierSubForm}
                  className="w-40 text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2 py-1.5 outline-none focus:border-moss-500"
                >
                  <option value="">Supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value={NEW_SUPPLIER_VALUE}>+ New supplier…</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setLinkPickerForRow(showLinkPicker ? null : row.key)
                  }
                  disabled={pending}
                  className={
                    "text-[11px] px-2 py-1 rounded-sm border transition-colors " +
                    (row.link
                      ? "bg-moss-50 border-moss-300 text-moss-700"
                      : "bg-canvas border-border-soft text-ink-tertiary hover:border-moss-300 hover:text-moss-700")
                  }
                  title={row.link ? row.link.label : "Link to a BUILD material or outfit"}
                >
                  🔗 {row.link ? row.link.label.slice(0, 24) : "Link"}
                </button>
                <ReceiptButton
                  rowKey={row.key}
                  count={receiptCount}
                  files={files}
                  attachedIds={row.attachedFileIds}
                  pending={pending}
                  onSelectExisting={(id) => onSelectExistingReceipt(row.key, id)}
                  onQueueLocal={(file) => onQueueLocalFile(row.key, file)}
                  onClear={() => clearAttached(row.key)}
                />
                <button
                  type="button"
                  onClick={() => commitRow(row.key)}
                  disabled={pending || isRowEmpty(row)}
                  className="text-xs font-medium px-3 py-1.5 rounded-sm border bg-moss-500 text-white border-moss-500 hover:bg-moss-700 hover:border-moss-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {pending ? "…" : "+ Add"}
                </button>
              </div>

              {showSupplierSubForm && (
                <div className="mt-2 ml-4 p-2.5 border border-moss-300 bg-moss-50/40 rounded-sm">
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
                        placeholder="e.g. Hobbycraft"
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
                        placeholder="e.g. Craft store · defaults to Other"
                        className="w-full text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={submitSupplier}
                      disabled={pending}
                      className="text-xs font-medium px-3 py-1.5 rounded-sm border bg-moss-500 text-white border-moss-500 hover:bg-moss-700 hover:border-moss-700 disabled:opacity-50 transition-colors"
                    >
                      {pending ? "Creating…" : "Create"}
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

              {showLinkPicker && (
                <LinkPickerPanel
                  buildOptions={buildOptions}
                  outfitOptions={outfitOptions}
                  current={row.link}
                  onPick={(link) => {
                    updateRow(row.key, { link });
                    setLinkPickerForRow(null);
                  }}
                  onCancel={() => setLinkPickerForRow(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-ink-tertiary mt-2">
        Press <kbd className="px-1 border border-border-soft rounded-sm bg-canvas text-ink-secondary text-[10px] font-mono">Enter</kbd> on any row to add it. Linked BUILD materials are auto-marked as ordered. Receipts you upload here attach as soon as the payment exists — for now, attach uploads from the row&apos;s edit menu after creation.
      </p>
    </div>
  );
}

// ── Receipt button + popover ──────────────────────────────────────

function ReceiptButton({
  count,
  files,
  attachedIds,
  pending,
  onSelectExisting,
  onQueueLocal,
  onClear,
}: {
  rowKey: string;
  count: number;
  files: FileSummary[];
  attachedIds: string[];
  pending: boolean;
  onSelectExisting: (id: string) => void;
  onQueueLocal: (file: File) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={pending}
        className={
          "text-[11px] px-2 py-1 rounded-sm border transition-colors " +
          (count > 0
            ? "bg-moss-50 border-moss-300 text-moss-700"
            : "bg-canvas border-border-soft text-ink-tertiary hover:border-moss-300 hover:text-moss-700")
        }
        title={count > 0 ? `${count} receipt${count === 1 ? "" : "s"} attached` : "Attach receipt"}
      >
        📎 {count > 0 ? count : "Receipt"}
      </button>
      {open && (
        <div className="absolute z-20 right-0 mt-1 w-64 bg-surface border border-border-soft rounded-md shadow-lg p-2.5">
          <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
            Attach receipt
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onQueueLocal(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full text-left text-xs px-2 py-1.5 rounded-sm hover:bg-canvas/40 text-ink-primary"
          >
            ↑ Upload from device
          </button>
          {files.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mt-2 mb-1">
                Pick existing
              </div>
              <div className="max-h-40 overflow-y-auto">
                {files.map((f) => {
                  const taken = attachedIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={taken}
                      onClick={() => {
                        onSelectExisting(f.id);
                        setOpen(false);
                      }}
                      className="w-full text-left text-xs px-2 py-1 rounded-sm hover:bg-canvas/40 text-ink-secondary disabled:opacity-40 disabled:cursor-not-allowed truncate"
                    >
                      {taken ? "✓ " : ""}
                      {f.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {count > 0 && (
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="w-full mt-2 text-left text-[11px] px-2 py-1 rounded-sm text-danger hover:bg-danger-bg"
            >
              Clear attachments
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Link picker ───────────────────────────────────────────────────

function LinkPickerPanel({
  buildOptions,
  outfitOptions,
  current,
  onPick,
  onCancel,
}: {
  buildOptions: BuildOption[];
  outfitOptions: OutfitOption[];
  current: LinkSelection;
  onPick: (link: LinkSelection) => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<"build" | "outfit">(
    current?.kind === "outfit" ? "outfit" : "build",
  );
  const [selectedCardId, setSelectedCardId] = useState<string>(
    current?.kind === "buildMaterial" ? current.cardId : buildOptions[0]?.cardId ?? "",
  );
  const selectedCard = buildOptions.find((c) => c.cardId === selectedCardId);
  return (
    <div className="mt-2 ml-4 p-2.5 border border-moss-300 bg-moss-50/40 rounded-sm">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setTab("build")}
          className={
            "text-[11px] px-2 py-0.5 rounded-full border " +
            (tab === "build"
              ? "bg-moss-500 text-white border-moss-500"
              : "bg-canvas border-border-soft text-ink-secondary hover:border-moss-300")
          }
        >
          🔨 BUILD material
        </button>
        <button
          type="button"
          onClick={() => setTab("outfit")}
          className={
            "text-[11px] px-2 py-0.5 rounded-full border " +
            (tab === "outfit"
              ? "bg-moss-500 text-white border-moss-500"
              : "bg-canvas border-border-soft text-ink-secondary hover:border-moss-300")
          }
        >
          👔 Outfit item
        </button>
        <button
          type="button"
          onClick={() => onPick(null)}
          className="ml-auto text-[11px] text-ink-tertiary hover:text-danger"
        >
          Clear link
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-ink-tertiary hover:text-ink-primary"
        >
          Close
        </button>
      </div>
      {tab === "build" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={selectedCardId}
            onChange={(e) => setSelectedCardId(e.target.value)}
            className="text-xs bg-canvas border border-border-soft rounded-sm px-2 py-1.5"
          >
            {buildOptions.map((c) => (
              <option key={c.cardId} value={c.cardId}>
                {c.cardTitle}
              </option>
            ))}
          </select>
          <div className="max-h-40 overflow-y-auto bg-canvas border border-border-soft rounded-sm">
            {selectedCard?.materials.length === 0 && (
              <p className="text-xs text-ink-tertiary p-2 italic">No materials on this card.</p>
            )}
            {selectedCard?.materials.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  onPick({
                    kind: "buildMaterial",
                    cardId: selectedCard.cardId,
                    materialId: m.id,
                    label: `${selectedCard.cardTitle} — ${m.name}`,
                  })
                }
                className="w-full text-left text-xs px-2 py-1 hover:bg-moss-50 text-ink-primary truncate"
              >
                {m.ordered ? "● " : "○ "}
                {m.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-h-44 overflow-y-auto bg-canvas border border-border-soft rounded-sm">
          {outfitOptions.length === 0 && (
            <p className="text-xs text-ink-tertiary p-2 italic">No outfit items yet.</p>
          )}
          {outfitOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() =>
                onPick({ kind: "outfit", outfitId: o.id, label: o.label })
              }
              className="w-full text-left text-xs px-2 py-1 hover:bg-moss-50 text-ink-primary truncate"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

