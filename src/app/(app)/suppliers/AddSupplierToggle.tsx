"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { SupplierForm } from "./SupplierForm";
import { createSupplier } from "./actions";

// v1.56.0: shared AddNewModal popout — was inline-expand previously.
export function AddSupplierToggle() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New supplier
      </Button>
      <AddNewModal open={open} onClose={() => setOpen(false)} title="New supplier" width="md">
        <SupplierForm
          submitLabel="Create"
          onSubmit={async (fd) => {
            await createSupplier(fd);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </AddNewModal>
    </>
  );
}
