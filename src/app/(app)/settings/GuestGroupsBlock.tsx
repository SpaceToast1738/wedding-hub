"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  createGuestGroup,
  deleteGuestGroup,
  reorderGuestGroup,
  toggleGuestGroupMember,
  updateGuestGroup,
} from "./guest-group-actions";

type Side = "BRIDE" | "GROOM" | "BOTH";

const SIDE_LABELS: Record<Side, string> = {
  BRIDE: "Bride",
  GROOM: "Groom",
  BOTH: "Both",
};

// v1.42.0: GuestGroup admin panel. Couple-only — same gating as the
// PermissionGroup panel above. Bundles wedding *guests* (rows in
// the Guest table), not app users. Optional colour per group is
// used by the seating canvas for colour-coded rows / dots.
//
// Built-ins (read-only): bride-side / groom-side / both-sides,
// computed from Guest.side. Custom groups are couple-defined.

type GuestRow = { id: string; name: string };

type GroupRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  colour: string | null;
  side: Side;
  order: number;
  members: GuestRow[];
};

type BuiltinRow = {
  slug: string;
  name: string;
  members: GuestRow[];
};

export function GuestGroupsBlock({
  groups,
  builtins,
  allGuests,
}: {
  groups: GroupRow[];
  builtins: BuiltinRow[];
  allGuests: GuestRow[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  function onAdd(fd: FormData) {
    startTransition(async () => {
      const res = await createGuestGroup(fd);
      if (res.ok) {
        notify("success", "Group added");
        setAdding(false);
      } else {
        notify("error", res.error);
      }
    });
  }

  function onSave(id: string, fd: FormData) {
    startTransition(async () => {
      const res = await updateGuestGroup(id, fd);
      if (res.ok) {
        notify("success", "Saved");
        setEditingId(null);
      } else {
        notify("error", res.error);
      }
    });
  }

  async function onDelete(id: string, name: string, count: number) {
    if (!(await confirm({
      title: `Delete "${name}"?`,
      body: count > 0
        ? `${count} guest link${count === 1 ? "" : "s"} will be removed. The guests themselves stay.`
        : undefined,
      confirmLabel: "Delete",
      tone: "danger",
    }))) return;
    startTransition(async () => {
      const res = await deleteGuestGroup(id);
      if (res.ok) notify("success", "Deleted");
      else notify("error", res.error);
    });
  }

  function onToggleMember(groupId: string, guestId: string, on: boolean) {
    startTransition(async () => {
      const res = await toggleGuestGroupMember({ groupId, guestId, on });
      if (!res.ok) notify("error", res.error);
    });
  }

  function onReorder(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const res = await reorderGuestGroup({ id, direction });
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft flex items-baseline justify-between gap-3">
        <div>
          {/* v2.5.0 (design pass #3): renamed from "Guest groups" —
              sitting next to PermissionGroupsBlock's near-identical
              chrome made the two easy to confuse (one governs app
              access permissions, this one categorises wedding guests
              for seating). Now lives in Customisation, not Access &
              members. */}
          <h2 className="text-sm font-semibold text-ink-primary">Guest seating groups</h2>
          <p className="text-xs text-ink-tertiary mt-0.5">
            Bundle <strong>wedding guests</strong> for organising the ceremony seating
            plan, RSVP follow-ups, and after-party invites. Each custom group can carry
            a colour — the ceremony seating canvas uses it to colour-code rows. Built-in
            side-based groups are computed from each guest&apos;s assigned side.
          </p>
        </div>
        {!adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)} disabled={pending}>
            + Add group
          </Button>
        )}
      </header>
      <div className="px-4 py-3 border-b border-border-soft bg-canvas/40">
        <h3 className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
          Built-in (read-only)
        </h3>
        <ul className="space-y-1 text-sm">
          {builtins.map((b) => (
            <li key={b.slug} className="flex items-baseline gap-2">
              {/* v2.5.0 (design pass #10): the raw `builtin:<slug>`
                  identifier had no value to a user browsing the list —
                  moved to a title tooltip instead of a visible span. */}
              <span
                className="text-ink-primary font-medium flex-1 min-w-0 truncate"
                title={`builtin:${b.slug}`}
              >
                {b.name}
              </span>
              <span className="text-[10px] text-ink-tertiary tabular-nums w-20 text-right">
                {b.members.length} {b.members.length === 1 ? "guest" : "guests"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <ul className="divide-y divide-border-soft">
        {groups.map((g, idx) =>
          editingId === g.id ? (
            <li key={g.id} className="px-4 py-3">
              <GroupEditForm
                group={g}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSubmit={(fd) => onSave(g.id, fd)}
              />
            </li>
          ) : (
            <li key={g.id} className="px-4 py-2.5">
              <div className="flex items-baseline gap-3">
                {/* v1.48.0: reorder buttons. The first/last group can
                    only nudge inward. Order drives the seating
                    allocator's fill priority. */}
                {/* v2.5.0 (design pass #10): min-h/min-w-[40px] mobile
                    touch floor, reverting to the dense desktop size at
                    640px+ — same convention as Button/Tag. These were
                    previously just px-0.5 with no vertical padding, well
                    under any usable tap target. */}
                <span className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onReorder(g.id, "up")}
                    disabled={pending || idx === 0}
                    aria-label="Move up"
                    title="Higher priority — fills sooner"
                    className="min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-0.5"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => onReorder(g.id, "down")}
                    disabled={pending || idx === groups.length - 1}
                    aria-label="Move down"
                    title="Lower priority — fills later"
                    className="min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center text-[10px] text-ink-tertiary hover:text-ink-primary disabled:opacity-30 px-0.5"
                  >
                    ▼
                  </button>
                </span>
                <button
                  type="button"
                  onClick={() => setOpenGroupId(openGroupId === g.id ? null : g.id)}
                  className="text-sm font-medium text-ink-primary hover:text-moss-700 flex-1 min-w-0 truncate text-left flex items-center gap-2"
                  title={`Click to expand member list (group:${g.slug})`}
                >
                  <span aria-hidden>{openGroupId === g.id ? "▾" : "▸"}</span>
                  {g.colour && (
                    <span
                      aria-hidden
                      title={g.colour}
                      style={{ backgroundColor: g.colour }}
                      className="inline-block w-3.5 h-3.5 rounded-full border border-border-soft"
                    />
                  )}
                  <span>{g.name}</span>
                </button>
                <span
                  className={`text-[10px] uppercase tracking-wider font-semibold flex-shrink-0 ${
                    g.side === "BRIDE"
                      ? "text-rose-700"
                      : g.side === "GROOM"
                        ? "text-moss-700"
                        : "text-ink-tertiary"
                  }`}
                  title={`Side constraint for ceremony allocator: ${SIDE_LABELS[g.side]}`}
                >
                  {SIDE_LABELS[g.side]}
                </span>
                <span className="text-[10px] text-ink-tertiary tabular-nums w-20 text-right">
                  {g.members.length} {g.members.length === 1 ? "guest" : "guests"}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(g.id)} disabled={pending}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${g.name}`}
                  onClick={() => onDelete(g.id, g.name, g.members.length)}
                  disabled={pending}
                >
                  ×
                </Button>
              </div>
              {openGroupId === g.id && (
                <div className="mt-2 ml-5 pl-3 border-l border-border-soft">
                  {g.description && (
                    <p className="text-xs text-ink-tertiary mb-2 italic">{g.description}</p>
                  )}
                  <div className="text-[10px] uppercase tracking-wider text-ink-tertiary font-bold mb-1.5">
                    Members ({g.members.length} of {allGuests.length})
                  </div>
                  {allGuests.length === 0 ? (
                    <p className="text-xs text-ink-tertiary italic">
                      No guests in the database yet. Add some on /guests first.
                    </p>
                  ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-72 overflow-y-auto">
                      {allGuests.map((u) => {
                        const on = g.members.some((m) => m.id === u.id);
                        return (
                          <li key={u.id}>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={(e) =>
                                  onToggleMember(g.id, u.id, e.target.checked)
                                }
                                disabled={pending}
                                className="accent-moss-500"
                              />
                              <span className={on ? "text-ink-primary" : "text-ink-tertiary"}>
                                {u.name}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ),
        )}
        {groups.length === 0 && !adding && (
          <li className="px-4 py-3 text-sm text-ink-tertiary italic">
            No custom guest groups yet. Add one to bundle a subset of guests with a
            shared colour for the seating plan.
          </li>
        )}
        {adding && (
          <li className="px-4 py-3 bg-canvas/30">
            <GroupEditForm
              group={null}
              pending={pending}
              onCancel={() => setAdding(false)}
              onSubmit={onAdd}
            />
          </li>
        )}
      </ul>
    </section>
  );
}

function GroupEditForm({
  group,
  pending,
  onCancel,
  onSubmit,
}: {
  group: GroupRow | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  // Local state for colour so the swatch + hex input stay in sync.
  const [colour, setColour] = useState<string>(group?.colour ?? "");
  const [side, setSide] = useState<Side>(group?.side ?? "BOTH");

  return (
    <form action={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Name
        </label>
        <input
          name="name"
          defaultValue={group?.name ?? ""}
          required
          autoFocus
          maxLength={120}
          placeholder="e.g. Bryony's family"
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Slug
        </label>
        <input
          name="slug"
          defaultValue={group?.slug ?? ""}
          maxLength={60}
          placeholder="auto from name if empty"
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500 font-mono"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Description (optional)
        </label>
        <input
          name="description"
          defaultValue={group?.description ?? ""}
          maxLength={2000}
          placeholder="What this group is for"
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Side (ceremony allocator)
        </label>
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as Side)}
          disabled={pending}
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500"
          title="BRIDE → fills LEFT seats only; GROOM → RIGHT only; BOTH → either side, balanced"
        >
          <option value="BRIDE">Bride (left side only)</option>
          <option value="GROOM">Groom (right side only)</option>
          <option value="BOTH">Both (either side)</option>
        </select>
        {/* Hidden field carries the value into the form action. */}
        <input type="hidden" name="side" value={side} />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Colour (used in seating plan)
        </label>
        <div className="flex items-center gap-2">
          {/* Native HTML5 colour swatch — opens browser picker. The
              hidden hex input below carries the value to the form. */}
          <input
            type="color"
            value={colour && /^#[0-9a-fA-F]{6}$/.test(colour) ? colour : "#a3c9a8"}
            onChange={(e) => setColour(e.target.value)}
            disabled={pending}
            aria-label="Colour swatch"
            className="w-9 h-8 cursor-pointer bg-transparent border border-border-soft rounded-sm p-0"
          />
          <input
            type="text"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
            placeholder="#a3c9a8 (or blank for none)"
            maxLength={20}
            disabled={pending}
            className="flex-1 text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2 py-1 outline-none focus:border-moss-500 font-mono"
          />
          {colour && (
            <button
              type="button"
              onClick={() => setColour("")}
              disabled={pending}
              className="text-[10px] uppercase tracking-wider text-ink-tertiary hover:text-ink-primary px-2"
            >
              Clear
            </button>
          )}
          {/* Hidden field carries the canonical value into the form action. */}
          <input type="hidden" name="colour" value={colour} />
        </div>
      </div>
      <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {group ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
