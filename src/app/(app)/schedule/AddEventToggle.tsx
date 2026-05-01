"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EventForm, type GroupOpt, type UserOpt } from "./EventForm";
import { createScheduleEvent } from "./actions";

// v1.27.1 → v1.55.0: shipped originally as a fixed-position popover
// modal (mirroring v1.27.0's AddTaskToggle). v1.55.0 converts to
// inline-expand for consistency with every other "+ New X"
// affordance in the app. See AddTaskToggle.tsx for the full
// rationale; same pattern applied here. Form-card wraps onto its
// own line in PageHeader.actions when expanded.
// v1.41.0: takes `groups` for the polymorphic attendee picker.
export function AddEventToggle({
  users = [],
  groups = [],
}: {
  users?: UserOpt[];
  groups?: GroupOpt[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New event
      </Button>
    );
  }

  return (
    <div className="bg-surface border border-moss-100 rounded-md p-4 mb-4 shadow-sm w-full sm:w-[640px] sm:max-w-[calc(100vw-3rem)]">
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
  );
}
