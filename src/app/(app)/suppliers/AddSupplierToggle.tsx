"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SupplierForm } from "./SupplierForm";
import { createSupplier } from "./actions";

export function AddSupplierToggle() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New supplier
      </Button>
    );
  }
  return (
    <div className="bg-surface border border-moss-100 rounded-md p-4 mb-4 shadow-sm">
      <h3 className="text-sm font-semibold text-ink-primary mb-3">New supplier</h3>
      <SupplierForm
        submitLabel="Create"
        onSubmit={async (fd) => {
          await createSupplier(fd);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
