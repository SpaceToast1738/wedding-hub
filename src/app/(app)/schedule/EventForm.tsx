"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const AUDIENCE_OPTIONS = ["everyone", "couple", "party", "guests", "suppliers"];

type Initial = {
  title?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  audience?: string[];
  notes?: string;
};

type Props = {
  initial?: Initial;
  submitLabel?: string;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel?: () => void;
};

export function EventForm({ initial, submitLabel = "Create", onSubmit, onCancel }: Props) {
  const [pending, startTransition] = useTransition();
  const [audience, setAudience] = useState<string[]>(initial?.audience ?? ["everyone"]);
  const [error, setError] = useState<string | null>(null);

  function toggleAudience(value: string) {
    setAudience((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value],
    );
  }

  async function handle(formData: FormData) {
    setError(null);
    formData.delete("audience");
    audience.forEach((a) => formData.append("audience", a));
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
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Title</label>
        <Input name="title" defaultValue={initial?.title ?? ""} required placeholder="e.g. Ceremony" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Start time</label>
          <Input type="datetime-local" name="startTime" defaultValue={initial?.startTime ?? ""} required />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">End time</label>
          <Input type="datetime-local" name="endTime" defaultValue={initial?.endTime ?? ""} />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Location</label>
        <Input name="location" defaultValue={initial?.location ?? ""} placeholder="e.g. Alveston Manor lawn" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Audience</label>
        <div className="flex gap-1.5 flex-wrap">
          {AUDIENCE_OPTIONS.map((opt) => {
            const active = audience.includes(opt);
            return (
              <button
                type="button"
                key={opt}
                onClick={() => toggleAudience(opt)}
                className={[
                  "text-xs px-2.5 py-0.5 rounded-full border whitespace-nowrap transition-colors cursor-pointer capitalize",
                  active
                    ? "bg-moss-500 text-white border-moss-500 font-semibold"
                    : "bg-muted text-ink-secondary border-border-soft hover:bg-canvas",
                ].join(" ")}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">Notes</label>
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
