"use client";

// v2.1.0 phase 5: draft an RSVP reminder for one guest. Couple-only.
// Not a proposal — just returns text the couple can copy into their
// email/SMS client. The AI never sends anything.

import { useState, useTransition } from "react";
import { draftRsvpReminder } from "@/app/(app)/ai/actions";

export function DraftRsvpReminderButton({
  guestId,
  rsvpStatus,
}: {
  guestId: string;
  rsvpStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Show the button only when a reminder makes sense.
  if (rsvpStatus !== "PENDING" && rsvpStatus !== "MAYBE") return null;

  function run() {
    setText(null);
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await draftRsvpReminder(guestId);
      if (res.ok) setText(res.text);
      else setError(res.error);
    });
  }

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some browsers block clipboard writes over http — silent
      // fallback: user can still select-all the textarea manually.
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700 disabled:opacity-60"
      >
        {pending ? "Drafting…" : "✨ Draft RSVP reminder"}
      </button>
      {text && (
        <div className="mt-2 space-y-2 rounded-md border border-emerald-300 bg-emerald-50 p-3">
          <div className="text-xs text-emerald-900 font-medium">
            Draft — edit before sending
          </div>
          <textarea
            defaultValue={text}
            rows={5}
            className="w-full rounded-md border border-border-soft bg-canvas text-sm p-2"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="text-xs rounded-md bg-ink-primary text-canvas px-2 py-1"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={run}
              disabled={pending}
              className="text-xs rounded-md border border-border-soft px-2 py-1 disabled:opacity-60"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-2 text-xs text-rose-700">✗ {error}</div>
      )}
    </div>
  );
}
