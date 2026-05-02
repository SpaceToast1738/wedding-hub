"use client";

import { useEffect, type ReactNode } from "react";

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

  if (!open) return null;

  const widthClass =
    width === "sm"
      ? "max-w-[480px]"
      : width === "md"
        ? "max-w-[560px]"
        : "max-w-[680px]";

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/30 flex items-start sm:items-center justify-center pt-6 sm:pt-0 px-4 overflow-y-auto"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
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
