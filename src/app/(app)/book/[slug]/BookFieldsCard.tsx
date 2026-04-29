"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { formatBookFieldValue, type BookFieldDefShape } from "@/lib/book-cards";
import { addBookFieldDef, deleteBookFieldDef, setBookFieldValue } from "../actions";
import { CardChrome } from "./CardChrome";

type DbDef = {
  id: string;
  label: string;
  type: string;
  options: string[];
  order: number;
};

type Values = Record<string, string | number | null>;

// v1.26.0: FIELD card editor. Mirrors v1.15.0's CustomFieldsBlock UX
// but scoped to one BookSubsection — each card has its own field set.
//
// Top-level state:
//   - definitions (BookFieldDef rows) — load from server, mutate via
//     addBookFieldDef / deleteBookFieldDef.
//   - values (Json bag on BookSubsection.fields) — keyed by def.id;
//     mutate via setBookFieldValue.
//
// The "Add field" pop-out lets the user type a label, pick a type,
// and (for select) enter comma-separated options. Each row's value
// edit is a small inline form — text/number/date/select input → Save
// or Reset.
export function BookFieldsCard({
  subsectionId,
  slug,
  title,
  fieldDefs,
  values,
  visibility,
  canEdit,
  isCouple,
}: {
  subsectionId: string;
  slug: string;
  title: string;
  fieldDefs: DbDef[];
  values: Values;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Field"
    >
      {fieldDefs.length === 0 && !canEdit ? (
        <p className="text-xs text-ink-tertiary italic">No fields yet.</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {fieldDefs.map((def) => (
            <FieldRow
              key={def.id}
              def={def}
              value={values[def.id] ?? null}
              subsectionId={subsectionId}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-3">
          {adding ? (
            <AddFieldForm
              subsectionId={subsectionId}
              onClose={() => setAdding(false)}
            />
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
              + Add field
            </Button>
          )}
        </div>
      )}
    </CardChrome>
  );
}

function FieldRow({
  def,
  value,
  subsectionId,
  canEdit,
}: {
  def: DbDef;
  value: string | number | null;
  subsectionId: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(() =>
    value === null || value === undefined ? "" : String(value),
  );
  const [pending, startTransition] = useTransition();

  const defShape: BookFieldDefShape = {
    id: def.id,
    label: def.label,
    type: def.type as BookFieldDefShape["type"],
    options: def.options,
    order: def.order,
  };

  function save() {
    startTransition(async () => {
      const res = await setBookFieldValue(subsectionId, def.id, raw);
      if (res.ok) {
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  function onDelete() {
    if (!confirm(`Delete field "${def.label}"?`)) return;
    startTransition(async () => {
      const res = await deleteBookFieldDef(def.id);
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <li className="flex items-center gap-3 py-2 group">
      <span className="text-xs font-medium text-ink-secondary w-32 flex-shrink-0">
        {def.label}
      </span>
      {editing && canEdit ? (
        <>
          <FieldInput def={defShape} value={raw} onChange={setRaw} disabled={pending} />
          <Button variant="primary" size="sm" onClick={save} disabled={pending}>
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRaw(value === null || value === undefined ? "" : String(value));
              setEditing(false);
            }}
            disabled={pending}
          >
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm text-ink-primary">
            {formatBookFieldValue(defShape, value)}
          </span>
          {canEdit && (
            <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
                Delete
              </Button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

function FieldInput({
  def,
  value,
  onChange,
  disabled,
}: {
  def: BookFieldDefShape;
  value: string;
  onChange: (s: string) => void;
  disabled: boolean;
}) {
  const className =
    "flex-1 text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500";
  if (def.type === "select") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={className}
      >
        <option value="">— empty —</option>
        {def.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (def.type === "date") {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={className}
      />
    );
  }
  return (
    <input
      type={def.type === "number" ? "text" : "text"}
      inputMode={def.type === "number" ? "decimal" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
    />
  );
}

function AddFieldForm({
  subsectionId,
  onClose,
}: {
  subsectionId: string;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"text" | "number" | "date" | "select">("text");
  const [options, setOptions] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!label.trim()) return;
    const optList =
      type === "select"
        ? options.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    if (type === "select" && optList.length === 0) {
      notify("error", "Select fields need at least one option");
      return;
    }
    startTransition(async () => {
      const res = await addBookFieldDef(subsectionId, label.trim(), type, optList);
      if (res.ok) onClose();
      else notify("error", res.error);
    });
  }

  return (
    <div className="bg-canvas/40 border border-border-soft rounded-md p-3 space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Field label (e.g. Photographer fee)"
          maxLength={120}
          disabled={pending}
          className="flex-1 text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          disabled={pending}
          className="text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none"
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="select">Select</option>
        </select>
      </div>
      {type === "select" && (
        <input
          type="text"
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          placeholder="Comma-separated options (e.g. Booked, Pending, Cancelled)"
          disabled={pending}
          className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
        />
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={submit}
          disabled={pending || !label.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
