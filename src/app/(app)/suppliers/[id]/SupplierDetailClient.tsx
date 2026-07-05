"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupplierStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { Input } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import { AddNewModal } from "@/components/ui/AddNewModal";
import {
  createSupplierContact,
  createSupplierCommunication,
  createSupplierContract,
  deleteSupplierContact,
  deleteSupplierCommunication,
  deleteSupplierContract,
  setSupplierContractFile,
  setSupplierStatus,
  updateSupplier,
} from "../actions";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/notify";
import { STATUS_TO_PILL, STATUS_OPTIONS } from "../SupplierCard";
import { SupplierForm } from "../SupplierForm";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  primary: boolean;
};

type Contract = {
  id: string;
  signed: boolean;
  signedAt: Date | null;
  amount: number | null;
  notes: string | null;
  /** v2.4.3: the uploaded contract document, when attached. */
  file: { id: string; name: string } | null;
};

/** v2.4.3: files an editor can attach to a contract (visibility-
 *  filtered server-side). Downloads go through /api/files/[id], which
 *  re-gates session + canView("files"). */
type AttachableFile = { id: string; name: string; folder: string | null };

type Communication = {
  id: string;
  channel: string;
  summary: string;
  followUpAt: Date | null;
  createdAt: Date;
};

const CHANNEL_ICON: Record<string, string> = {
  email: "✉",
  call: "☎",
  meeting: "🤝",
  message: "💬",
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatRelativeDate(d: Date): string {
  const now = Date.now();
  const diffMs = now - new Date(d).getTime();
  const days = Math.round(diffMs / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatGBP(amount: number | null): string {
  if (amount === null) return "—";
  return `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SupplierDetailClient({
  supplierId,
  canEdit,
  showMoney,
  contacts,
  contracts,
  communications,
  attachableFiles = [],
}: {
  supplierId: string;
  canEdit: boolean;
  /** v1.76.0: gates contract-amount display + the contract-add form. */
  showMoney: boolean;
  contacts: Contact[];
  contracts: Contract[];
  communications: Communication[];
  attachableFiles?: AttachableFile[];
}) {
  return (
    <>
      <ContactsSection supplierId={supplierId} canEdit={canEdit} contacts={contacts} />
      {/* v2.5.1 (mod #8): always render Contracts now — showMoney only
          hides the amount, not the whole section (see ContractsSection
          below). Non-money users could previously neither see whether
          a contract was signed nor attach one at all. */}
      <ContractsSection
        supplierId={supplierId}
        canEdit={canEdit}
        showMoney={showMoney}
        contracts={contracts}
        attachableFiles={attachableFiles}
      />
      <CommunicationsSection supplierId={supplierId} canEdit={canEdit} log={communications} />
    </>
  );
}

// ── Header bar (status + edit) ──────────────────────────────────────────
//
// v2.5.1 (mod #3, #4): previously the detail page was read-only for
// the supplier itself — the status shown twice (once as a StatusPill,
// once as a duplicate plain-text word below it), no way to change
// status, no way to edit name/category/website/notes/amount without
// going back to the list and using the card's inline edit form. This
// reuses that same SupplierForm + AddNewModal combo so there's exactly
// one edit UI for a supplier, not two.
//
// Rendered by [id]/page.tsx inside the existing "Status + headline
// numbers" section, in place of the old static status/website row.
export function SupplierHeaderBar({
  supplierId,
  canEdit,
  showMoney,
  status,
  name,
  category,
  website,
  notes,
  amountAgreed,
}: {
  supplierId: string;
  canEdit: boolean;
  showMoney: boolean;
  status: SupplierStatus;
  name: string;
  category: string;
  website: string | null;
  notes: string | null;
  /** Stringified Decimal (or null) — same shape SupplierForm expects. */
  amountAgreed: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function changeStatus(next: SupplierStatus) {
    startTransition(async () => {
      await setSupplierStatus(supplierId, next);
      // setSupplierStatus only revalidates the /suppliers list path,
      // not this dynamic detail route — router.refresh() forces this
      // page's server data to refetch regardless (same pattern as
      // BookOutfitCard / BookBuildCard's post-action refreshes).
      router.refresh();
      notify("success", `Status set to ${next.charAt(0) + next.slice(1).toLowerCase()}`);
    });
  }

  return (
    <div className="px-4 py-3 border-b border-border-soft flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        {/* Single pill carries the label now — no more separately-
            rendered duplicate status word underneath it. */}
        <StatusPill status={STATUS_TO_PILL[status] ?? "LEAD"} label={status.toLowerCase()} />
        {canEdit && (
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value as SupplierStatus)}
            disabled={pending}
            aria-label="Change supplier status"
            className="text-xs bg-canvas border border-border-soft rounded-sm px-1.5 py-0.5 text-ink-secondary outline-none min-h-[40px] sm:min-h-0"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-3">
        {website && (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-info hover:underline truncate max-w-[220px]"
          >
            {website}
          </a>
        )}
        {canEdit && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      <AddNewModal open={editing} onClose={() => setEditing(false)} title={`Edit ${name}`} width="md">
        <SupplierForm
          submitLabel="Save"
          showMoney={showMoney}
          initial={{
            name,
            category,
            status,
            website: website ?? "",
            notes: notes ?? "",
            amountAgreed: amountAgreed ?? "",
          }}
          onSubmit={async (fd) => {
            await updateSupplier(supplierId, fd);
            setEditing(false);
            router.refresh();
            notify("success", "Supplier updated");
          }}
          onCancel={() => setEditing(false)}
        />
      </AddNewModal>
    </div>
  );
}

// ── Contacts ────────────────────────────────────────────────────────────

function ContactsSection({
  supplierId,
  canEdit,
  contacts,
}: {
  supplierId: string;
  canEdit: boolean;
  contacts: Contact[];
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function onDelete(id: string, name: string) {
    if (!(await confirm({ title: `Delete contact ${name}?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      await deleteSupplierContact(id, supplierId);
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-primary">
          Contacts
          <span className="ml-2 text-[11px] font-normal text-ink-tertiary">{contacts.length}</span>
        </h2>
        {canEdit && !adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            + Contact
          </Button>
        )}
      </header>
      {adding && (
        <ContactForm
          supplierId={supplierId}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      )}
      {contacts.length === 0 ? (
        <p className="px-4 py-4 text-sm text-ink-tertiary italic">No contacts yet.</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {contacts.map((c) => (
            <li key={c.id} className="px-4 py-3 flex items-start gap-3 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-medium text-ink-primary">{c.name}</span>
                  {c.primary && (
                    <span className="text-[10px] text-moss-700 bg-moss-50 border border-moss-100 px-1 rounded">
                      Primary
                    </span>
                  )}
                  {c.role && (
                    <span className="text-[11px] text-ink-tertiary">{c.role}</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="text-info hover:underline">
                      ✉ {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="text-info hover:underline tabular-nums">
                      ☎ {c.phone}
                    </a>
                  )}
                </div>
              </div>
              {canEdit && (
                // v2.5.1 (mod #2): was hover-only with no touch
                // fallback — a phone user could never reveal, let
                // alone reach, this control. Mobile keeps it always
                // visible; sm+ reverts to hover/focus-reveal. A real
                // aria-label names the specific contact being deleted
                // instead of a bare "×".
                <button
                  type="button"
                  onClick={() => onDelete(c.id, c.name)}
                  disabled={pending}
                  aria-label={`Delete contact ${c.name}`}
                  title="Delete contact"
                  className="text-sm text-ink-tertiary hover:text-danger min-h-[40px] min-w-[40px] -my-2.5 -mr-2 flex items-center justify-center flex-shrink-0 rounded-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactForm({
  supplierId,
  onDone,
  onCancel,
}: {
  supplierId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd) => {
        fd.set("supplierId", supplierId);
        startTransition(async () => {
          await createSupplierContact(fd);
          onDone();
        });
      }}
      className="px-4 py-3 bg-moss-50/40 border-b border-border-soft space-y-2.5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Name</label>
          <Input name="name" required placeholder="e.g. Louis Brough" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Role</label>
          <Input name="role" placeholder="e.g. Lead photographer" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Email</label>
          <Input name="email" type="email" placeholder="optional" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Phone</label>
          <Input name="phone" placeholder="optional" />
        </div>
      </div>
      <label className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
        <input type="checkbox" name="primary" /> Primary contact (used on the day-of page)
      </label>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Add"}
        </Button>
      </div>
    </form>
  );
}

// ── Contracts ────────────────────────────────────────────────────────────

function ContractsSection({
  supplierId,
  canEdit,
  showMoney,
  contracts,
  attachableFiles,
}: {
  supplierId: string;
  canEdit: boolean;
  /** v2.5.1 (mod #8): the section itself is always shown now — this
   *  only gates the amount in each row and the add-contract form's
   *  Amount field. */
  showMoney: boolean;
  contracts: Contract[];
  attachableFiles: AttachableFile[];
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function onDelete(id: string) {
    if (!(await confirm({ title: "Delete this contract entry?", confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      await deleteSupplierContract(id, supplierId);
    });
  }

  // v2.5.1 (mod #2): builds the aria-label for a contract's delete
  // button. Contracts have no name field to point at, so this
  // describes it by amount + signed date instead — but only includes
  // the amount when the caller can see money, so the label itself
  // doesn't leak a figure the UI is otherwise hiding.
  function contractDeleteLabel(c: Contract): string {
    const parts: string[] = [];
    if (showMoney && c.amount != null) parts.push(formatGBP(c.amount));
    if (c.signedAt) parts.push(`signed ${formatDate(c.signedAt)}`);
    return parts.length > 0 ? `Delete contract (${parts.join(", ")})` : "Delete this contract entry";
  }

  function onSetFile(contractId: string, fileId: string | null) {
    startTransition(async () => {
      const res = await setSupplierContractFile(contractId, fileId);
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-primary">
          Contracts
          <span className="ml-2 text-[11px] font-normal text-ink-tertiary">{contracts.length}</span>
        </h2>
        {canEdit && !adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            + Contract
          </Button>
        )}
      </header>
      {adding && (
        <form
          action={(fd) => {
            fd.set("supplierId", supplierId);
            startTransition(async () => {
              await createSupplierContract(fd);
              setAdding(false);
            });
          }}
          className="px-4 py-3 bg-moss-50/40 border-b border-border-soft space-y-2.5"
        >
          <div className={showMoney ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5" : ""}>
            {/* v2.5.1 (mod #8): Amount is omitted for non-money editors
                rather than shown — the create action already treats a
                missing amount as null, so a contract can be logged
                (signed/date/notes/file) without disclosing the price. */}
            {showMoney && (
              <div>
                <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                  Amount
                </label>
                <Input name="amount" placeholder="e.g. 2500.00" />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Signed on
              </label>
              <Input name="signedAt" type="date" />
            </div>
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
            <input type="checkbox" name="signed" defaultChecked /> Marked as signed
          </label>
          {attachableFiles.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Contract file
              </label>
              <select
                name="fileId"
                defaultValue=""
                className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1.5 outline-none focus:border-moss-500"
              >
                <option value="">— none (upload on Files first) —</option>
                {attachableFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.folder ? `${f.folder} / ` : ""}
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Notes
            </label>
            <MentionableTextarea
              name="notes"
              rows={2}
              placeholder="Coverage, deliverables, conditions…"
              className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Add"}
            </Button>
          </div>
        </form>
      )}
      {contracts.length === 0 ? (
        <p className="px-4 py-4 text-sm text-ink-tertiary italic">No contracts logged.</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {contracts.map((c) => (
            <li key={c.id} className="px-4 py-3 flex items-start gap-3 group">
              <span
                className={[
                  "text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5",
                  c.signed
                    ? "text-moss-700 bg-moss-50 border border-moss-100"
                    : "text-marigold-700 bg-marigold-100",
                ].join(" ")}
              >
                {c.signed ? "Signed" : "Pending"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink-primary tabular-nums">
                  {/* v2.5.1 (mod #8): amount omitted (not the whole
                      row) for non-money users. */}
                  {showMoney ? formatGBP(c.amount) : "Contract"}
                  {c.signedAt && (
                    <span className="text-ink-tertiary text-xs"> · signed {formatDate(c.signedAt)}</span>
                  )}
                </div>
                {c.notes && (
                  <p className="text-xs text-ink-secondary mt-0.5 whitespace-pre-wrap">{c.notes}</p>
                )}
                {/* v2.4.3: the uploaded contract document. Download is
                    re-gated server-side by /api/files/[id]. */}
                {c.file ? (
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <a
                      href={`/api/files/${c.file.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info hover:underline truncate"
                    >
                      📄 {c.file.name}
                    </a>
                    {canEdit && (
                      // v2.5.1 (mod #2): mobile-safe reveal + touch
                      // floor + a real aria-label naming the file.
                      <button
                        type="button"
                        onClick={() => onSetFile(c.id, null)}
                        disabled={pending}
                        aria-label={`Detach file ${c.file.name}`}
                        title="Detach file"
                        className="text-ink-tertiary hover:text-danger min-h-[40px] inline-flex items-center px-2 -my-2.5 rounded-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity"
                      >
                        detach
                      </button>
                    )}
                  </div>
                ) : (
                  canEdit &&
                  attachableFiles.length > 0 && (
                    <select
                      value=""
                      disabled={pending}
                      onChange={(e) => {
                        if (e.target.value) onSetFile(c.id, e.target.value);
                      }}
                      className="mt-1 text-xs bg-surface text-ink-tertiary border border-border-soft rounded-sm px-1.5 py-1 outline-none focus:border-moss-500 max-w-[240px]"
                    >
                      <option value="">📎 Attach file…</option>
                      {attachableFiles.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.folder ? `${f.folder} / ` : ""}
                          {f.name}
                        </option>
                      ))}
                    </select>
                  )
                )}
              </div>
              {canEdit && (
                // v2.5.1 (mod #2): mobile-safe reveal + ~40px hit area
                // + aria-label describing which contract this deletes.
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  disabled={pending}
                  aria-label={contractDeleteLabel(c)}
                  className="text-sm text-ink-tertiary hover:text-danger min-h-[40px] min-w-[40px] -my-2.5 -mr-2 flex items-center justify-center flex-shrink-0 rounded-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Communications ────────────────────────────────────────────────────────

function CommunicationsSection({
  supplierId,
  canEdit,
  log,
}: {
  supplierId: string;
  canEdit: boolean;
  log: Communication[];
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function onDelete(id: string) {
    if (!(await confirm({ title: "Delete this log entry?", confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      await deleteSupplierCommunication(id, supplierId);
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-primary">
          Communications log
          <span className="ml-2 text-[11px] font-normal text-ink-tertiary">{log.length}</span>
        </h2>
        {/* ADHD note: this is the clearest primary action on the whole
            detail page — Contacts/Contracts stay "secondary" so Log
            entry (the thing you do most often) doesn't compete with
            them for attention. */}
        {canEdit && !adding && (
          <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
            + Log entry
          </Button>
        )}
      </header>
      {adding && (
        <form
          action={(fd) => {
            fd.set("supplierId", supplierId);
            // Read before the action call so we can tailor the success
            // toast — createSupplierCommunication saved silently
            // before, with no confirmation the entry (or its
            // auto-created follow-up task) actually landed.
            const followUpAt = fd.get("followUpAt");
            startTransition(async () => {
              await createSupplierCommunication(fd);
              setAdding(false);
              notify(
                "success",
                followUpAt
                  ? `Log entry added — follow-up task created for ${formatDate(new Date(followUpAt as string))}`
                  : "Log entry added",
              );
            });
          }}
          className="px-4 py-3 bg-moss-50/40 border-b border-border-soft space-y-2.5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Channel
              </label>
              <select
                name="channel"
                defaultValue="email"
                className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none"
              >
                <option value="email">Email</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="message">Message</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Follow up by
              </label>
              <Input name="followUpAt" type="date" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Summary
            </label>
            <MentionableTextarea
              name="summary"
              rows={3}
              required
              placeholder="What was discussed / agreed / followed up on…"
              className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Add"}
            </Button>
          </div>
        </form>
      )}
      {log.length === 0 ? (
        <p className="px-4 py-4 text-sm text-ink-tertiary italic">No log entries yet.</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {log.map((c) => (
            <li key={c.id} className="px-4 py-3 flex items-start gap-3 group">
              <span className="w-7 h-7 rounded-full bg-moss-50 text-moss-700 flex items-center justify-center text-sm flex-shrink-0">
                {CHANNEL_ICON[c.channel] ?? "•"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider">
                    {c.channel}
                  </span>
                  {/* v2.5.1 (mod #10): bumped from text-[11px] to
                      text-xs + ink-secondary — this is content people
                      actually read (when the contact happened), not
                      section-label chrome. */}
                  <span className="text-xs text-ink-secondary">
                    {formatRelativeDate(c.createdAt)}
                  </span>
                  {c.followUpAt && (() => {
                    // v2.5.1 (mod #9): danger tint once the follow-up
                    // date has passed — previously an overdue
                    // follow-up looked identical to one due next week.
                    const overdue = new Date(c.followUpAt).getTime() < Date.now();
                    return (
                      <span
                        className={[
                          "text-[10px] px-1 rounded",
                          overdue ? "text-danger bg-danger-bg" : "text-marigold-700 bg-marigold-100",
                        ].join(" ")}
                      >
                        Follow-up {formatDate(c.followUpAt)}
                      </span>
                    );
                  })()}
                  {c.followUpAt && (
                    <Link
                      href={`/tasks`}
                      className="text-[10px] text-info bg-[color:#eef4f5] dark:bg-muted border border-[color:#d0e4e8] dark:border-border-soft px-1 rounded hover:bg-[color:#e0eef0]"
                      title="A task was auto-created for this follow-up — click to open Tasks"
                    >
                      Task ↗
                    </Link>
                  )}
                </div>
                <p className="text-sm text-ink-primary mt-1 whitespace-pre-wrap">{c.summary}</p>
              </div>
              {canEdit && (
                // v2.5.1 (mod #2): mobile-safe reveal + ~40px hit area
                // + aria-label naming the entry being deleted.
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  disabled={pending}
                  aria-label={`Delete ${c.channel} log entry from ${formatRelativeDate(c.createdAt)}`}
                  className="text-sm text-ink-tertiary hover:text-danger min-h-[40px] min-w-[40px] -my-2.5 -mr-2 flex items-center justify-center flex-shrink-0 rounded-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
