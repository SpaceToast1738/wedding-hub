"use client";

// v1.92.0: WEDDING_PARTY card editor — matrix tracker. Items as rows,
// people as columns, each cell is a status (Need / Have / Already
// own / N/A). Designed for "are the bridesmaids ready?" rollup.
//
// Cell-by-cell save model: each cell change calls setWeddingPartyCell
// directly. Member / item add / rename / delete / reorder each call
// their own action. Card header (groupLabel, notes) saves on blur.
//
// No giant draft state — matches the /seating reception table pattern.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { CardChrome } from "./CardChrome";
import type { LinkedTaskRow } from "./CardLinkedTasksPanel";
import type { UserOpt } from "@/app/(app)/tasks/AddTaskToggle";
import {
  saveWeddingPartyCardHeader,
  createWeddingPartyMember,
  updateWeddingPartyMember,
  deleteWeddingPartyMember,
  reorderWeddingPartyMembers,
  createWeddingPartyItem,
  updateWeddingPartyItem,
  deleteWeddingPartyItem,
  reorderWeddingPartyItems,
  setWeddingPartyCell,
} from "../actions";

// v1.95.3: ORDERED added between NEED and HAVE — "we've placed the
// order but it isn't in our hands yet". Doesn't count as "sorted" in
// the rollup (the v1.92.0 sortedCount filter still requires HAVE /
// ALREADY_OWN / N_A) — ordered items are in-progress, not done.
type Status = "NEED" | "ORDERED" | "HAVE" | "ALREADY_OWN" | "N_A";

type Member = { id: string; name: string; role: string | null; order: number };
type Item = { id: string; label: string; notes: string | null; order: number };
type Cell = { memberId: string; itemId: string; status: Status; notes: string | null };

type CardData = {
  id: string;
  groupLabel: string | null;
  notes: string | null;
  members: Member[];
  items: Item[];
  cells: Cell[];
};

type Props = {
  subsectionId: string;
  slug: string;
  title: string;
  visibility: "EVERYONE" | "COUPLE_ONLY";
  canEdit: boolean;
  isCouple: boolean;
  card: CardData;
  linkedTasks?: LinkedTaskRow[];
  users?: UserOpt[];
};

const STATUS_META: Record<Status, { glyph: string; label: string; tone: string }> = {
  NEED: {
    glyph: "○",
    label: "Need",
    tone: "bg-canvas border-border-soft text-ink-tertiary",
  },
  ORDERED: {
    // v1.95.3: marigold tone matches the "in-progress" pill the
    // tasks panel uses for OPEN — visually distinct from HAVE's
    // moss "done" tone so the matrix reads at a glance.
    glyph: "→",
    label: "Ordered",
    tone: "bg-marigold-100/40 border-marigold-700/30 text-marigold-700",
  },
  HAVE: {
    glyph: "✓",
    label: "Have",
    tone: "bg-moss-50 border-moss-300 text-moss-700",
  },
  ALREADY_OWN: {
    glyph: "◆",
    label: "Already own",
    tone: "bg-info/10 border-info/30 text-info",
  },
  N_A: {
    glyph: "—",
    label: "N/A",
    tone: "bg-canvas border-border-soft text-ink-tertiary opacity-60",
  },
};

const STATUSES: Status[] = ["NEED", "ORDERED", "HAVE", "ALREADY_OWN", "N_A"];

// Build a quick (memberId, itemId) → cell lookup; missing cells
// default to NEED.
function cellAt(cells: Cell[], memberId: string, itemId: string): Status {
  for (const c of cells) {
    if (c.memberId === memberId && c.itemId === itemId) return c.status as Status;
  }
  return "NEED";
}

