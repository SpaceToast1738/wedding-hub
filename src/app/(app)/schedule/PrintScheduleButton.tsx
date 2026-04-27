"use client";

import { Button } from "@/components/ui/Button";

export function PrintScheduleButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => window.print()}
      title="Print or save as PDF"
    >
      ⎙ Print
    </Button>
  );
}
