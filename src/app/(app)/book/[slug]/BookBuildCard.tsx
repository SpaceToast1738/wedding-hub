"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import {
  copyBuildMaterialsToBudget,
  createBuildMaterial,
  createBuildSession,
  deleteBuildMaterial,
  deleteBuildSession,
  reorderBuildMaterials,
  toggleBuildMaterialFlag,
  updateBuildCard,
  updateBuildMaterial,
  updateBuildSession,
} from "../actions";
import { buildRollups, type BuildCardShape } from "@/lib/book-cards";
import { CardChrome } from "./CardChrome";

// v1.31.0: BUILD card editor — DIY production tracker. One card per
// project. Header shows units done / quantity, hours logged /
// estimated, status pill, target date with days-remaining countdown,
// plus a prototype-blocker banner when target's < 30 days off and
// the prototype isn't ticked. Materials and sessions are inline-
// edited via per-row server-action calls (no client buffer + dirty-
// check; each interaction round-trips).

type BuildCardProps = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  card: {
    id: string;
    quantityNeeded: number | null;
    targetDate: Date | null;
    status: string | null;
    prototypeDone: boolean;
    prototypeNotes: string | null;
    estimatedMinutesPerUnit: number | null;
    notes: string | null;
    materials: Array<{
      id: string;
      name: string;
      quantity: number | null;
      unit: string | null;
      supplier: string | null;
      costPence: number | null;
      ordered: boolean;
      arrived: boolean;
      notes: string | null;
      order: number;
    }>;
    sessions: Array<{
      id: string;
      date: Date;
      minutes: number;
      unitsCompleted: number | null;
      notes: string | null;
    }>;
  };
};

