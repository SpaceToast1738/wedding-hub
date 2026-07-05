"use client";

import { useEffect, useRef, type ReactNode } from "react";

// v1.56.0: reusable popout wrapper for "+ New X" forms. User
// preference: every Add affordance should pop out as a centred
// modal with a backdrop, NOT expand inline in the page header.
//
// Replaces the v1.55.0 inline-expand experiment. Originally the
// codebase had two patterns competing — fixed-position modal (v1.27.0)
// on /tasks + /schedule, and inline-expand (v1.0.x) on every other
// page. v1.55.0 normalised down to inline; v1.56.0 normalises up to
// modal-popout because that's what the user prefers — Add forms
// shouldn't push existing content around.
//
// Same shape across every page:
//   <Backdrop dim>
//     <Card centered (mobile) / top-anchored (desktop)>
//       <Header: title + ×>
//       <Form>
//     </Card>
//   </Backdrop>
//
// Dismiss paths: backdrop click, Esc, the × button, or whatever
// Cancel/Submit affordance the form provides via onClose.

export function AddNewModal({
  open,
  onClose,
  title,
  children,
  width = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Visual width preset. `sm` ≈ 480px, `md` ≈ 560px, `lg` ≈ 680px. */
  width?: "sm" | "md" | "lg";
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // v2.5.0: restore focus to the invoking element on close, and
  // autofocus the first field on open — previously nothing moved
  // focus into the dialog, so keyboard/screen-reader users started
  // "behind" the backdrop.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Esc to close. Listener installed only while open so we don't
  // intercept Esc when the modal is dormant.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // v2.5.0: focus trap — Tab/Shift+Tab cycles within the dialog.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    // First focusable field, not the × button — the form's first
    // input is almost always what the user opened the modal to fill in.
    const el = dialogRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([aria-label="Close"])',
    );
    el?.focus();
    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const widthClass =
    width === "sm"
      ? "max-w-[480px]"
      : width === "md"
        ? "max-w-[560px]"
        : "max-w-[680px]";

  return (
    // v2.5.0: aria-hidden REMOVED — it was hiding the role="dialog"
    // element it contains (and everything inside it) from the
    // accessibility tree. The dim layer has no content of its own.
    <div
      className="fixed inset-0 z-[400] bg-black/30 flex items-start sm:items-center justify-center pt-6 sm:pt-0 px-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-surface border border-border-soft rounded-md p-4 shadow-lg w-full ${widthClass} my-8`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-ink-primary">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            // v1.66.0 (DR-1): w-9 h-9 touch target. Pre-fix the close
            // × was a ~16px tap area — fine with a mouse, frustrating
            // on a phone where the user has to land precisely on a
            // 1.5cm-wide button.
            className="text-ink-tertiary hover:text-ink-primary text-xl leading-none w-9 h-9 -m-1.5 rounded-sm flex items-center justify-center"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
