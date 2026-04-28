"use client";

// v1.20.0: couple-only Settings panel for editing the wedding-details
// singleton (date · venue · couple labels). Non-couple users see the
// values read-only so they understand what's set without being able
// to edit. Server-side gate enforces couple-only regardless of UI.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { notify } from "@/lib/notify";
import { updateWeddingSettings } from "./wedding-settings-actions";

type Initial = {
  weddingDate: string; // YYYY-MM-DDTHH:mm for <input type="datetime-local">
  ceremonyTime: string;
  venue: string;
  venueAddress: string;
  coupleLabel: string;
  coupleShort: string;
  brideFirst: string;
  groomFirst: string;
};

export function WeddingSettingsPanel({
  initial,
  isCouple,
}: {
  initial: Initial;
  isCouple: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateWeddingSettings(formData);
        setEditing(false);
        notify("success", "Wedding details updated");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save");
      }
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md p-5 shadow-sm">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink-primary">Wedding details</h2>
          <p className="text-[11px] text-ink-tertiary">
            Date, venue, couple names. Read across the app — Today page, schedule, catering brief, sign-in email.
          </p>
        </div>
        {isCouple && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </header>

      {!editing ? (
        <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-1.5 gap-x-4 text-sm">
          <Row label="Date" value={formatDateForRead(initial.weddingDate)} />
          <Row label="Ceremony" value={initial.ceremonyTime} />
          <Row label="Venue" value={initial.venue} />
          {initial.venueAddress && <Row label="Address" value={initial.venueAddress} />}
          <Row label="Couple (long)" value={initial.coupleLabel} />
          <Row label="Couple (short)" value={initial.coupleShort} />
          <Row label="Bride" value={initial.brideFirst} />
          <Row label="Groom" value={initial.groomFirst} />
        </dl>
      ) : (
        <form action={handle} className="space-y-3">
          <Field label="Date" name="weddingDate" type="datetime-local" defaultValue={initial.weddingDate} required />
          <Field label="Ceremony label" name="ceremonyTime" defaultValue={initial.ceremonyTime} required />
          <Field label="Venue" name="venue" defaultValue={initial.venue} required />
          <Field label="Venue address" name="venueAddress" defaultValue={initial.venueAddress} />
          <Field label="Couple label (long)" name="coupleLabel" defaultValue={initial.coupleLabel} required hint="Shown on the schedule letterhead and sidebar." />
          <Field label="Couple label (short)" name="coupleShort" defaultValue={initial.coupleShort} required hint="Shown inside the homepage countdown card." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bride first name" name="brideFirst" defaultValue={initial.brideFirst} required />
            <Field label="Groom first name" name="groomFirst" defaultValue={initial.groomFirst} required />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider">{label}</dt>
      <dd className="text-ink-primary">{value}</dd>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
        {label}
      </label>
      <Input name={name} type={type} defaultValue={defaultValue} required={required} />
      {hint && <p className="text-[10px] text-ink-tertiary mt-0.5">{hint}</p>}
    </div>
  );
}

// `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm` — no timezone.
// The parent component computes this once from the DB Date.
function formatDateForRead(localIsoLike: string): string {
  if (!localIsoLike) return "—";
  // `localIsoLike` came from the parent as `YYYY-MM-DDTHH:mm`. Reformat
  // for human display: "26 September 2026 · 14:00".
  const d = new Date(localIsoLike);
  if (Number.isNaN(d.getTime())) return localIsoLike;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}
