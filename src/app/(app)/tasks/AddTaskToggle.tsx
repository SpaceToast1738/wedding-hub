"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TaskForm, type UserOpt, type SupplierOpt, type BookSectionOpt, type BookSubsectionOpt, type NavTagOpt } from "./TaskForm";
import { createTask } from "./actions";

// v1.27.0 → v1.55.0: shipped originally as a fixed-position popover
// modal with a backdrop. v1.55.0 converts to inline-expand, matching
// every other "+ New X" affordance in the app (AddHouseholdToggle,
// AddSupplierToggle, AddPlaylistToggle, AddTableToggle, AddPaymentToggle,
// AddSectionToggle, AddSubsectionToggle, etc.). User feedback:
// "instead of popping out in the middle of the page like add new
// tasks they open in the task bar instead". Modals were
// jarring against the inline pattern everywhere else; consistent
// in-page expansion wins on UX even if TaskForm is the largest of
// the lot — the form-card just wraps to its own line in the
// PageHeader.actions flex row.
export function AddTaskToggle({
  users,
  suppliers = [],
  bookSections = [],
  bookSubsections = [],
  navTags = [],
  defaultType = "TASK",
  defaultSupplierId,
  defaultBookSectionIds,
  defaultBookSubsectionIds,
  defaultNavTagIds,
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
  bookSections?: BookSectionOpt[];
  bookSubsections?: BookSubsectionOpt[];
  navTags?: NavTagOpt[];
  defaultType?: string;
  defaultSupplierId?: string;
  defaultBookSectionIds?: string[];
  defaultBookSubsectionIds?: string[];
  defaultNavTagIds?: string[];
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

  // Inline expansion. The form-card is full-width on mobile and
  // wraps to its own line on desktop because `PageHeader.actions`
  // is a `flex-wrap` row — the card flow-wraps cleanly when wider
  // than the title side. Same pattern as AddHouseholdToggle but
  // sized for the bigger TaskForm.
  return (
    <div className="bg-surface border border-moss-100 rounded-md p-4 mb-4 shadow-sm w-full sm:w-[680px] sm:max-w-[calc(100vw-3rem)]">
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
        suppliers={suppliers}
        bookSections={bookSections}
        bookSubsections={bookSubsections}
        navTags={navTags}
        showType={showType}
        initial={{
          type: defaultType,
          supplierId: defaultSupplierId ?? null,
          bookSectionIds: defaultBookSectionIds ?? [],
          bookSubsectionIds: defaultBookSubsectionIds ?? [],
          navTagIds: defaultNavTagIds ?? [],
        }}
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
