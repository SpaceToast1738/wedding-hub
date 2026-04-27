"use client";

import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={() => window.print()}
      title="Print this page or save as PDF"
    >
      🖨 Print / save as PDF
    </Button>
  );
}
