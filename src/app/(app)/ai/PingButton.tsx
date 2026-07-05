"use client";

import { useState } from "react";

type PingResult =
  | { ok: true; model: string; costPence: number; reply: string }
  | { ok: false; error: string };

export function PingButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PingResult | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/ping", { method: "POST" });
      const body = (await res.json()) as PingResult;
      setResult(body);
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-md border border-border-soft bg-surface px-3 py-1.5 text-sm text-ink-primary hover:bg-muted disabled:opacity-60"
      >
        {busy ? "Pinging…" : "Send test ping"}
      </button>
      {result && (
        <div className="mt-3 text-xs">
          {result.ok ? (
            <div className="text-moss-700">
              <div>
                {/* v2.5.0: was `(costPence / 100).toFixed(2)` labelled
                    "p" — that divides pence into pounds but keeps the
                    pence unit label, showing a number 100x too small.
                    Matches UsageDashboard's £-formatted pence() helper. */}
                ✓ <code>{result.model}</code> replied &ldquo;{result.reply}&rdquo; · £{(result.costPence / 100).toFixed(2)} spent.
              </div>
            </div>
          ) : (
            <div className="text-danger">
              ✗ {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
