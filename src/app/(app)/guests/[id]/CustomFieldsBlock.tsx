"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { formatCustomFieldValue, type CustomFieldDef } from "@/lib/custom-fields";
import { setGuestCustomField } from "../actions";

// C10 (v1.15.0): per-guest custom-field block on the guest detail page.
// Renders one row per defined field; click "Edit" to swap into a tiny
// inline form. Validation happens server-side via setGuestCustomField;
// errors surface as toasts.

type Props = {
  guestId: string;
  fields: CustomFieldDef[];
  values: Record<string, string | number | null>;
  canEdit: boolean;
};

export function CustomFieldsBlock({ guestId, fields, values, canEdit }: Props) {
  if (fields.length === 0) return null;

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft">
        <h2 className="text-sm font-semibold text-ink-primary">Custom fields</h2>
        <p className="text-[11px] text-ink-tertiary">
          Defined in Settings · {fields.length} field{fields.length === 1 ? "" : "s"}
        </p>
      </header>
      <ul className="divide-y divide-border-soft">
        {fields.map((f) => (
          <FieldRow
            key={f.id}
            guestId={guestId}
            def={f}
            value={values[f.id] ?? null}
            canEdit={canEdit}
          />
        ))}
      </ul>
    </section>
  );
}

function FieldRow({
  guestId,
  def,
  value,
  canEdit,
}: {
  guestId: string;
  def: CustomFieldDef;
  value: string | number | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<string>(value === null ? "" : String(value));

  function save() {
    const raw = draft.trim() === "" ? null : draft;
    startTransition(async () => {
      try {
        await setGuestCustomField(guestId, def.id, raw);
        setEditing(false);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  function cancel() {
    setDraft(value === null ? "" : String(value));
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="px-4 py-2.5 flex items-center gap-2">
        <span className="w-32 text-xs font-medium text-ink-secondary flex-shrink-0">{def.name}</span>
        <FieldInput def={def} value={draft} onChange={setDraft} disabled={pending} onEnter={save} />
        <Button type="button" variant="primary" size="sm" onClick={save} disabled={pending}>
          {pending ? "…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={pending}>
          ×
        </Button>
      </li>
    );
  }

  return (
    <li className="px-4 py-2.5 flex items-center gap-2 group">
      <span className="w-32 text-xs font-medium text-ink-secondary flex-shrink-0">{def.name}</span>
      <span className="flex-1 text-sm text-ink-primary">{formatCustomFieldValue(def, value)}</span>
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] text-info hover:underline opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          Edit
        </button>
      )}
    </li>
  );
}

function FieldInput({
  def,
  value,
  onChange,
  disabled,
  onEnter,
}: {
  def: CustomFieldDef;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  onEnter: () => void;
}) {
  const baseClass = "flex-1 text-sm bg-canvas border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500 disabled:opacity-50";

  if (def.type === "select") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={baseClass}
      >
        <option value="">—</option>
        {def.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
      placeholder={def.type === "date" ? "YYYY-MM-DD" : ""}
      autoFocus
      disabled={disabled}
      className={baseClass}
    />
  );
}
