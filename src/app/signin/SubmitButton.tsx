"use client";

// v2.5.0 (design pass #5): pending-state submit button for the sign-in
// flow. Both /signin and /signin/verify were plain server-action forms
// with no disabled/pending feedback — a slow email send (or slow code
// check) invited a double-click, which could send duplicate magic-link
// emails or burn through the 5-guess verification rate limit twice as
// fast. useFormStatus reads the enclosing <form>'s pending state, so
// this only needs to be dropped in as a form child — no prop plumbing
// from the parent server component required.
//
// Wraps the shared Button primitive rather than a bare <button> so the
// sign-in pages pick up the same touch floor / on-moss text token
// treatment as the rest of the app instead of their own hand-rolled
// classes.

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

export function SubmitButton({
  children,
  pendingLabel,
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
