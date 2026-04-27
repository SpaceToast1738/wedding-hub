"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TaskForm, type UserOpt } from "./TaskForm";
import { createTask } from "./actions";

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

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>
    );
  }
  return (
    <div className="bg-surface border border-moss-100 rounded-md p-4 mb-4 shadow-sm">
      <h3 className="text-sm font-semibold text-ink-primary mb-3">{buttonLabel.replace("+ ", "")}</h3>
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
  );
}
