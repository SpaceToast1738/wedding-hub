"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { EventForm, type GroupOpt, type UserOpt } from "./EventForm";
import { createScheduleEvent } from "./actions";

// v1.27.1 → v1.55.0 → v1.56.0: shipped originally as a modal,
// briefly inline in v1.55.0, modal again per user preference. Now
// uses the shared AddNewModal wrapper.
// v1.41.0: takes `groups` for the polymorphic attendee picker.
export function AddEventToggle({
  users = [],
  groups = [],
}: {
  users?: UserOpt[];
  groups?: GroupOpt[];
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
          submitLabel="Create"
          onSubmit={async (fd) => {
            await createScheduleEvent(fd);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </AddNewModal>
    </>
  );
}
