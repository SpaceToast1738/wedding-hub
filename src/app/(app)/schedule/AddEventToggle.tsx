"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EventForm } from "./EventForm";
import { createScheduleEvent } from "./actions";

export function AddEventToggle() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New event
      </Button>
    );
  }
  return (
    <div className="bg-surface border border-moss-100 rounded-md p-4 mb-4 shadow-sm">
      <h3 className="text-sm font-semibold text-ink-primary mb-3">New event</h3>
      <EventForm
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
