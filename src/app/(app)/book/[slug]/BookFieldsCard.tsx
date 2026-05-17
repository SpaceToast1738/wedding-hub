"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { formatBookFieldValue, type BookFieldDefShape } from "@/lib/book-cards";
import { addBookFieldDef, deleteBookFieldDef, setBookFieldValue } from "../actions";
import { CardChrome } from "./CardChrome";
import type { LinkedTaskRow } from "./CardLinkedTasksPanel";
import type { UserOpt } from "@/app/(app)/tasks/AddTaskToggle";

// v1.38.0 (P7b/B): FIELD card gains group label, helpText, required
// flag, and number / date range bounds. Editor renders fields grouped
// by `group` with collapsible sections; helpText shows under the
// label; required marker is an asterisk; ranges enforced server-side
// by parseBookFieldValue.

type DbDef = {
  id: string;
  label: string;
  type: string;
  options: string[];
  order: number;
  group: string | null;
  helpText: string | null;
  required: boolean;
  min: number | null;
  max: number | null;
  dateMin: Date | null;
  dateMax: Date | null;
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
  linkedTasks = [],
  users = [],
}: {
  subsectionId: string;
  slug: string;
  title: string;
  fieldDefs: DbDef[];
  values: Values;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  linkedTasks?: LinkedTaskRow[];
  users?: UserOpt[];
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
      linkedTasks={linkedTasks}
      users={users}
    >
      {fieldDefs.length === 0 && !canEdit ? (
        <p className="text-xs text-ink-tertiary italic">No fields yet.</p>
      ) : (
        <FieldList
          fieldDefs={fieldDefs}
          values={values}
          subsectionId={subsectionId}
          canEdit={canEdit}
        />
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

// Group fields by their `group` label so the card renders as
// collapsible sections rather than one flat list. Fields with no
// group bucket under the empty string and render last.
function FieldList({
  fieldDefs,
  values,
  subsectionId,
  canEdit,
}: {
  fieldDefs: DbDef[];
  values: Values;
  subsectionId: string;
  canEdit: boolean;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, DbDef[]>();
    for (const d of fieldDefs) {
      const k = (d.group ?? "").trim();
      const arr = map.get(k) ?? [];
      arr.push(d);
      map.set(k, arr);
    }
    const entries = [...map.entries()].sort((a, b) => {
      if (a[0] === "" && b[0] !== "") return 1;
      if (b[0] === "" && a[0] !== "") return -1;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [fieldDefs]);

  // If only the unnamed bucket exists, render flat (no group header).
  const onlyUnnamed = grouped.length === 1 && grouped[0]![0] === "";
  if (onlyUnnamed) {
    return (
      <ul className="divide-y divide-border-soft">
        {grouped[0]![1].map((def) => (
          <FieldRow
            key={def.id}
            def={def}
            value={values[def.id] ?? null}
            subsectionId={subsectionId}
            canEdit={canEdit}
          />
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-3">
      {grouped.map(([groupLabel, defs]) => (
        <section key={groupLabel || "__none__"}>
          <header className="text-[11px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
            {groupLabel || "Other"}
          </header>
          <ul className="divide-y divide-border-soft border border-border-soft rounded-md">
            {defs.map((def) => (
              <FieldRow
                key={def.id}
                def={def}
                value={values[def.id] ?? null}
                subsectionId={subsectionId}
                canEdit={canEdit}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
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
  const confirm = useConfirm();

  const defShape: BookFieldDefShape = {
    id: def.id,
    label: def.label,
    type: def.type as BookFieldDefShape["type"],
    options: def.options,
    order: def.order,
    group: def.group,
    helpText: def.helpText,
    required: def.required,
    min: def.min,
    max: def.max,
    dateMin: def.dateMin ? def.dateMin.toISOString().slice(0, 10) : null,
    dateMax: def.dateMax ? def.dateMax.toISOString().slice(0, 10) : null,
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

  async function onDelete() {
    if (!(await confirm({ title: `Delete field "${def.label}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      const res = await deleteBookFieldDef(def.id);
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <li className="flex items-center gap-3 py-2 px-3 group">
      <span className="text-xs font-medium text-ink-secondary w-32 flex-shrink-0">
        {def.label}
        {def.required && (
          <span className="text-danger ml-0.5" title="Required">
            *
          </span>
        )}
        {def.helpText && (
          <span
            className="ml-1 text-ink-tertiary cursor-help"
            title={def.helpText}
          >
            ⓘ
          </span>
        )}
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
  const [group, setGroup] = useState("");
  const [helpText, setHelpText] = useState("");
  const [required, setRequired] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
      const res = await addBookFieldDef(subsectionId, label.trim(), type, optList, {
        group: group.trim() || null,
        helpText: helpText.trim() || null,
        required,
      });
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
      {/* v1.38.0: optional metadata behind a "More options" toggle so
          the simple add path stays one-line. */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        disabled={pending}
        className="text-[11px] text-ink-tertiary hover:text-ink-primary"
      >
        {showAdvanced ? "− Hide options" : "+ More options (group, help text, required)"}
      </button>
      {showAdvanced && (
        <div className="space-y-1.5 border-t border-border-soft pt-2">
          <input
            type="text"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Group label (e.g. Contact, Logistics)"
            maxLength={60}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
          />
          <input
            type="text"
            value={helpText}
            onChange={(e) => setHelpText(e.target.value)}
            placeholder="Help text — shown on hover"
            maxLength={400}
            disabled={pending}
            className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              disabled={pending}
            />
            <span>Required</span>
          </label>
        </div>
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
