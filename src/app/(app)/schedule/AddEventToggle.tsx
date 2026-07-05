"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { EventForm, type GroupOpt, type UserOpt } from "./EventForm";
import { createScheduleEvent } from "./actions";
import { notify } from "@/lib/notify";

// v1.27.1 → v1.55.0 → v1.56.0: shipped originally as a modal,
// briefly inline in v1.55.0, modal again per user preference. Now
// uses the shared AddNewModal wrapper.
// v1.41.0: takes `groups` for the polymorphic attendee picker.
export function AddEventToggle({
  users = [],
  groups = [],
  defaultStartDate,
}: {
  users?: UserOpt[];
  groups?: GroupOpt[];
  /** v2.5.0 (design pass #7): wedding-day prefill, forwarded to EventForm. */
  defaultStartDate?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New event
      </Button>
      <AddNewModal open={open} onClose={() => setOpen(false)} title="New event" width="md">
        <EventForm
          users={users}
          groups={groups}
          defaultStartDate={defaultStartDate}
          submitLabel="Create"
          onSubmit={async (fd) => {
            // v2.5.0 (design pass #5): app-wide notify() convention —
            // this flow previously left success/failure silent.
            try {
              await createScheduleEvent(fd);
              notify("success", "Event added");
              setOpen(false);
            } catch (err) {
              notify("error", err instanceof Error ? err.message : "Failed to add event");
              throw err;
            }
          }}
          onCancel={() => setOpen(false)}
        />
      </AddNewModal>
    </>
  );
}
