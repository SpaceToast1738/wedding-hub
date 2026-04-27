"use client";

import { Button } from "@/components/ui/Button";

export function PrintShotsButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => window.print()}
      title="Print or save as PDF — uses the global print stylesheet"
    >
      ⎙ Print
    </Button>
  );
}