const STATUS_OPTIONS = ["Designing", "Prototyping", "Producing", "Done"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatGBP(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function isoDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function BookBuildCard({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  isCouple,
  card,
}: BuildCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const cardForRollup: BuildCardShape = {
    quantityNeeded: card.quantityNeeded,
    estimatedMinutesPerUnit: card.estimatedMinutesPerUnit,
    prototypeDone: card.prototypeDone,
    targetDate: card.targetDate,
    materials: card.materials,
    sessions: card.sessions,
  };
  const r = buildRollups(cardForRollup);

  const daysToTarget =
    card.targetDate
      ? Math.round((card.targetDate.getTime() - Date.now()) / MS_PER_DAY)
      : null;

  function saveHeader(formData: FormData) {
    startTransition(async () => {
      const res = await updateBuildCard(subsectionId, formData);
      if (res.ok) notify("success", "Build card saved");
      else notify("error", res.error);
    });
  }

  function copyToBudget() {
    startTransition(async () => {
      const res = await copyBuildMaterialsToBudget(card.id);
      if (res.ok) {
        notify("success", `Budget line created (${formatGBP(r.materialsTotalPence)})`);
        router.push(`/budget`);
      } else {
        notify("error", res.error);
      }
    });
  }

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Build"
    >
      {/* Prototype-blocker banner */}
      {r.prototypeBlocker && (
        <div className="mb-3 px-3 py-2 bg-marigold-100 border border-marigold-700/30 rounded-sm text-xs text-marigold-700">
          ⚠ Prototype not done with target date inside 30 days.
        </div>
      )}

      {/* Header strip — rollups */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
        <Stat label="Units" value={`${r.unitsDone}${card.quantityNeeded ? ` / ${card.quantityNeeded}` : ""}`} />
        <Stat
          label="Hours"
          value={`${r.hoursLogged}${r.hoursEstimated != null ? ` / ${r.hoursEstimated}` : ""}`}
        />
        <Stat label="Materials" value={formatGBP(r.materialsTotalPence)} />
        <Stat
          label="Target"
          value={
            card.targetDate
              ? `${card.targetDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${
                  daysToTarget !== null ? ` (${daysToTarget}d)` : ""
                }`
              : "—"
          }
        />
      </div>

      {/* Status + prototype quick row */}
      {canEdit ? (
        <form action={saveHeader} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3 items-end">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
              Status
            </label>
            <select
              name="status"
              defaultValue={card.status ?? ""}
              className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none"
            >
              <option value="">—</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
              Quantity needed
            </label>
            <input
              type="number"
              name="quantityNeeded"
              min={0}
              defaultValue={card.quantityNeeded ?? ""}
              className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
              Target date
            </label>
            <input
              type="date"
              name="targetDate"
              defaultValue={isoDate(card.targetDate)}
              className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
            />
          </div>
          <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
                Est minutes / unit
              </label>
              <input
                type="number"
                name="estimatedMinutesPerUnit"
                min={0}
                defaultValue={card.estimatedMinutesPerUnit ?? ""}
                className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm self-end pb-1">
              <input
                type="checkbox"
                name="prototypeDone"
                defaultChecked={card.prototypeDone}
              />
              <span>Prototype done</span>
            </label>
            <div className="self-end">
              <Button type="submit" variant="primary" size="sm" disabled={pending}>
                Save header
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="text-xs text-ink-tertiary mb-3">
          Status: {card.status ?? "—"} · Prototype: {card.prototypeDone ? "done" : "not done"}
        </div>
      )}

      {/* Materials */}
      <Materials
        cardId={card.id}
        materials={card.materials}
        canEdit={canEdit}
        pending={pending}
        onMutate={(fn) => startTransition(fn)}
      />

      {/* Copy to Budget */}
      {canEdit && card.materials.length > 0 && (
        <div className="mt-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={copyToBudget} disabled={pending}>
            Copy materials total to Budget →
          </Button>
        </div>
      )}

      {/* Sessions */}
      <Sessions
        cardId={card.id}
        sessions={card.sessions}
        canEdit={canEdit}
        pending={pending}
        onMutate={(fn) => startTransition(fn)}
      />
    </CardChrome>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas/40 border border-border-soft rounded-sm px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
        {label}
      </div>
      <div className="text-sm text-ink-primary tabular-nums truncate">{value}</div>
    </div>
  );
}

function Materials({
  cardId,
  materials,
  canEdit,
  pending,
  onMutate,
}: {
  cardId: string;
  materials: BuildCardProps["card"]["materials"];
  canEdit: boolean;
  pending: boolean;
  onMutate: (fn: () => void) => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between mb-1">
        <strong className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
          Materials ({materials.length})
        </strong>
        {canEdit && !adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            + Add material
          </Button>
        )}
      </div>
      {adding && (
        <MaterialForm
          cardId={cardId}
          onCancel={() => setAdding(false)}
          onDone={() => setAdding(false)}
          pending={pending}
          onMutate={onMutate}
        />
      )}
      {materials.length === 0 && !adding ? (
        <p className="text-xs text-ink-tertiary italic">No materials yet.</p>
      ) : (
        <ul className="divide-y divide-border-soft text-sm border border-border-soft rounded-sm">
          {materials.map((m) => (
            <MaterialRow
              key={m.id}
              material={m}
              canEdit={canEdit}
              pending={pending}
              onMutate={onMutate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MaterialRow({
  material,
  canEdit,
  pending,
  onMutate,
}: {
  material: BuildCardProps["card"]["materials"][number];
  canEdit: boolean;
  pending: boolean;
  onMutate: (fn: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  function toggle(flag: "ordered" | "arrived", value: boolean) {
    onMutate(async () => {
      const res = await toggleBuildMaterialFlag(material.id, flag, value);
      if (!res.ok) notify("error", res.error);
    });
  }
  function remove() {
    if (!confirm(`Remove "${material.name}"?`)) return;
    onMutate(async () => {
      const res = await deleteBuildMaterial(material.id);
      if (!res.ok) notify("error", res.error);
    });
  }
  function reorder(delta: number) {
    onMutate(async () => {
      const res = await reorderBuildMaterials(material.id, delta);
      if (!res.ok) notify("error", res.error);
    });
  }
  if (editing) {
    return (
      <li className="px-3 py-2 bg-canvas/30">
        <MaterialForm
          cardId={material.id}
          isEdit
          initial={material}
          onCancel={() => setEditing(false)}
          onDone={() => setEditing(false)}
          pending={pending}
          onMutate={onMutate}
        />
      </li>
    );
  }
  return (
    <li className="flex items-baseline gap-2 px-3 py-1.5 text-xs">
      <span className="flex-1 text-ink-primary truncate">
        {material.name}
        {material.quantity != null && ` · ${material.quantity}${material.unit ? ` ${material.unit}` : ""}`}
        {material.supplier && ` · ${material.supplier}`}
      </span>
      <span className="text-ink-tertiary tabular-nums w-16 text-right">
        {material.costPence != null ? formatGBP(material.costPence) : ""}
      </span>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={material.ordered}
          disabled={!canEdit || pending}
          onChange={(e) => toggle("ordered", e.target.checked)}
        />
        <span className="text-[10px] text-ink-tertiary">Ord</span>
      </label>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={material.arrived}
          disabled={!canEdit || pending}
          onChange={(e) => toggle("arrived", e.target.checked)}
        />
        <span className="text-[10px] text-ink-tertiary">Arr</span>
      </label>
      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => reorder(-1)}
            className="text-[10px] text-ink-tertiary hover:text-ink-primary px-1"
            disabled={pending}
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => reorder(1)}
            className="text-[10px] text-ink-tertiary hover:text-ink-primary px-1"
            disabled={pending}
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[10px] text-ink-tertiary hover:text-ink-primary px-1"
            disabled={pending}
          >
            edit
          </button>
          <button
            type="button"
            onClick={remove}
            className="text-[10px] text-ink-tertiary hover:text-danger px-1"
            disabled={pending}
            aria-label="Remove"
          >
            ×
          </button>
        </>
      )}
    </li>
  );
}

function MaterialForm({
  cardId,
  isEdit,
  initial,
  onCancel,
  onDone,
  pending,
  onMutate,
}: {
  cardId: string;
  isEdit?: boolean;
  initial?: BuildCardProps["card"]["materials"][number];
  onCancel: () => void;
  onDone: () => void;
  pending: boolean;
  onMutate: (fn: () => void) => void;
}) {
  function submit(formData: FormData) {
    onMutate(async () => {
      const res = isEdit
        ? await updateBuildMaterial(cardId, formData)
        : await createBuildMaterial(cardId, formData);
      if (res.ok) {
        notify("success", isEdit ? "Material updated" : "Material added");
        onDone();
      } else {
        notify("error", res.error);
      }
    });
  }
  return (
    <form action={submit} className="grid grid-cols-1 sm:grid-cols-6 gap-1.5 mb-2 px-2 py-2 bg-canvas/40 border border-border-soft rounded-sm">
      <input
        name="name"
        defaultValue={initial?.name ?? ""}
        required
        autoFocus
        placeholder="Name"
        className="sm:col-span-2 text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <input
        name="quantity"
        type="number"
        step="any"
        defaultValue={initial?.quantity ?? ""}
        placeholder="Qty"
        className="text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <input
        name="unit"
        defaultValue={initial?.unit ?? ""}
        placeholder="Unit"
        className="text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <input
        name="supplier"
        defaultValue={initial?.supplier ?? ""}
        placeholder="Supplier"
        className="text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <input
        name="costPence"
        type="number"
        min={0}
        defaultValue={initial?.costPence ?? ""}
        placeholder="Cost (pence)"
        className="text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <div className="sm:col-span-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {isEdit ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}

function Sessions({
  cardId,
  sessions,
  canEdit,
  pending,
  onMutate,
}: {
  cardId: string;
  sessions: BuildCardProps["card"]["sessions"];
  canEdit: boolean;
  pending: boolean;
  onMutate: (fn: () => void) => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between mb-1">
        <strong className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold">
          Sessions ({sessions.length})
        </strong>
        {canEdit && !adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            + Log session
          </Button>
        )}
      </div>
      {adding && (
        <SessionForm
          cardId={cardId}
          onCancel={() => setAdding(false)}
          onDone={() => setAdding(false)}
          pending={pending}
          onMutate={onMutate}
        />
      )}
      {sessions.length === 0 && !adding ? (
        <p className="text-xs text-ink-tertiary italic">No sessions yet.</p>
      ) : (
        <ul className="divide-y divide-border-soft text-sm border border-border-soft rounded-sm">
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              canEdit={canEdit}
              pending={pending}
              onMutate={onMutate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SessionRow({
  session,
  canEdit,
  pending,
  onMutate,
}: {
  session: BuildCardProps["card"]["sessions"][number];
  canEdit: boolean;
  pending: boolean;
  onMutate: (fn: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  function remove() {
    if (!confirm("Delete this session?")) return;
    onMutate(async () => {
      const res = await deleteBuildSession(session.id);
      if (!res.ok) notify("error", res.error);
    });
  }
  if (editing) {
    return (
      <li className="px-3 py-2 bg-canvas/30">
        <SessionForm
          cardId={session.id}
          isEdit
          initial={session}
          onCancel={() => setEditing(false)}
          onDone={() => setEditing(false)}
          pending={pending}
          onMutate={onMutate}
        />
      </li>
    );
  }
  const hours = Math.round((session.minutes / 60) * 10) / 10;
  return (
    <li className="flex items-baseline gap-2 px-3 py-1.5 text-xs">
      <span className="text-ink-tertiary tabular-nums w-20">
        {session.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
      </span>
      <span className="text-ink-primary tabular-nums w-12 text-right">{hours}h</span>
      {session.unitsCompleted != null && (
        <span className="text-ink-tertiary tabular-nums w-12 text-right">
          {session.unitsCompleted}u
        </span>
      )}
      <span className="flex-1 text-ink-secondary truncate">{session.notes ?? ""}</span>
      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[10px] text-ink-tertiary hover:text-ink-primary px-1"
            disabled={pending}
          >
            edit
          </button>
          <button
            type="button"
            onClick={remove}
            className="text-[10px] text-ink-tertiary hover:text-danger px-1"
            disabled={pending}
            aria-label="Remove"
          >
            ×
          </button>
        </>
      )}
    </li>
  );
}

function SessionForm({
  cardId,
  isEdit,
  initial,
  onCancel,
  onDone,
  pending,
  onMutate,
}: {
  cardId: string;
  isEdit?: boolean;
  initial?: BuildCardProps["card"]["sessions"][number];
  onCancel: () => void;
  onDone: () => void;
  pending: boolean;
  onMutate: (fn: () => void) => void;
}) {
  function submit(formData: FormData) {
    onMutate(async () => {
      const res = isEdit
        ? await updateBuildSession(cardId, formData)
        : await createBuildSession(cardId, formData);
      if (res.ok) {
        notify("success", isEdit ? "Session updated" : "Session logged");
        onDone();
      } else {
        notify("error", res.error);
      }
    });
  }
  return (
    <form action={submit} className="grid grid-cols-1 sm:grid-cols-5 gap-1.5 mb-2 px-2 py-2 bg-canvas/40 border border-border-soft rounded-sm">
      <input
        name="date"
        type="date"
        defaultValue={isoDate(initial?.date ?? new Date())}
        required
        className="text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <input
        name="minutes"
        type="number"
        min={0}
        defaultValue={initial?.minutes ?? 30}
        required
        placeholder="Minutes"
        className="text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <input
        name="unitsCompleted"
        type="number"
        min={0}
        defaultValue={initial?.unitsCompleted ?? ""}
        placeholder="Units"
        className="text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <input
        name="notes"
        defaultValue={initial?.notes ?? ""}
        placeholder="Notes"
        className="sm:col-span-2 text-xs bg-surface border border-border-soft rounded-sm px-2 py-1 text-ink-primary outline-none focus:border-moss-500"
      />
      <div className="sm:col-span-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {isEdit ? "Save" : "Log"}
        </Button>
      </div>
    </form>
  );
}
