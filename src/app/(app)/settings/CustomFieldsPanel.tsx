"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { notify } from "@/lib/notify";
import { createCustomField, deleteCustomField } from "./custom-fields-actions";
import { useConfirm } from "@/components/ui/ConfirmDialog";

// C10 (v1.15.0): couple-only Settings panel for defining custom fields
// per entity. v1 supports Guest only; the entity dropdown is fixed
// until we wire other entities (Supplier, Task) in a follow-up.

type FieldDef = {
  id: string;
  entity: string;
  name: string;
  type: "text" | "number" | "date" | "select";
  options: string[];
};

const TYPE_LABELS: Record<FieldDef["type"], string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Choice from a list",
};

export function CustomFieldsPanel({
  fields,
  isCouple,
}: {
  fields: FieldDef[];
  isCouple: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function onDelete(id: string, name: string) {
    if (!(await confirm({
      title: `Delete custom field "${name}"?`,
      body: "Existing values on guests are kept but become invisible. Re-creating with the same name does NOT restore them.",
      confirmLabel: "Delete",
      tone: "danger",
    }))) return;
    startTransition(async () => {
      try {
        await deleteCustomField(id);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't delete field");
      }
    });
  }

  if (!isCouple) {
    // Non-couple users see the section header + read-only list, so
    // they understand what's available — but can't create or delete.
    return (
      <section className="bg-surface border border-border-soft rounded-md p-5 shadow-sm">
        <header className="mb-3">
          <h2 className="text-sm font-semibold text-ink-primary">Custom fields</h2>
          <p className="text-[11px] text-ink-tertiary">
            Couple-only. Defines extra fields per entity.
          </p>
        </header>
        {fields.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">None defined.</p>
        ) : (
          <ul className="text-xs text-ink-secondary space-y-1">
            {fields.map((f) => (
              <li key={f.id}>
                <span className="font-medium">{f.name}</span>
                <span className="text-ink-tertiary ml-1">
                  · {TYPE_LABELS[f.type]} on {f.entity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md p-5 shadow-sm">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink-primary">Custom fields</h2>
          <p className="text-[11px] text-ink-tertiary">
            Add bespoke fields per entity (Guest for now). They appear on the entity&apos;s detail page for editing.
          </p>
        </div>
        {!adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)} disabled={pending}>
            + Add field
          </Button>
        )}
      </header>

      {fields.length === 0 ? (
        <p className="text-xs text-ink-tertiary italic">None defined yet.</p>
      ) : (
        <ul className="divide-y divide-border-soft -mx-1">
          {fields.map((f) => (
            <li key={f.id} className="px-1 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-ink-primary">
                  {f.name}
                  <span className="text-[11px] text-ink-tertiary ml-2">
                    · {TYPE_LABELS[f.type]} on {f.entity}
                  </span>
                </div>
                {f.type === "select" && f.options.length > 0 && (
                  <div className="text-[11px] text-ink-tertiary truncate">
                    Options: {f.options.join(" · ")}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(f.id, f.name)}
                disabled={pending}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <AddFieldForm onDone={() => setAdding(false)} />
      )}
    </section>
  );
}

function AddFieldForm({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState<FieldDef["type"]>("text");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createCustomField(formData);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create field");
      }
    });
  }

  return (
    <form action={submit} className="mt-3 pt-3 border-t border-border-soft space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">Field name</label>
          <Input name="name" required maxLength={80} placeholder="e.g. Hometown" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">Type</label>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as FieldDef["type"])}
            className="w-full text-sm bg-canvas border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="select">Choice from a list</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">Entity</label>
          <select
            name="entity"
            defaultValue="guest"
            className="w-full text-sm bg-canvas border border-border-soft rounded-sm px-2 py-1.5 text-ink-primary outline-none focus:border-moss-500"
          >
            {/* v1.22.0: extended from guest-only (v1.15.0) to also
                cover Supplier and Task. Each entity has its own
                CustomFieldsBlock render surface and its own write
                action with the right permission gate. */}
            <option value="guest">Guest</option>
            <option value="supplier">Supplier</option>
            <option value="task">Task</option>
          </select>
        </div>
      </div>
      {type === "select" && (
        <div>
          <label className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider">Options</label>
          <Input
            name="options"
            placeholder="Comma-separated, e.g. Driving, Train, Flying"
            required
          />
          <p className="text-[10px] text-ink-tertiary mt-0.5">
            Existing rows aren&apos;t migrated when you change options later — keep the list stable once data exists.
          </p>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add field"}
        </Button>
      </div>
    </form>
  );
}
