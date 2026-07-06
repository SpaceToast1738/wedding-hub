"use client";

import React, { useRef, useState, useTransition } from "react";
import { Hammer, Paperclip, Shirt } from "lucide-react";
import { createPayment, uploadAndAttachReceipt } from "./actions";
import { createSupplierQuick } from "@/app/(app)/suppliers/actions";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/Button";

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

// v1.89.2: + `folder` so the existing-file picker can show where each
// file lives (Payment receipts / Catering / etc.). Matches PaymentRow's
// shape so the same data flows through both surfaces.
type FileSummary = { id: string; name: string; mimeType: string; folder: string | null };

type LinkSelection =
  | { kind: "buildMaterial"; cardId: string; materialId: string; label: string }
  | { kind: "outfit"; outfitId: string; label: string }
  | null;

// v1.79.0: budget categories + their lines for the per-row picker.
// Payments linked here roll into the line's `actual` via the B2
// contract on /budget.
// v1.80.0: + components per line — payments can target a specific
// sub-cost (e.g. "Meals" inside the Venue line).
export type BudgetCategoryWithLines = {
  id: string;
  name: string;
  lines: {
    id: string;
    description: string;
    components: { id: string; label: string }[];
  }[];
};

export function InlinePaymentGrid({
  suppliers: initialSuppliers,
  recentDescriptions,
  buildOptions,
  outfitOptions,
  files: initialFiles,
  budgetCategories,
}: {
  suppliers: Supplier[];
  recentDescriptions: string[];
  buildOptions: BuildOption[];
  outfitOptions: OutfitOption[];
  files: FileSummary[];
  budgetCategories: BudgetCategoryWithLines[];
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
  // v1.79.0: budget link on the row. v1.80.0: prefix-encoded — value
  // is "line:<lineId>" or "comp:<componentId>" so a single <select>
  // can offer both line-level and component-level targets.
  const [budgetTarget, setBudgetTarget] = useState<string>("");
  // v1.86.0: fund picker. Empty string = inherit (payment falls
  // through to the linked line / component's fund silently). Non-
  // empty values are FundSource enum strings; "OTHER" enables the
  // free-text label input.
  const [fundSource, setFundSource] = useState<string>("");
  const [fundLabel, setFundLabel] = useState<string>("");
  // v2.6.0 (design pass finding 9): supplier/budget-link/fund/link/
  // receipt all have sensible defaults (none set = inherit / no link),
  // so they're collapsed behind this expander — description, amount,
  // and Add stay the always-visible fast path. Auto-opens if any of
  // those fields already carry a value so the user doesn't lose sight
  // of an active selection.
  const [showMore, setShowMore] = useState(false);

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
    setBudgetTarget("");
    setFundSource("");
    setFundLabel("");
    setShowMore(false);
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
        // v1.80.0: budgetTarget is prefix-encoded; split into the
        // appropriate FormData field.
        if (budgetTarget.startsWith("line:")) {
          fd.set("budgetLineId", budgetTarget.slice(5));
        } else if (budgetTarget.startsWith("comp:")) {
          fd.set("budgetLineComponentId", budgetTarget.slice(5));
        }
        if (link?.kind === "buildMaterial") {
          fd.set("bookBuildMaterialId", link.materialId);
        }
        if (link?.kind === "outfit") {
          fd.set("bookOutfitId", link.outfitId);
        }
        // v1.86.0: fund. Empty source ⇒ inherit silently.
        if (fundSource) {
          fd.set("fundSource", fundSource);
          if (fundSource === "OTHER" && fundLabel.trim()) {
            fd.set("fundLabel", fundLabel.trim());
          }
        }
        for (const fid of attachedFileIds) fd.append("fileIds", fid);
        // v1.89.0: createPayment now returns the new payment's id so
        // we can chain receipt uploads onto it. Pre-fix queued local
        // files were dropped on the floor with a warn toast.
        const created = await createPayment(fd);
        let uploadFailures = 0;
        if (queuedFiles.length > 0 && created?.id) {
          // Upload sequentially so a 400 on file 3 doesn't block 4+5
          // and gives us a precise error count.
          for (const file of queuedFiles) {
            const upFd = new FormData();
            upFd.set("file", file);
            const res = await uploadAndAttachReceipt(created.id, upFd);
            if (!res.ok) {
              uploadFailures += 1;
              notify("error", `Receipt "${file.name}": ${res.error}`);
            }
          }
        }
        if (uploadFailures > 0) {
          notify(
            "warn",
            `Payment added, but ${uploadFailures} receipt${uploadFailures === 1 ? "" : "s"} failed to upload (see errors above).`,
          );
        } else {
          const receiptNote =
            queuedFiles.length > 0
              ? ` with ${queuedFiles.length} receipt${queuedFiles.length === 1 ? "" : "s"}`
              : "";
          notify("success", `Added "${trimmedDesc}"${receiptNote}`);
        }
        reset();
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Failed to add payment");
      }
    });
  }

  function onPaymentKey(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
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
  // v1.89.0: accepts one OR many files (the file input is `multiple`
  // and the user can pick a whole batch in one go). Append to the
  // existing queue so the user can repeat the picker for more files.
  function queueLocalFiles(picked: File[]) {
    setQueuedFiles((curr) => [...curr, ...picked]);
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
  // v2.6.0 (design pass finding 9): auto-reveal the "more details" tier
  // whenever any of its fields already carry a value, so the expander
  // never hides an active selection from view.
  const hasMoreDetails =
    !!supplierName.trim() || !!budgetTarget || !!fundSource || !!link || receiptCount > 0;
  const detailsOpen = showMore || hasMoreDetails;

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
          aria-label="Payment description"
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
          aria-label="Amount in pounds"
          className="w-24 text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500 tabular-nums text-right"
        />
        <Button type="button" variant="primary" size="sm" onClick={commit} disabled={pending || isEmpty}>
          {pending ? "…" : "+ Add"}
        </Button>
      </div>

      {/* v2.6.0 (design pass finding 9): supplier/budget-link/fund/link/
          receipt all default to "none" / "inherit", so they're
          collapsed behind this expander — description, amount, and Add
          above stay the always-visible fast path. Auto-opens (see
          `detailsOpen`) whenever one of these fields already carries a
          value so an active selection is never hidden. */}
      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-xs text-info hover:underline mt-2"
        aria-expanded={detailsOpen}
      >
        {detailsOpen ? "− Hide details" : "+ More details (supplier, budget link, fund, attachments)"}
      </button>

      {detailsOpen && (
      <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-border-soft">
        <input
          type="text"
          list="payment-suppliers"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          onKeyDown={onPaymentKey}
          disabled={pending}
          placeholder="Supplier (type or pick)"
          aria-label="Supplier name"
          className="w-44 text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
        />
        {/* v1.79.0: budget line picker. Lines listed under their
            category. Without this, every payment lands as a budget
            orphan — `/budget` shows £0 even when payments sum to
            thousands. */}
        <select
          value={budgetTarget}
          onChange={(e) => setBudgetTarget(e.target.value)}
          onKeyDown={onPaymentKey}
          disabled={pending || budgetCategories.length === 0}
          aria-label="Link to a budget line or component"
          className={
            "w-44 text-sm bg-canvas text-ink-primary border rounded-sm px-2 py-1.5 outline-none focus:border-moss-500 " +
            (budgetTarget ? "border-moss-300" : "border-border-soft")
          }
          title={
            budgetCategories.length === 0
              ? "Add a budget category on /budget first"
              : "Roll this payment into a budget line or one of its components"
          }
        >
          <option value="">Budget link (none)</option>
          {budgetCategories.map((c) =>
            c.lines.length === 0 ? null : (
              <optgroup key={c.id} label={c.name}>
                {c.lines.map((l) => (
                  // v1.80.0: line option, then its components nested as
                  // sibling options prefixed with " · " for visual nesting.
                  // optgroup nesting isn't supported by the platform.
                  <React.Fragment key={l.id}>
                    <option value={`line:${l.id}`}>
                      {l.components.length > 0
                        ? `${l.description} (whole line)`
                        : l.description}
                    </option>
                    {l.components.map((cmp) => (
                      <option key={cmp.id} value={`comp:${cmp.id}`}>
                        {"  · "}
                        {cmp.label}
                      </option>
                    ))}
                  </React.Fragment>
                ))}
              </optgroup>
            ),
          )}
        </select>
        {/* v1.86.0: fund select. Empty = inherit (default).
            Picking OTHER reveals an inline free-text label input. */}
        <select
          value={fundSource}
          onChange={(e) => setFundSource(e.target.value)}
          onKeyDown={onPaymentKey}
          disabled={pending}
          aria-label="Funding source"
          title="Funding source — leave on Inherit to follow the linked budget line's fund"
          className={
            "w-32 text-sm bg-canvas text-ink-primary border rounded-sm px-2 py-1.5 outline-none focus:border-moss-500 " +
            (fundSource ? "border-moss-300" : "border-border-soft")
          }
        >
          <option value="">📁 Fund (inherit)</option>
          <option value="JOINT">Joint</option>
          <option value="PERSONAL_BRIDE">Bride</option>
          <option value="PERSONAL_GROOM">Groom</option>
          <option value="OTHER">Other…</option>
        </select>
        {fundSource === "OTHER" && (
          <input
            type="text"
            value={fundLabel}
            onChange={(e) => setFundLabel(e.target.value)}
            onKeyDown={onPaymentKey}
            disabled={pending}
            placeholder="e.g. Bryony's parents"
            aria-label="Custom fund label"
            className="w-40 text-sm bg-canvas text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
          />
        )}
        <button
          type="button"
          onClick={() => setShowLinkPicker(!showLinkPicker)}
          disabled={pending}
          aria-label={link ? `Linked to ${link.label}` : "Link to a BUILD material or outfit item"}
          className={
            "text-[11px] px-2 py-2 sm:py-1 min-h-[40px] sm:min-h-0 rounded-sm border transition-colors " +
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
          onQueueLocal={queueLocalFiles}
          onClear={clearAttached}
        />
      </div>
      )}

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

      {/* v2.6.0 (design pass finding 8): promoted from text-[10px]/
          ink-tertiary — this is a real functional hint (how to submit
          the form), not decoration. */}
      <p className="text-xs text-ink-secondary mt-2">
        Press <kbd className="px-1 border border-border-soft rounded-sm bg-canvas text-ink-secondary text-[10px] font-mono">Enter</kbd> to add. Suppliers you type that don&apos;t already exist are auto-created. Linked BUILD materials are auto-marked as ordered. Queued receipts upload + attach automatically once the payment is created.
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
  // v1.89.0: signature takes an array — the underlying input has
  // `multiple`, so the user can attach a whole batch in one click.
  onQueueLocal: (files: File[]) => void;
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
          "text-[11px] px-2 py-1 rounded-sm border transition-colors inline-flex items-center gap-1 " +
          (count > 0
            ? "bg-moss-50 border-moss-300 text-moss-700"
            : "bg-canvas border-border-soft text-ink-tertiary hover:border-moss-300 hover:text-moss-700")
        }
        title={count > 0 ? `${count} receipt${count === 1 ? "" : "s"} attached` : "Attach receipt"}
      >
        <Paperclip aria-hidden className="w-3 h-3" />
        {count > 0 ? count : "Receipt"}
      </button>
      {open && (
        <div className="absolute z-20 right-0 mt-1 w-64 bg-surface border border-border-soft rounded-md shadow-lg p-2.5">
          <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
            Attach receipt
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length > 0) onQueueLocal(picked);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full text-left text-xs px-2 py-1.5 rounded-sm hover:bg-canvas/40 text-ink-primary"
          >
            ↑ Upload from device (one or many)
          </button>
          {files.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mt-2 mb-1">
                Pick existing
              </div>
              <div className="max-h-40 overflow-y-auto">
                {/* v1.89.2: group by folder so the picker is scannable
                    when many files exist across multiple folders. */}
                {(() => {
                  const groups = new Map<string, FileSummary[]>();
                  for (const f of files) {
                    const key = f.folder ?? "Uncategorised";
                    const list = groups.get(key);
                    if (list) list.push(f);
                    else groups.set(key, [f]);
                  }
                  return Array.from(groups.entries()).map(([folder, list]) => (
                    <div key={folder}>
                      <div className="text-[9px] font-bold text-ink-tertiary uppercase tracking-wider px-2 pt-1 pb-0.5 bg-canvas/40 sticky top-0">
                        {folder}
                      </div>
                      {list.map((f) => {
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
                            title={`${folder} / ${f.name}`}
                          >
                            {taken ? "✓ " : ""}
                            {f.name}
                          </button>
                        );
                      })}
                    </div>
                  ));
                })()}
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
            "text-[11px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 " +
            (tab === "build"
              ? "bg-moss-500 text-on-moss border-moss-500"
              : "bg-canvas border-border-soft text-ink-secondary hover:border-moss-300")
          }
        >
          <Hammer aria-hidden className="w-3 h-3" />
          BUILD material
        </button>
        <button
          type="button"
          onClick={() => setTab("outfit")}
          className={
            "text-[11px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 " +
            (tab === "outfit"
              ? "bg-moss-500 text-on-moss border-moss-500"
              : "bg-canvas border-border-soft text-ink-secondary hover:border-moss-300")
          }
        >
          <Shirt aria-hidden className="w-3 h-3" />
          Outfit item
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
