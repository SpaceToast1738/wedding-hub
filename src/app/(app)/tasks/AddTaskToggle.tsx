"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TaskForm, type UserOpt, type SupplierOpt, type BookSubsectionOpt } from "./TaskForm";
import { createTask } from "./actions";

// v1.27.0: New-task button now opens a fixed-position popover at
// the top-right of the page instead of the v1.0.x inline-expanded
// form that was rendered in the page-header `actions` slot (which
// made the header visually crowded). Backdrop dims the rest of the
// page; clicking outside / Escape / Cancel / Create all close.
export function AddTaskToggle({
  users,
  suppliers = [],
  bookSubsections = [],
  defaultType = "TASK",
  defaultSupplierId,
  defaultBookSubsectionId,
  showType = true,
  buttonLabel = "+ New task",
}: {
  users: UserOpt[];
  // v1.28.0: optional supplier picker. When this component is mounted
  // on a supplier-detail page, callers can also pass `defaultSupplierId`
  // to pre-select that supplier in the new-task form.
  suppliers?: SupplierOpt[];
  // v1.30.0: optional book-subsection picker. Same pattern as
  // suppliers — pass defaultBookSubsectionId to pre-select.
  bookSubsections?: BookSubsectionOpt[];
  defaultType?: string;
  defaultSupplierId?: string;
  defaultBookSubsectionId?: string;
  showType?: boolean;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-[400] bg-black/30 flex items-start sm:items-center justify-center pt-6 sm:pt-0 px-4 overflow-y-auto"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={buttonLabel.replace("+ ", "")}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-surface border border-border-soft rounded-md p-4 shadow-lg w-full max-w-[680px] my-8"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-ink-primary">
                {buttonLabel.replace("+ ", "")}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-ink-tertiary hover:text-ink-primary text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
            <TaskForm
              users={users}
              suppliers={suppliers}
              bookSubsections={bookSubsections}
              showType={showType}
              initial={{
                type: defaultType,
                supplierId: defaultSupplierId ?? null,
                bookSubsectionId: defaultBookSubsectionId ?? null,
              }}
              submitLabel="Create"
              onSubmit={async (fd) => {
                await createTask(fd);
                setOpen(false);
              }}
              onCancel={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
