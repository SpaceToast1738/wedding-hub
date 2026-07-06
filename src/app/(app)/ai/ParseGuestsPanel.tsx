"use client";

// v2.1.0 phase 3: paste-a-guest-list surface for the couple.
// Feeds src/app/(app)/ai/actions.ts parseGuestList(), which spawns
// one guest.create proposal per parsed row. Each proposal appears
// in the pending list below and can be Applied to create a real
// household + guest.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { parseGuestList } from "./actions";

export function ParseGuestsPanel() {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | { kind: "idle" }
    | { kind: "success"; count: number; skipped: string[] }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const router = useRouter();

  function run() {
    setResult({ kind: "idle" });
    startTransition(async () => {
      const res = await parseGuestList(text);
      if (res.ok) {
        setResult({ kind: "success", count: res.count, skipped: res.skipped });
        setText("");
        router.refresh();
      } else {
        setResult({ kind: "error", message: res.error });
      }
    });
  }

  return (
    <div className="rounded-md border border-border-soft bg-surface p-4 space-y-2">
      <div className="text-sm text-ink-secondary">
        Paste a guest list from anywhere — an email, a shared doc, a
        spreadsheet — and I&rsquo;ll extract each person into a proposal you
        can Apply below. Couples usually share a household; children get their
        own row. Nothing is written until you click Apply.
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={pending}
        rows={6}
        placeholder="e.g.&#10;Sarah &amp; Tom Fields (BRIDE side) — vegetarian&#10;Nicky Lang, +1 (GROOM), gluten free&#10;The Hendricksons: Jo, Mike, and their toddler Rosa"
        className="w-full rounded-md border border-border-soft bg-canvas text-sm p-2 font-mono resize-y disabled:opacity-60"
      />
      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={run}
          disabled={pending || text.trim().length < 8}
          className="rounded-md bg-ink-primary text-canvas px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {pending ? (
            "Parsing…"
          ) : (
            <span className="inline-flex items-center gap-1">
              <Sparkles aria-hidden className="w-3.5 h-3.5" /> Parse into proposals
            </span>
          )}
        </button>
        <span className="text-xs text-ink-tertiary">
          {text.length} character{text.length === 1 ? "" : "s"}
        </span>
      </div>
      {result.kind === "success" && (
        <div className="text-xs rounded-md border border-emerald-300 bg-emerald-50 text-emerald-900 p-2">
          ✓ Created {result.count} proposal{result.count === 1 ? "" : "s"} —
          scroll down to review.
          {result.skipped.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer">
                {result.skipped.length} row{result.skipped.length === 1 ? "" : "s"} skipped
              </summary>
              <ul className="mt-1 ml-4 list-disc">
                {result.skipped.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {result.kind === "error" && (
        <div className="text-xs text-rose-700">✗ {result.message}</div>
      )}
    </div>
  );
}
