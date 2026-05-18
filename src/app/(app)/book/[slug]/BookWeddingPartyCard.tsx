"use client";

// v1.92.0: WEDDING_PARTY card editor — matrix tracker. Items as rows,
// people as columns, each cell is a status (Need / Have / Already
// own / N/A). Designed for "are the bridesmaids ready?" rollup.
//
// v1.92.1: matrix flipped — people as rows, items as columns.
//
// v1.99.1: matrix + notes lifted into the per-card component registry
// via <ReorderableCardBody>. A "↕ Layout" toggle gated the reorder
// chrome since the editor used inline-save throughout.
//
// v1.99.3: full design pass to match the v1.96.4 OUTFIT card pattern.
// - groupLabel input dropped entirely — the CardChrome title (e.g.
//   "Bridesmaids") already identifies the card; carrying both was
//   redundant duplicate identity. (The DB column stays; it's just
//   no longer surfaced. Old values aren't migrated either — the
//   couple can ignore it.)
// - Stats tile row added at the top: Sorted (X/Y) · People (N) ·
//   Items (N) — same StatTile component shape as OUTFIT's Sorted /
//   Budget / Items-total trio.
// - View / Edit toggle. Pre-v1.99.3 the editor was inline-save: cells
//   were dropdowns, member/item rename + reorder + delete affordances,
//   add buttons, and notes textarea were all visible whenever canEdit.
//   Now everything editable hides until the user clicks Edit; view
//   mode shows pills + static names + a readonly notes paragraph.
//   Cells still save individually on change (no draft) — Save just
//   exits edit mode. Notes uses a draft so a half-typed edit can be
//   cancelled. The v1.99.1 layoutEditing toggle is gone; reorder
//   chrome rides on the new `editing` flag like every other kind.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MentionableTextarea } from "@/components/ui/MentionableTextarea";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { CardChrome } from "./CardChrome";
import type { LinkedTaskRow } from "./CardLinkedTasksPanel";
import type { UserOpt } from "@/app/(app)/tasks/AddTaskToggle";
import { ReorderableCardBody, type CardComponent } from "./ReorderableCardBody";
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
  setBookSubsectionComponentHidden,
  setBookSubsectionComponentOrder,
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
  // v1.99.1: per-card body layout.
  componentOrder: string[];
  hiddenComponents: string[];
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
  const [editing, setEditing] = useState(false);
  // v1.99.3: notes carry a draft so Cancel can revert. v1.98.1
  // useEffect gate (if (!editing)) so router.refresh during edit
  // mode doesn't wipe the draft.
  const [notesDraft, setNotesDraft] = useState(card.notes ?? "");
  useEffect(() => {
    if (!editing) setNotesDraft(card.notes ?? "");
  }, [card.notes, editing]);
  const router = useRouter();
  const confirm = useConfirm();

  // Local optimistic snapshots of the matrix so cell clicks feel
  // instant. Synced on each prop change.
  const [optimisticCells, setOptimisticCells] = useState<Cell[]>(card.cells);
  if (card.cells !== referenceForCells.current) {
    referenceForCells.current = card.cells;
  }

  function cancel() {
    setNotesDraft(card.notes ?? "");
    setEditing(false);
  }

  function save() {
    // Notes is the only draft-backed field; cells save themselves on
    // click, and member / item renames save inline. If notes haven't
    // changed, just exit edit mode.
    const nextNotes = notesDraft.trim() || null;
    if (nextNotes === (card.notes ?? null)) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      // groupLabel kept as-is — column still exists but the editor no
      // longer surfaces it (v1.99.3).
      const res = await saveWeddingPartyCardHeader(subsectionId, {
        groupLabel: card.groupLabel,
        notes: nextNotes,
      });
      if (res.ok) {
        notify("success", "Saved");
        setEditing(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  function setCell(memberId: string, itemId: string, status: Status) {
    setOptimisticCells((prev) => {
      const filtered = prev.filter((c) => !(c.memberId === memberId && c.itemId === itemId));
      if (status === "NEED") return filtered;
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

  // v1.99.1: per-card body layout handlers.
  function reorderComponents(next: string[]) {
    startTransition(async () => {
      const res = await setBookSubsectionComponentOrder(subsectionId, next);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }
  function toggleComponentHidden(componentId: string, hidden: boolean) {
    startTransition(async () => {
      const res = await setBookSubsectionComponentHidden(subsectionId, componentId, hidden);
      if (res.ok) router.refresh();
      else notify("error", res.error);
    });
  }

  // Rollups for the stats tiles.
  const totalCells = card.members.length * card.items.length;
  const sortedCount = optimisticCells.filter(
    (c) => c.status === "HAVE" || c.status === "ALREADY_OWN" || c.status === "N_A",
  ).length;

  // v1.99.3: stats tiles — Sorted / People / Items — matching the
  // OUTFIT card's tile row (v1.96.4 StatTile shape).
  const statsNode = (
    <div className="grid grid-cols-3 gap-2">
      <StatTile
        label="Sorted"
        value={totalCells === 0 ? "—" : `${sortedCount} / ${totalCells}`}
      />
      <StatTile
        label="People"
        value={String(card.members.length)}
      />
      <StatTile
        label="Items"
        value={String(card.items.length)}
      />
    </div>
  );

  // Matrix renders pills in view mode, dropdowns in edit mode. Header
  // affordances (rename / reorder / delete / add buttons) only render
  // when `editing` — view mode is purely informational.
  const matrixNode = (
    <div className="space-y-3">
      {card.members.length === 0 || card.items.length === 0 ? (
        <p className="text-xs text-ink-tertiary italic">
          {editing
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
                      canEdit={editing}
                      isFirst={idx === 0}
                      isLast={idx === card.items.length - 1}
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
                      canEdit={editing}
                      isFirst={idx === 0}
                      isLast={idx === card.members.length - 1}
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
                        {editing ? (
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

      {/* v1.99.3: Add-row + Add-column buttons hidden in view mode. */}
      {editing && (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={addMember} disabled={pending}>
            + Add person (row)
          </Button>
          <Button variant="ghost" size="sm" onClick={addItem} disabled={pending}>
            + Add item (column)
          </Button>
        </div>
      )}
    </div>
  );

  const notesNode = editing ? (
    <div>
      <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
        Notes
      </label>
      <MentionableTextarea
        value={notesDraft}
        onChange={(e) => setNotesDraft(e.target.value)}
        rows={2}
        disabled={pending}
        placeholder="Anything worth remembering about the group — colour scheme, suppliers, gift list."
        className="w-full text-sm bg-surface border border-border-soft rounded-sm px-2.5 py-1.5 text-ink-primary outline-none focus:border-moss-500 resize-y"
      />
    </div>
  ) : card.notes ? (
    <div>
      <strong className="block text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1">
        Notes
      </strong>
      <p className="text-sm text-ink-secondary whitespace-pre-wrap">{card.notes}</p>
    </div>
  ) : (
    <p className="text-xs text-ink-tertiary italic">No notes.</p>
  );

  const components: CardComponent[] = [
    {
      id: "stats",
      label: "Stats",
      node: statsNode,
    },
    {
      id: "matrix",
      label: "Matrix",
      node: matrixNode,
      // Hiding the matrix leaves a WEDDING_PARTY card with nothing
      // tracked — empty chrome. Keep it pinned.
      alwaysVisible: true,
    },
    { id: "notes", label: "Notes", node: notesNode },
  ];

  // v1.99.3: silence "unused import" warnings now that the inline
  // groupLabel input is gone — Input stays imported only because it's
  // referenced by the MemberHeader / ItemHeader edit forms.
  void Input;

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
      hideHousekeeping={editing}
      actions={
        canEdit
          ? editing
            ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={save} disabled={pending}>
                  Save changes
                </Button>
              </>
            )
            : (
              <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )
          : undefined
      }
    >
      <ReorderableCardBody
        components={components}
        savedOrder={card.componentOrder}
        hiddenIds={card.hiddenComponents}
        editMode={editing}
        pending={pending}
        onReorder={reorderComponents}
        onToggleHidden={toggleComponentHidden}
      />
    </CardChrome>
  );
}

// v1.99.3: small bordered stat tile — copy of the helper inside
// BookOutfitCard. Duplicated rather than extracted because the two
// callers sit alongside each other and have minor styling drift; a
// shared module isn't earning its keep yet.
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas border border-border-soft rounded-md px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-ink-tertiary font-bold">
        {label}
      </div>
      <div className="text-sm font-semibold text-ink-primary tabular-nums">{value}</div>
    </div>
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
