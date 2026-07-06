"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, type LucideIcon } from "lucide-react";
import { subscribeToasts, type ToastEvent } from "@/lib/notify";

type Toast = ToastEvent & { id: number };

const ACCENT: Record<ToastEvent["level"], string> = {
  success: "border-moss-100 bg-moss-50 text-moss-700",
  error: "border-danger-border bg-danger-bg text-danger",
  warn: "border-marigold-700/30 bg-marigold-100 text-marigold-700",
  info: "border-border-soft bg-surface text-ink-secondary",
};

// v2.6.7 (icon migration pilot): was a Record<level, string> of bare
// Unicode glyphs (✓⚠!i). Icons inherit their tone for free from the
// wrapping toast's ACCENT text-* class — same currentColor strategy
// as the pre-existing ▲▼✎ controls elsewhere in the app.
const ICON: Record<ToastEvent["level"], LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  warn: AlertTriangle,
  info: Info,
};

// v2.5.0: errors are the app's only failure-reporting channel for
// 40+ server actions — a missed 6-second auto-dismiss reads as
// silent success. Errors now persist until explicitly dismissed;
// success/info/warn keep their short auto-dismiss. Every toast also
// gets a click-to-dismiss × and pauses its timer while hovered/
// focused, and body text is bumped from text-xs (10.5px effective)
// to text-sm.
function scheduleDismiss(
  id: number,
  ttl: number,
  setToasts: Dispatch<SetStateAction<Toast[]>>,
): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, ttl);
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Per-toast: remaining TTL (so a paused/resumed timer doesn't
  // restart from the full duration) and the live timeout handle.
  const timers = useRef(new Map<number, { handle: ReturnType<typeof setTimeout>; ttl: number }>());

  useEffect(() => {
    return subscribeToasts((ev) => {
      const id = Date.now() + Math.random();
      const persistent = ev.level === "error";
      const ttl = ev.ttlMs ?? (persistent ? Infinity : 3500);
      setToasts((prev) => [...prev, { ...ev, id }]);
      if (Number.isFinite(ttl)) {
        timers.current.set(id, { handle: scheduleDismiss(id, ttl, setToasts), ttl });
      }
    });
  }, []);

  function dismiss(id: number) {
    const t = timers.current.get(id);
    if (t) clearTimeout(t.handle);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function pause(id: number) {
    const t = timers.current.get(id);
    if (!t) return;
    clearTimeout(t.handle);
  }

  function resume(id: number) {
    const t = timers.current.get(id);
    if (!t) return;
    timers.current.set(id, { handle: scheduleDismiss(id, t.ttl, setToasts), ttl: t.ttl });
  }

  if (toasts.length === 0) return null;

  return (
    <div
      // v1.66.0 (DR-1): bottom-right on desktop, bottom-right ABOVE
      // the mobile tabbar on mobile. Pre-fix `p-4` (16px) puts the
      // toast inside the 56px tabbar — and z-100 < z-200 (tabbar)
      // means it was hidden behind. Bumped padding-bottom + z-index
      // so toasts clear the tabbar on every viewport.
      // Pointer-events on individual toasts so the wrapper itself
      // doesn't block interaction with the page.
      className="fixed inset-0 pointer-events-none z-[250] flex flex-col items-end justify-end p-4 pb-20 sm:pb-4 gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => {
        const Icon = ICON[t.level];
        return (
          <div
            key={t.id}
            role={t.level === "error" ? "alert" : "status"}
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => resume(t.id)}
            onFocus={() => pause(t.id)}
            onBlur={() => resume(t.id)}
            className={[
              "pointer-events-auto max-w-sm w-full sm:w-auto rounded-md border shadow-md px-4 py-2.5 text-sm flex items-start gap-2",
              ACCENT[t.level],
            ].join(" ")}
          >
            <Icon aria-hidden className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1 whitespace-pre-wrap">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="flex-shrink-0 -m-1.5 p-1.5 leading-none opacity-70 hover:opacity-100"
            >
              <X aria-hidden className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