export function BookWeddingPartyCard({
  subsectionId,
  slug,
  title,
  visibility,
  canEdit,
  isCouple,
  card,
  linkedTasks = [],
  users = [],
}: Props) {
  const [pending, startTransition] = useTransition();
  const [groupLabel, setGroupLabel] = useState(card.groupLabel ?? "");
  const [savedGroupLabel, setSavedGroupLabel] = useState(card.groupLabel ?? "");
  const [notes, setNotes] = useState(card.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(card.notes ?? "");
  const confirm = useConfirm();

  // Local optimistic snapshots of the matrix so cell clicks feel
  // instant. Synced on each prop change.
  const [optimisticCells, setOptimisticCells] = useState<Cell[]>(card.cells);
  // Re-sync when the underlying card prop refreshes (after revalidate).
  if (card.cells !== referenceForCells.current) {
    referenceForCells.current = card.cells;
  }

  function saveHeader() {
    const nextLabel = groupLabel.trim() || null;
    const nextNotes = notes.trim() || null;
    if (nextLabel === (savedGroupLabel || null) && nextNotes === (savedNotes || null)) return;
    startTransition(async () => {
      const res = await saveWeddingPartyCardHeader(subsectionId, {
        groupLabel: nextLabel,
        notes: nextNotes,
      });
      if (res.ok) {
        setSavedGroupLabel(nextLabel ?? "");
        setSavedNotes(nextNotes ?? "");
      } else {
        notify("error", res.error);
      }
    });
  }

  function setCell(memberId: string, itemId: string, status: Status) {
    // Optimistic update.
    setOptimisticCells((prev) => {
      const filtered = prev.filter((c) => !(c.memberId === memberId && c.itemId === itemId));
      if (status === "NEED") return filtered; // sparse — NEED is the absence of a row
      return [...filtered, { memberId, itemId, status, notes: null }];
    });
    startTransition(async () => {
      const res = await setWeddingPartyCell(memberId, itemId, { status });
      if (!res.ok) notify("error", res.error);
    });
  }

  function addMember() {
    startTransition(async () => {
      const res = await createWeddingPartyMember(card.id, { name: `Member ${card.members.length + 1}` });
      if (!res.ok) notify("error", res.error);
    });
  }

  function addItem() {
    startTransition(async () => {
      const res = await createWeddingPartyItem(card.id, { label: "New item" });
      if (!res.ok) notify("error", res.error);
    });
  }

  // Rollup for the read-mode summary chip.
  const totalCells = card.members.length * card.items.length;
  const sortedCount = optimisticCells.filter(
    (c) => c.status === "HAVE" || c.status === "ALREADY_OWN" || c.status === "N_A",
  ).length;

  return (
    <CardChrome
      subsectionId={subsectionId}
      slug={slug}
      initialTitle={title}
      visibility={visibility}
      canEdit={canEdit}
      isCouple={isCouple}
      kindBadge="Wedding party"
      linkedTasks={linkedTasks}
      users={users}
    >
      <div className="space-y-4">
        {/* Header row — group label + summary chip. */}
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          {canEdit ? (
            <Input
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              onBlur={saveHeader}
              placeholder="e.g. Bridesmaids / Groomsmen / Flower girls"
              disabled={pending}
              className="!text-sm !font-semibold flex-1 max-w-sm"
            />
          ) : savedGroupLabel ? (
            <span className="text-sm font-semibold text-ink-primary">{savedGroupLabel}</span>
          ) : (
            <span className="text-sm text-ink-tertiary italic">No group name set</span>
          )}
          {totalCells > 0 && (
            <span className="text-[11px] text-ink-tertiary">
              {sortedCount} of {totalCells} sorted · {card.members.length} {card.members.length === 1 ? "person" : "people"} · {card.items.length} {card.items.length === 1 ? "item" : "items"}
            </span>
          )}
        </div>

        {/* v1.92.1: matrix flipped on user feedback — people as rows
            (typical bridal parties = 4-5 people but only 3-4 items, so
            fewer columns avoids horizontal scroll cutting off names). */}
        {card.members.length === 0 || card.items.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">
            {canEdit
              ? "Add at least one person and one item to start tracking."
              : "Nothing to track yet."}
          </p>
        ) : (
          <div className="overflow-x-auto border border-border-soft rounded-md">
            <table className="text-sm min-w-full">
              <thead>
                <tr className="border-b border-border-soft bg-canvas/40">
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-ink-tertiary font-bold w-48">
                    Person
                  </th>
                  {card.items.map((item, idx) => (
                    <th key={item.id} className="px-3 py-2 text-left">
                      <ItemHeader
                        item={item}
                        canEdit={canEdit}
                        isFirst={idx === 0}
                        isLast={idx === card.items.length - 1}
                        // v1.92.1: items are now columns — reorder uses
                        // the "left / right" idiom (mapped to the
                        // existing onMove("up"/"down") direction).
                        orientation="column"
                        onRename={(label, notes) => {
                          startTransition(async () => {
                            const res = await updateWeddingPartyItem(item.id, { label, notes });
                            if (!res.ok) notify("error", res.error);
                          });
                        }}
                        onDelete={async () => {
                          if (!(await confirm({ title: `Remove ${item.label}?`, confirmLabel: "Remove", tone: "danger" }))) return;
                          startTransition(async () => {
                            const res = await deleteWeddingPartyItem(item.id);
                            if (!res.ok) notify("error", res.error);
                          });
                        }}
                        onMove={(direction) => {
                          const ids = card.items.map((x) => x.id);
                          const j = idx + (direction === "up" ? -1 : 1);
                          if (j < 0 || j >= ids.length) return;
                          const tmp = ids[idx]!;
                          ids[idx] = ids[j]!;
                          ids[j] = tmp;
                          startTransition(async () => {
                            const res = await reorderWeddingPartyItems(card.id, ids);
                            if (!res.ok) notify("error", res.error);
                          });
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.members.map((m, idx) => (
                  <tr key={m.id} className="border-b border-border-soft last:border-b-0">
                    <td className="px-3 py-2 align-top w-48">
                      <MemberHeader
                        member={m}
                        canEdit={canEdit}
                        isFirst={idx === 0}
                        isLast={idx === card.members.length - 1}
                        // v1.92.1: people are now rows — reorder uses
                        // the "up / down" idiom.
                        orientation="row"
                        onRename={(name, role) => {
                          startTransition(async () => {
                            const res = await updateWeddingPartyMember(m.id, { name, role });
                            if (!res.ok) notify("error", res.error);
                          });
                        }}
                        onDelete={async () => {
                          if (!(await confirm({ title: `Remove ${m.name}?`, confirmLabel: "Remove", tone: "danger" }))) return;
                          startTransition(async () => {
                            const res = await deleteWeddingPartyMember(m.id);
                            if (!res.ok) notify("error", res.error);
                          });
                        }}
                        onMove={(direction) => {
                          const ids = card.members.map((x) => x.id);
                          const j = idx + (direction === "up" ? -1 : 1);
                          if (j < 0 || j >= ids.length) return;
                          const tmp = ids[idx]!;
                          ids[idx] = ids[j]!;
                          ids[j] = tmp;
                          startTransition(async () => {
                            const res = await reorderWeddingPartyMembers(card.id, ids);
                            if (!res.ok) notify("error", res.error);
                          });
                        }}
                      />
                    </td>
                    {card.items.map((item) => {
                      const status = cellAt(optimisticCells, m.id, item.id);
                      return (
                        <td key={item.id} className="px-3 py-2 align-top">
                          {canEdit ? (
                            <select
                              value={status}
                              onChange={(e) => setCell(m.id, item.id, e.target.value as Status)}
                              disabled={pending}
                              className={`text-[11px] rounded-full px-2 py-0.5 border tabular-nums ${STATUS_META[status].tone}`}
                              title={STATUS_META[status].label}
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_META[s].glyph} {STATUS_META[s].label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border ${STATUS_META[status].tone}`}
                              title={STATUS_META[status].label}
                            >
                              <span aria-hidden>{STATUS_META[status].glyph}</span>
                              <span>{STATUS_META[status].label}</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add-row + Add-column buttons. */}
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={addMember} disabled={pending}>
              + Add person (row)
            </Button>
            <Button variant="ghost" size="sm" onClick={addItem} disabled={pending}>
              + Add item (column)
            </Button>
          </div>
        )}

        {/* Card-level notes. */}
        {canEdit ? (
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Notes
            </label>
            <MentionableTextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveHeader}
              rows={2}
              disabled={pending}
              placeholder="Anything worth remembering about the group — colour scheme, suppliers, gift list."
              className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2.5 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
            />
          </div>
        ) : (
          savedNotes && (
            <div>
              <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
                Notes
              </strong>
              <p className="text-sm text-ink-secondary whitespace-pre-wrap">{savedNotes}</p>
            </div>
          )
        )}
      </div>
    </CardChrome>
  );
}

// Sentinel for re-syncing optimisticCells when the prop changes
// (avoids a useEffect dep on an array reference). Module-scoped is
// fine — Next renders this component fresh per subsection id, so
// there's no cross-card bleeding.
const referenceForCells = { current: [] as Cell[] };

// ─── Header cells ─────────────────────────────────────────────────

function MemberHeader({
  member,
  canEdit,
  isFirst,
  isLast,
  onRename,
  onDelete,
  onMove,
  orientation = "column",
}: {
  member: Member;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRename: (name: string, role: string | null) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
  // v1.92.1: pick the right arrow glyphs for the move buttons —
  // "row" headers reorder up/down, "column" headers reorder left/right.
  orientation?: "row" | "column";
}) {
  const prevGlyph = orientation === "row" ? "▲" : "◀";
  const nextGlyph = orientation === "row" ? "▼" : "▶";
  const prevTitle = orientation === "row" ? "Move up" : "Move left";
  const nextTitle = orientation === "row" ? "Move down" : "Move right";
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role ?? "");
  if (editing) {
    return (
      <div className="space-y-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onRename(name.trim(), role.trim() || null);
              setEditing(false);
            } else if (e.key === "Escape") {
              setName(member.name);
              setRole(member.role ?? "");
              setEditing(false);
            }
          }}
          className="text-sm font-semibold"
        />
        <Input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role (optional)"
          className="text-[11px]"
        />
        <div className="flex gap-1 justify-end">
          <button
            type="button"
            onClick={() => {
              setName(member.name);
              setRole(member.role ?? "");
              setEditing(false);
            }}
            className="text-[10px] text-ink-tertiary hover:text-ink-secondary px-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onRename(name.trim(), role.trim() || null);
              setEditing(false);
            }}
            className="text-[10px] text-moss-700 hover:underline px-1"
          >
            Save
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="group flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold text-ink-primary whitespace-nowrap">
          {member.name}
        </span>
        {canEdit && (
          <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
            <button
              type="button"
              onClick={() => onMove("up")}
              disabled={isFirst}
              className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-0.5"
              title={prevTitle}
            >
              {prevGlyph}
            </button>
            <button
              type="button"
              onClick={() => onMove("down")}
              disabled={isLast}
              className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-0.5"
              title={nextTitle}
            >
              {nextGlyph}
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10px] text-ink-tertiary hover:text-ink-primary px-0.5"
              title="Rename"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-[10px] text-ink-tertiary hover:text-danger px-0.5"
              title="Remove"
            >
              ×
            </button>
          </span>
        )}
      </div>
      {member.role && (
        <span className="text-[10px] text-ink-tertiary uppercase tracking-wider">
          {member.role}
        </span>
      )}
    </div>
  );
}

function ItemHeader({
  item,
  canEdit,
  isFirst,
  isLast,
  onRename,
  onDelete,
  onMove,
  orientation = "row",
}: {
  item: Item;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRename: (label: string, notes: string | null) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
  // v1.92.1: items are now column headers when the matrix is flipped,
  // so the reorder arrows need to read as left/right rather than up/down.
  orientation?: "row" | "column";
}) {
  const prevGlyph = orientation === "row" ? "▲" : "◀";
  const nextGlyph = orientation === "row" ? "▼" : "▶";
  const prevTitle = orientation === "row" ? "Move up" : "Move left";
  const nextTitle = orientation === "row" ? "Move down" : "Move right";
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [notes, setNotes] = useState(item.notes ?? "");
  if (editing) {
    return (
      <div className="space-y-1">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onRename(label.trim(), notes.trim() || null);
              setEditing(false);
            } else if (e.key === "Escape") {
              setLabel(item.label);
              setNotes(item.notes ?? "");
              setEditing(false);
            }
          }}
          className="text-sm"
        />
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="text-[11px]"
        />
        <div className="flex gap-1 justify-end">
          <button
            type="button"
            onClick={() => {
              setLabel(item.label);
              setNotes(item.notes ?? "");
              setEditing(false);
            }}
            className="text-[10px] text-ink-tertiary hover:text-ink-secondary px-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onRename(label.trim(), notes.trim() || null);
              setEditing(false);
            }}
            className="text-[10px] text-moss-700 hover:underline px-1"
          >
            Save
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="group flex items-baseline justify-between gap-2">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-ink-primary">{item.label}</span>
        {item.notes && (
          <span className="text-[10px] text-ink-tertiary">{item.notes}</span>
        )}
      </div>
      {canEdit && (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={isFirst}
            className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-0.5"
            title={prevTitle}
          >
            {prevGlyph}
          </button>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={isLast}
            className="text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-0.5"
            title={nextTitle}
          >
            {nextGlyph}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[10px] text-ink-tertiary hover:text-ink-primary px-0.5"
            title="Rename"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-[10px] text-ink-tertiary hover:text-danger px-0.5"
            title="Remove"
          >
            ×
          </button>
        </span>
      )}
    </div>
  );
}
