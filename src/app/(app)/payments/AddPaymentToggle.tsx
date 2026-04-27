"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PaymentForm } from "./PaymentForm";
import { createPayment } from "./actions";

export function AddPaymentToggle({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <Button variant="primary" size="sm" onClick={() => setOpen(true)}>+ New payment</Button>;
  }
  return (
    <div className="bg-surface border border-moss-100 rounded-md p-4 mb-4 shadow-sm">
      <h3 className="text-sm font-semibold text-ink-primary mb-3">New payment</h3>
      <PaymentForm
        suppliers={suppliers}
        submitLabel="Create"
        onSubmit={async (fd) => { await createPayment(fd); setOpen(false); }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
