"use client";

import { useRef, useState, useTransition } from "react";
import { createPayment } from "./actions";
import { createSupplierQuick } from "@/app/(app)/suppliers/actions";
import { notify } from "@/lib/notify";

// v1.75.0 → v1.75.1: single-row inline payment entry. Earlier
// iteration showed 5 blank rows; user feedback ("only really need
// one") collapsed to a single row. Supplier dropdown also became a
// free-text autofill input (previously a `<select>` with a +New
// option). Typing a supplier name that doesn't match an existing one
// auto-creates it on commit (category defaults to "Other").
//
// Description input still uses a `<datalist>` populated from past
// payment descriptions for autofill on retype.
//
// 🔗 Link opens a popover with cascading selects for BUILD card →
// material OR a flat select of outfit items.
//
// 📎 Receipt: "Pick existing" works on commit; "Upload from device"
// queues a File but can't auto-attach (createPayment is a form-action
// returning void) — surfaces a warn toast so the user re-uploads via
// PaymentRow's edit menu.

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
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  // v1.75.1: supplier is a free-text input now. Stores the typed
  // string; we resolve it to an id at commit time (or create a new
  // supplier on the fly if it doesn't match).
  const [supplierName, setSupplierName] = useState("");
  const [link, setLink] = useState<LinkSelection>(null);
  const [attachedFileIds, setAttachedFileIds] = useState<string[]>([]);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  const [pending, startTransition] = useTransition();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [files] = useState<FileSummary[]>(initialFiles);
  const descriptionRef = useRef<HTMLInputElement>(null);

  function reset() {
    setDescription("");
    setAmount("");
    setSupplierName("");
    setLink(null);
    setAttachedFileIds([]);
    setQueuedFiles([]);
    setShowLinkPicker(false);
    setTimeout(() => descriptionRef.current?.focus(), 0);
  }

  // v1.75.1: resolve the typed supplier name to an id. Three paths:
  //   1. empty → null (no supplier link)
  //   2. matches an existing supplier (case-insensitive) → use its id
  //   3. doesn't match → auto-create with category "Other" via
  //      createSupplierQuick, then use the new id
  // Returns the resolved id or null. Throws on create-failure so the
  // caller can show an error.
  async function resolveSupplierId(): Promise<string | null> {
    const trimmed = supplierName.trim();
    if (!trimmed) return null;
    const match = suppliers.find(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) return match.id;
    // Auto-create — same defaults the v1.74.0/.75.0 inline sub-form
    // used: name as typed, category "Other".
    const created = await createSupplierQuick({
      name: trimmed,
      category: "Other",
    });
    setSuppliers((curr) => [{ id: created.id, name: created.name }, ...curr]);
    notify("success", `Created supplier "${created.name}"`);
    return created.id;
  }

  function commit() {
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
    startTransition(async () => {
      try {
        const supplierId = await resolveSupplierId();
        const fd = new FormData();
        fd.set("description", trimmedDesc);
        fd.set("amount", trimmedAmt);
        fd.set("status", "DUE");
        if (supplierId) fd.set("supplierId", supplierId);
        if (link?.kind === "buildMaterial") {
          fd.set("bookBuildMaterialId", link.materialId);
        }
        if (link?.kind === "outfit") {
          fd.set("bookOutfitId", link.outfitId);
        }
        for (const fid of attachedFileIds) fd.append("fileIds", fid);
        await createPayment(fd);
        if (queuedFiles.length > 0) {
          notify(
            "warn",
            `Payment added, but ${queuedFiles.length} pending receipt${queuedFiles.length === 1 ? "" : "s"} couldn't auto-attach. Upload from the row's edit menu.`,
          );
        } else {
          notify("success", `Added "${trimmedDesc}"`);
        }
        reset();
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Failed to add payment");
      }
    });
  }

  function onPaymentKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  function selectExistingReceipt(fileId: string) {
    setAttachedFileIds((curr) =>
      curr.includes(fileId) ? curr : [...curr, fileId],
    );
  }
  function queueLocalFile(file: File) {
    setQueuedFiles((curr) => [...curr, file]);
  }
  function clearAttached() {
    setAttachedFileIds([]);
    setQueuedFiles([]);
  }

  const receiptCount = attachedFileIds.length + queuedFiles.length;
  const isEmpty =
    !description.trim() &&
    !amount.trim() &&
    !supplierName.trim() &&
    !link &&
    receiptCount === 0;

  return (
    <div className="bg-surface border border-border-soft rounded-md shadow-sm p-3 mb-4">
      <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-2">
        Add a payment
      </div>
      <datalist id="payment-descriptions">
        {recentDescriptions.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      <datalist id="payment-suppliers">
        {suppliers.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={descriptionRef}
          type="text"
          list="payment-descriptions"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={onPaymentKey}
          disabled={pending}
          placeholder="Description (e.g. Hobbycraft — foam blocks)"
          className="flex-1 min-w-[180px] text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
        />
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={onPaymentKey}
          disabled={pending}
          placeholder="£"
          className="w-24 text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500 tabular-nums text-right"
        />
        <input
          type="text"
          list="payment-suppliers"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          onKeyDown={onPaymentKey}
          disabled={pending}
          placeholder="Supplier (type or pick)"
          className="w-44 text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
        />
        <button
          type="button"
          onClick={() => setShowLinkPicker(!showLinkPicker)}
          disabled={pending}
          className={
            "text-[11px] px-2 py-1 rounded-sm border transition-colors " +
            (link
              ? "bg-moss-50 border-moss-300 text-moss-700"
              : "bg-canvas border-border-soft text-ink-tertiary hover:border-moss-300 hover:text-moss-700")
          }
          title={link ? link.label : "Link to a BUILD material or outfit"}
        >
          🔗 {link ? link.label.slice(0, 24) : "Link"}
        </button>
        <ReceiptButton
          count={receiptCount}
          files={files}
          attachedIds={attachedFileIds}
          pending={pending}
          onSelectExisting={selectExistingReceipt}
          onQueueLocal={queueLocalFile}
          onClear={clearAttached}
        />
        <button
          type="button"
          onClick={commit}
          disabled={pending || isEmpty}
          className="text-xs font-medium px-3 py-1.5 rounded-sm border bg-moss-500 text-white border-moss-500 hover:bg-moss-700 hover:border-moss-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "…" : "+ Add"}
        </button>
      </div>

      {showLinkPicker && (
        <LinkPickerPanel
          buildOptions={buildOptions}
          outfitOptions={outfitOptions}
          current={link}
          onPick={(picked) => {
            setLink(picked);
            setShowLinkPicker(false);
          }}
          onCancel={() => setShowLinkPicker(false)}
        />
      )}

      <p className="text-[10px] text-ink-tertiary mt-2">
        Press <kbd className="px-1 border border-border-soft rounded-sm bg-canvas text-ink-secondary text-[10px] font-mono">Enter</kbd> to add. Suppliers you type that don&apos;t already exist are auto-created. Linked BUILD materials are auto-marked as ordered. Receipt uploads attach after the payment exists — for now, attach uploads from the row&apos;s edit menu after creation.
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
    <div className="mt-2 p-2.5 border border-moss-300 bg-moss-50/40 rounded-sm">
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
