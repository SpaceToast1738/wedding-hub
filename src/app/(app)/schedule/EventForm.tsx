"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type UserOpt = { id: string; name: string | null; email: string };
export type GroupOpt = { ref: string; name: string; memberCount: number };

type Initial = {
  title?: string;
  startDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endDate?: string; // YYYY-MM-DD
  endTime?: string; // HH:MM
  allDay?: boolean;
  location?: string;
  // v1.41.0: polymorphic refs replace the v1.27.1 attendeeIds.
  // Each entry is "user:<id>" | "builtin:<slug>" | "group:<slug>".
  attendeeRefs?: string[];
  notes?: string;
};

type Props = {
  initial?: Initial;
  users?: UserOpt[];
  /** v1.41.0: built-in + custom groups available to pick. The picker
   *  surfaces these above the per-user chips so the couple thinks
   *  in groups first ("everyone", "wedding party") before reaching
   *  for individuals. */
  groups?: GroupOpt[];
  submitLabel?: string;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel?: () => void;
};

// v1.27.1: split date + time inputs.
// v1.41.0: attendees became polymorphic — multi-select mixes group
// refs ("builtin:everyone", "group:after-party") with individual
// users ("user:<id>"). Form posts `attendeeRefs[]` directly; the
// server action accepts both shapes for one-release back-compat.
export function EventForm({
  initial,
  users = [],
  groups = [],
  submitLabel = "Create",
  onSubmit,
  onCancel,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [allDay, setAllDay] = useState<boolean>(initial?.allDay ?? false);
  const [attendeeRefs, setAttendeeRefs] = useState<string[]>(initial?.attendeeRefs ?? []);
  const [error, setError] = useState<string | null>(null);
  // v1.60.0 (P3): dirty-check — `allDay` and `attendeeRefs` are
  // controlled state, the rest of the inputs are uncontrolled. We
  // mirror both sources into a single dirty flag: explicit setters
  // for the two controlled fields, form-level onChange for the
  // uncontrolled inputs.
  const [dirty, setDirty] = useState(!initial);

  function toggleRef(ref: string) {
    setAttendeeRefs((prev) =>
      prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref],
    );
    setDirty(true);
  }

  async function handle(formData: FormData) {
    setError(null);
    formData.set("allDay", allDay ? "true" : "false");
    formData.delete("attendeeRefs");
    attendeeRefs.forEach((ref) => formData.append("attendeeRefs", ref));
    startTransition(async () => {
      try {
        await onSubmit(formData);
        setDirty(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form action={handle} onChange={() => setDirty(true)} className="space-y-3">
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Title
        </label>
        <Input name="title" defaultValue={initial?.title ?? ""} required placeholder="e.g. Ceremony" />
      </div>

      <div>
        <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => { setAllDay(e.target.checked); setDirty(true); }}
            className="accent-moss-500"
          />
          <span className="text-ink-secondary">All day</span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
            Start date
          </label>
          <Input
            type="date"
            name="startDate"
            defaultValue={initial?.startDate ?? ""}
            required
          />
        </div>
        {!allDay && (
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Start time
            </label>
            <Input
              type="time"
              name="startTime"
              defaultValue={initial?.startTime ?? ""}
              placeholder="14:00"
            />
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
            End date
          </label>
          <Input
            type="date"
            name="endDate"
            defaultValue={initial?.endDate ?? ""}
            placeholder="optional"
          />
        </div>
        {!allDay && (
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              End time
            </label>
            <Input
              type="time"
              name="endTime"
              defaultValue={initial?.endTime ?? ""}
              placeholder="optional"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Location
        </label>
        <Input
          name="location"
          defaultValue={initial?.location ?? ""}
          placeholder="e.g. Alveston Manor lawn"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1.5">
          Attendees
        </label>
        {groups.length === 0 && users.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">No users or groups to pick from.</p>
        ) : (
          <>
            {groups.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-tertiary mb-1">
                  Groups
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {groups.map((g) => {
                    const active = attendeeRefs.includes(g.ref);
                    return (
                      <button
                        type="button"
                        key={g.ref}
                        onClick={() => toggleRef(g.ref)}
                        className={[
                          "text-xs px-2.5 py-0.5 rounded-full border whitespace-nowrap transition-colors cursor-pointer",
                          active
                            ? "bg-marigold-700 text-white border-marigold-700 font-semibold"
                            : "bg-canvas text-ink-secondary border-border-soft hover:border-marigold-300",
                        ].join(" ")}
                        title={g.ref}
                      >
                        {g.name} <span className="opacity-70">({g.memberCount})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {users.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-tertiary mb-1">
                  Individuals
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {users.map((u) => {
                    const ref = `user:${u.id}`;
                    const active = attendeeRefs.includes(ref);
                    const display = u.name ?? u.email.split("@")[0];
                    return (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => toggleRef(ref)}
                        className={[
                          "text-xs px-2.5 py-0.5 rounded-full border whitespace-nowrap transition-colors cursor-pointer",
                          active
                            ? "bg-moss-500 text-white border-moss-500 font-semibold"
                            : "bg-canvas text-ink-secondary border-border-soft hover:border-moss-300",
                        ].join(" ")}
                        title={u.email}
                      >
                        {display}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
          Notes
        </label>
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          rows={3}
          className="w-full text-sm bg-surface text-ink-primary border border-border-soft rounded-sm px-2.5 py-1.5 outline-none focus:border-moss-500"
          placeholder="Anything that needs to be remembered…"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" size="sm" disabled={pending || !dirty}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
