// B5 (v1.12.0): simple toast bus.
//
// Window-event based so any component can `notify(...)` without having
// to wire a Provider/Context tree. The single <Toaster /> mounted in
// AppShell listens and renders.
//
// Use cases:
//   - try/catch around a server-action call: `notify("error", err.message)`
//   - confirmation of an in-place action: `notify("success", "Imported 3 guests")`
//   - non-fatal warnings: `notify("warn", "Email server not configured")`
//
// For errors that should break the page (auth gate failures, missing
// data), prefer letting them throw — the (app)/error.tsx boundary
// catches those and presents a full-page UI.

export type ToastLevel = "success" | "error" | "warn" | "info";

export type ToastEvent = {
  level: ToastLevel;
  message: string;
  ttlMs?: number;
};

const EVENT = "wh:toast";

export function notify(level: ToastLevel, message: string, ttlMs?: number): void {
  if (typeof window === "undefined") return;
  const detail: ToastEvent = { level, message, ttlMs };
  window.dispatchEvent(new CustomEvent<ToastEvent>(EVENT, { detail }));
}

export function subscribeToasts(handler: (e: ToastEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (ev: Event) => {
    const detail = (ev as CustomEvent<ToastEvent>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
