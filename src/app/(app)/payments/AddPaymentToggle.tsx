"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { PaymentForm } from "./PaymentForm";
import { createPayment } from "./actions";

// v1.56.0: shared AddNewModal popout — was inline-expand previously.
export function AddPaymentToggle({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New payment
      </Button>
      <AddNewModal open={open} onClose={() => setOpen(false)} title="New payment" width="md">
        <PaymentForm
          suppliers={suppliers}
          submitLabel="Create"
          onSubmit={async (fd) => {
            await createPayment(fd);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </AddNewModal>
    </>
  );
}
