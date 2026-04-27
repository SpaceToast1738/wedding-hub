"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createSupplierContact,
  createSupplierCommunication,
  createSupplierContract,
  deleteSupplierContact,
  deleteSupplierCommunication,
  deleteSupplierContract,
} from "../actions";

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
};

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
  contacts,
  contracts,
  communications,
}: {
  supplierId: string;
  canEdit: boolean;
  contacts: Contact[];
  contracts: Contract[];
  communications: Communication[];
}) {
  return (
    <>
      <ContactsSection supplierId={supplierId} canEdit={canEdit} contacts={contacts} />
      <ContractsSection supplierId={supplierId} canEdit={canEdit} contracts={contracts} />
      <CommunicationsSection supplierId={supplierId} canEdit={canEdit} log={communications} />
    </>
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

  function onDelete(id: string, name: string) {
    if (!confirm(`Delete contact ${name}?`)) return;
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
                <button
                  type="button"
                  onClick={() => onDelete(c.id, c.name)}
                  disabled={pending}
                  className="text-xs text-ink-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete contact"
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
  contracts,
}: {
  supplierId: string;
  canEdit: boolean;
  contracts: Contract[];
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete(id: string) {
    if (!confirm("Delete this contract entry?")) return;
    startTransition(async () => {
      await deleteSupplierContract(id, supplierId);
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
                Amount
              </label>
              <Input name="amount" placeholder="e.g. 2500.00" />
            </div>
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
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Notes
            </label>
            <textarea
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
                  {formatGBP(c.amount)}
                  {c.signedAt && (
                    <span className="text-ink-tertiary text-xs"> · signed {formatDate(c.signedAt)}</span>
                  )}
                </div>
                {c.notes && (
                  <p className="text-xs text-ink-secondary mt-0.5 whitespace-pre-wrap">{c.notes}</p>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  disabled={pending}
                  className="text-xs text-ink-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
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

  function onDelete(id: string) {
    if (!confirm("Delete this log entry?")) return;
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
        {canEdit && !adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            + Log entry
          </Button>
        )}
      </header>
      {adding && (
        <form
          action={(fd) => {
            fd.set("supplierId", supplierId);
            startTransition(async () => {
              await createSupplierCommunication(fd);
              setAdding(false);
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
            <textarea
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
                  <span className="text-[11px] text-ink-tertiary">
                    {formatRelativeDate(c.createdAt)}
                  </span>
                  {c.followUpAt && (
                    <span className="text-[10px] text-marigold-700 bg-marigold-100 px-1 rounded">
                      Follow-up {formatDate(c.followUpAt)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-primary mt-1 whitespace-pre-wrap">{c.summary}</p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  disabled={pending}
                  className="text-xs text-ink-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
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
