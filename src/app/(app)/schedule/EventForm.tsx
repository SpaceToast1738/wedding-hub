"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type UserOpt = { id: string; name: string | null; email: string };

type Initial = {
  title?: string;
  startDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endDate?: string; // YYYY-MM-DD
  endTime?: string; // HH:MM
  allDay?: boolean;
  location?: string;
  attendeeIds?: string[];
  notes?: string;
};

type Props = {
  initial?: Initial;
  users?: UserOpt[];
  submitLabel?: string;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel?: () => void;
};

// v1.27.1: split date + time inputs (was a single datetime-local
// per field, which was awkward on desktop). Time fields use
// type="time" — typeable on desktop, native picker on mobile. New
// "All day" checkbox hides the time inputs and tags the event so
// renderers display the date only.
//
// Audience field replaced by an attendee multi-select reading from
// the actual user list (couple + planners + wedding party). The
// legacy `audience` column stays on the schema for back-compat read
// but is no longer surfaced in the UI.
export function EventForm({ initial, users = [], submitLabel = "Create", onSubmit, onCancel }: Props) {
  const [pending, startTransition] = useTransition();
  const [allDay, setAllDay] = useState<boolean>(initial?.allDay ?? false);
  const [attendeeIds, setAttendeeIds] = useState<string[]>(initial?.attendeeIds ?? []);
  const [error, setError] = useState<string | null>(null);

  function toggleAttendee(userId: string) {
    setAttendeeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  async function handle(formData: FormData) {
    setError(null);
    formData.set("allDay", allDay ? "true" : "false");
    formData.delete("attendeeIds");
    attendeeIds.forEach((id) => formData.append("attendeeIds", id));
    startTransition(async () => {
      try {
        await onSubmit(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form action={handle} className="space-y-3">
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
            onChange={(e) => setAllDay(e.target.checked)}
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
        {users.length === 0 ? (
          <p className="text-xs text-ink-tertiary italic">No users to pick from.</p>
        ) : (
          <div className="flex gap-1.5 flex-wrap">
            {users.map((u) => {
              const active = attendeeIds.includes(u.id);
              const display = u.name ?? u.email.split("@")[0];
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => toggleAttendee(u.id)}
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
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
