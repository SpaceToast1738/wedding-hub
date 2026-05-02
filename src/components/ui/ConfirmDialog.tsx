"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// v1.62.0: shared confirm dialog. Replaces the ~40 native `confirm()`
// calls scattered across the app — tracked as P2 in the v1.52.1
// review punch list and partially addressed in v1.60.0 for
// SupplierCard. This is the proper solution: one component, one
// pattern, all calls converted in a single sweep.
//
// Why now. A 2.0 design pass would otherwise have to redesign 40
// individual native dialogs (impossible — the browser owns them) or
// build this component as part of the redesign. Building it first
// means the design pass redesigns ONE dialog and every caller
// inherits the new look automatically.
//
// API mirrors the native call shape so the sweep is mechanical:
//
//   const confirm = useConfirm();
//   async function onDelete() {
//     const ok = await confirm({
//       title: 'Delete supplier?',
//       body: 'This can't be undone.',
//       confirmLabel: 'Delete',
//       tone: 'danger',
//     });
//     if (!ok) return;
//     // ...delete
//   }
//
// `body` accepts ReactNode so callers can render structured content
// (multi-line snapshots, lists, etc.) without resorting to the
// `\n`-joined hack the old native confirm forced.

export type ConfirmOptions = {
  title: string;
  /** Body text or structured node. Optional — title-only dialogs
   *  ("Delete this entry?") still work. */
  body?: ReactNode;
  /** Defaults to "Confirm". */
  confirmLabel?: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** "danger" tints the Confirm button red and applies destructive-
   *  action visual treatment. Defaults to "default" (moss-tinted). */
  tone?: "default" | "danger";
};

type Resolver = (ok: boolean) => void;

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

/** Hook: returns a function that opens the shared dialog and resolves
 *  to true on confirm, false on cancel/dismiss. Throws if used outside
 *  a `<ConfirmProvider>` — callers should mount the provider at the
 *  app shell level. */
export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>");
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  // The pending resolver lives in a ref so we don't trigger re-renders
  // when it's set / cleared. Promise resolution is a side effect, not
  // render state.
  const resolverRef = useRef<Resolver | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      // If a previous dialog is still open (shouldn't happen in
      // normal flow but defensive), resolve it as cancel before
      // showing the new one.
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setOpts(options);
    });
  }, []);

  function close(answer: boolean) {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setOpts(null);
    resolver?.(answer);
  }

  // Esc cancels. Listener only mounted while open so we don't
  // intercept Esc when dormant.
  useEffect(() => {
    if (!opts) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);

  // Focus the Cancel button on open. Safer default for destructive
  // actions — a stray Enter shouldn't trigger Confirm.
  useEffect(() => {
    if (!opts) return;
    cancelButtonRef.current?.focus();
  }, [opts]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[500] bg-black/35 flex items-start sm:items-center justify-center pt-10 sm:pt-0 px-4 overflow-y-auto"
          onClick={() => close(false)}
          aria-hidden="true"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={opts.title}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-surface border border-border-soft rounded-md p-5 shadow-lg w-full max-w-[460px] my-8"
          >
            <h3 className="text-base font-semibold text-ink-primary mb-2">
              {opts.title}
            </h3>
            {opts.body !== undefined && opts.body !== null && opts.body !== "" && (
              <div className="text-sm text-ink-secondary leading-relaxed mb-4 whitespace-pre-wrap break-words">
                {opts.body}
              </div>
            )}
            {/* v1.66.0 (DR-1): bumped buttons to text-sm + py-2.5 so
                they meet touch-target minimums on mobile. Destructive
                confirms are the highest-stakes interactions in the
                app — users shouldn't have to aim for a 24px tap area
                to undo a delete. */}
            <div className="flex justify-end gap-2">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={() => close(false)}
                className="text-sm font-medium px-4 py-2.5 min-h-[40px] rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700"
              >
                {opts.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                autoFocus={false}
                className={
                  opts.tone === "danger"
                    ? "text-sm font-medium px-4 py-2.5 min-h-[40px] rounded-sm border border-danger bg-danger text-white hover:opacity-90"
                    : "text-sm font-medium px-4 py-2.5 min-h-[40px] rounded-sm border border-moss-700 bg-moss-700 text-white hover:bg-moss-900"
                }
              >
                {opts.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
