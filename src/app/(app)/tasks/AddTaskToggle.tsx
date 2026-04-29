"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TaskForm, type UserOpt } from "./TaskForm";
import { createTask } from "./actions";

// v1.27.0: New-task button now opens a fixed-position popover at
// the top-right of the page instead of the v1.0.x inline-expanded
// form that was rendered in the page-header `actions` slot (which
// made the header visually crowded). Backdrop dims the rest of the
// page; clicking outside / Escape / Cancel / Create all close.
export function AddTaskToggle({
  users,
  defaultType = "TASK",
  showType = true,
  buttonLabel = "+ New task",
}: {
  users: UserOpt[];
  defaultType?: string;
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
        <>
          <div
            className="fixed inset-0 z-[400] bg-black/15"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={buttonLabel.replace("+ ", "")}
            className="fixed right-4 top-16 z-[401] w-[calc(100vw-2rem)] max-w-[640px] bg-surface border border-border-soft rounded-md p-4 shadow-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink-primary">
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
              showType={showType}
              initial={{ type: defaultType }}
              submitLabel="Create"
              onSubmit={async (fd) => {
                await createTask(fd);
                setOpen(false);
              }}
              onCancel={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}
