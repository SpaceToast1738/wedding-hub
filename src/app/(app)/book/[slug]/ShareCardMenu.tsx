"use client";

// v2.14.0: share one Book card with someone who doesn't use the app.
// Copy for WhatsApp (real *bold* / • bullets), copy as plain text, or
// open a print view to save as PDF. Available to every viewer of the
// card — not just editors — because the people who need to SEND a
// brief (best man, maid of honour, the planner) are usually view-only.

import { useEffect, useRef, useState, useTransition } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { exportBookCard } from "../share-actions";

export function ShareCardMenu({ subsectionId, title }: { subsectionId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function copy(format: "whatsapp" | "text") {
    startTransition(async () => {
      try {
        const text = await exportBookCard(subsectionId, format);
        await navigator.clipboard.writeText(text);
        notify("success", format === "whatsapp" ? "Copied — paste into WhatsApp" : "Copied as plain text");
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't copy the card");
      }
      setOpen(false);
    });
  }

  const item =
    "w-full text-left px-3 py-2 text-ink-secondary hover:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div ref={ref} className="relative inline-block no-print">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Share ${title}`}
        title="Copy for WhatsApp, copy as text, or save as PDF"
      >
        <Share2 aria-hidden className="w-3.5 h-3.5 mr-1" />
        {pending ? "Copying…" : "Share"}
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 mt-1 z-20 w-56 rounded-md border border-border-soft bg-surface shadow-lg py-1 text-xs"
        >
          <button type="button" role="menuitem" onClick={() => copy("whatsapp")} disabled={pending} className={item}>
            Copy for WhatsApp
          </button>
          <button type="button" role="menuitem" onClick={() => copy("text")} disabled={pending} className={item}>
            Copy as plain text
          </button>
          <a
            role="menuitem"
            href={`/book/print/${subsectionId}`}
            target="_blank"
            rel="noopener"
            onClick={() => setOpen(false)}
            className={`${item} block`}
          >
            Print / save as PDF ↗
          </a>
        </div>
      )}
    </div>
  );
}
