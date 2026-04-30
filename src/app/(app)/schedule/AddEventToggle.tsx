"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EventForm, type GroupOpt, type UserOpt } from "./EventForm";
import { createScheduleEvent } from "./actions";

// v1.27.1: opens a fixed-position popover (mirrors v1.27.0's
// AddTaskToggle pattern) instead of an inline-expanded form. Same
// keep-the-header-uncrowded reasoning. ESC + backdrop dismiss.
// v1.41.0: now also takes `groups` for the polymorphic attendee picker.
export function AddEventToggle({
  users = [],
  groups = [],
}: {
  users?: UserOpt[];
  groups?: GroupOpt[];
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
        + New event
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
            aria-label="New event"
            className="fixed right-4 top-16 z-[401] w-[calc(100vw-2rem)] max-w-[640px] bg-surface border border-border-soft rounded-md p-4 shadow-lg max-h-[calc(100vh-6rem)] overflow-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink-primary">New event</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-ink-tertiary hover:text-ink-primary text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
            <EventForm
              users={users}
              groups={groups}
              submitLabel="Create"
              onSubmit={async (fd) => {
                await createScheduleEvent(fd);
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
