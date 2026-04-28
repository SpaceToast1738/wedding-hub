"use client";

import { useEffect, useState } from "react";
import { subscribeToasts, type ToastEvent } from "@/lib/notify";

type Toast = ToastEvent & { id: number };

const ACCENT: Record<ToastEvent["level"], string> = {
  success: "border-moss-100 bg-moss-50 text-moss-700",
  error: "border-danger-border bg-danger-bg text-danger",
  warn: "border-marigold-700/30 bg-marigold-100 text-marigold-700",
  info: "border-border-soft bg-surface text-ink-secondary",
};

const ICON: Record<ToastEvent["level"], string> = {
  success: "✓",
  error: "⚠",
  warn: "!",
  info: "i",
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return subscribeToasts((ev) => {
      const id = Date.now() + Math.random();
      const ttl = ev.ttlMs ?? (ev.level === "error" ? 6000 : 3500);
      setToasts((prev) => [...prev, { ...ev, id }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ttl);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      // Bottom-right on desktop, top-centre-ish on mobile (avoiding the
      // mobile tab bar). Pointer-events on individual toasts so the
      // wrapper itself doesn't block interaction with the page.
      className="fixed inset-0 pointer-events-none z-[100] flex flex-col items-end justify-end p-4 gap-2 sm:items-end sm:justify-end"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.level === "error" ? "alert" : "status"}
          className={[
            "pointer-events-auto max-w-sm w-full sm:w-auto rounded-md border shadow-md px-4 py-2.5 text-xs flex items-start gap-2",
            ACCENT[t.level],
          ].join(" ")}
        >
          <span className="font-bold flex-shrink-0">{ICON[t.level]}</span>
          <span className="flex-1 whitespace-pre-wrap">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
