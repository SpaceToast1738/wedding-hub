"use client";

import { Button } from "@/components/ui/Button";

// v1.24.0: shared "Print" button. Was duplicated three times (schedule,
// budget, payments) in this release; centralising so the label/icon
// stays consistent if it ever needs tweaking.
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => window.print()}
      title="Print or save as PDF"
    >
      ⎙ {label}
    </Button>
  );
}
