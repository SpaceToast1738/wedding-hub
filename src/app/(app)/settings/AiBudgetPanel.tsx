"use client";

// v2.1.0 phase 4: AI monthly cap editor.
// Couple-only. Overrides the AI_MONTHLY_CAP_PENCE env var. Setting
// blank clears the DB value and falls back to the env default.
//
// v2.5.0 (design pass #7): swapped hardcoded emerald/rose palette
// colors for the semantic success/danger tokens, replaced the hand-
// rolled Save button with the shared Button component, and softened
// the copy's "env default" phrasing.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
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
        A soft monthly limit on AI spend. Once it&apos;s used up, AI features
        pause until the next month rather than keep spending. Leave blank to
        use the default of <code>£{(fallbackPence / 100).toFixed(2)}</code>.
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
          aria-label="Monthly AI spend cap in pounds"
          className="w-24 rounded-md border border-border-soft bg-canvas text-sm px-2 py-1"
        />
        <span className="text-xs text-ink-tertiary">per month</span>
        <Button type="button" variant="primary" size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {status.kind === "saved" && (
          <span className="text-xs text-success">✓ saved</span>
        )}
        {status.kind === "error" && (
          <span className="text-xs text-danger">{status.message}</span>
        )}
      </div>
    </div>
  );
}
