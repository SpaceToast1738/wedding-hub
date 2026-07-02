"use client";

// v2.1.0 phase 4: AI monthly cap editor.
// Couple-only. Overrides the AI_MONTHLY_CAP_PENCE env var. Setting
// blank clears the DB value and falls back to the env default.

import { useState, useTransition } from "react";
import { updateAiMonthlyCap } from "./wedding-settings-actions";

export function AiBudgetPanel({
  currentPence,
  fallbackPence,
}: {
  currentPence: number | null;
  fallbackPence: number;
}) {
  const [value, setValue] = useState(
    currentPence != null ? (currentPence / 100).toFixed(2) : "",
  );
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saved" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function save() {
    setStatus({ kind: "idle" });
    startTransition(async () => {
      const fd = new FormData();
      fd.append("aiMonthlyCapPounds", value.trim());
      const res = await updateAiMonthlyCap(fd);
      setStatus(res.ok ? { kind: "saved" } : { kind: "error", message: res.error });
    });
  }

  return (
    <div className="rounded-md border border-border-soft bg-surface p-4 space-y-2">
      <div className="text-sm text-ink-secondary">
        Soft monthly cap on Anthropic API spend. AI features refuse to send
        new requests once the pot is empty. Leave blank to fall back to the
        env default of{" "}
        <code>£{(fallbackPence / 100).toFixed(2)}</code>.
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-secondary">£</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          placeholder="30.00"
          className="w-24 rounded-md border border-border-soft bg-canvas text-sm px-2 py-1"
        />
        <span className="text-xs text-ink-tertiary">per month</span>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-ink-primary text-canvas px-3 py-1 text-sm disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {status.kind === "saved" && (
          <span className="text-xs text-emerald-700">✓ saved</span>
        )}
        {status.kind === "error" && (
          <span className="text-xs text-rose-700">{status.message}</span>
        )}
      </div>
    </div>
  );
}
