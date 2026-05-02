"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AddNewModal } from "@/components/ui/AddNewModal";
import { TaskForm, type UserOpt, type SupplierOpt, type BookSectionOpt, type BookSubsectionOpt, type NavTagOpt, type GuestGroupOpt } from "./TaskForm";
import { createTask } from "./actions";

// v1.27.0: opens a fixed-position popover with backdrop instead of
// expanding inline in the page header (which made the header
// crowded). v1.55.0 briefly converted to inline-expand; v1.56.0
// reverted to modal popout based on user preference, then promoted
// the same pattern to every other page via the shared
// AddNewModal wrapper.
export function AddTaskToggle({
  users,
  suppliers = [],
  bookSections = [],
  bookSubsections = [],
  navTags = [],
  guestGroups = [],
  defaultType = "TASK",
  defaultSupplierId,
  defaultBookSectionIds,
  defaultBookSubsectionIds,
  defaultNavTagIds,
  defaultGuestGroupIds,
  showType = true,
  buttonLabel = "+ New task",
}: {
  users: UserOpt[];
  // v1.28.0: optional supplier picker. When this component is mounted
  // on a supplier-detail page, callers can also pass `defaultSupplierId`
  // to pre-select that supplier in the new-task form.
  suppliers?: SupplierOpt[];
  // v1.30.5: lists for the combined Topics multi-select.
  // v1.51.0: + bookSubsections (cards).
  // v1.61.0 (XL1): + guestGroups.
  bookSections?: BookSectionOpt[];
  bookSubsections?: BookSubsectionOpt[];
  navTags?: NavTagOpt[];
  guestGroups?: GuestGroupOpt[];
  defaultType?: string;
  defaultSupplierId?: string;
  defaultBookSectionIds?: string[];
  defaultBookSubsectionIds?: string[];
  defaultNavTagIds?: string[];
  defaultGuestGroupIds?: string[];
  showType?: boolean;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>
      <AddNewModal open={open} onClose={() => setOpen(false)} title={buttonLabel.replace("+ ", "")} width="lg">
        <TaskForm
          users={users}
          suppliers={suppliers}
          bookSections={bookSections}
          bookSubsections={bookSubsections}
          navTags={navTags}
          guestGroups={guestGroups}
          showType={showType}
          initial={{
            type: defaultType,
            supplierId: defaultSupplierId ?? null,
            bookSectionIds: defaultBookSectionIds ?? [],
            bookSubsectionIds: defaultBookSubsectionIds ?? [],
            navTagIds: defaultNavTagIds ?? [],
            guestGroupIds: defaultGuestGroupIds ?? [],
          }}
          submitLabel="Create"
          onSubmit={async (fd) => {
            await createTask(fd);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </AddNewModal>
    </>
  );
}
