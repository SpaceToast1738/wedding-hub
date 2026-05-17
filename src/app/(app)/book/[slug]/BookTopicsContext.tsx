"use client";

// v1.95.1: shared context for the section page's Topics autofill. The
// section + subsection lists need to reach two inline-task creation
// surfaces:
//
//   1. The section-level LinkedTasksPanel above the cards
//      (autofills the Book section).
//   2. Each card's CardLinkedTasksPanel inside CardChrome
//      (autofills the specific Book page).
//
// Pre-fix both surfaces only passed `default*Ids` to AddTaskToggle
// without the corresponding option lists. The TopicPicker gates its
// render on at least one option list being non-empty (TaskForm:181),
// so the picker never rendered — and because the picker is what emits
// the `topicKeys` hidden inputs, the IDs never made it into formData.
// Net effect: silently broken autofill, no topics persisted.
//
// Context avoids deep prop drilling through 14 card editors. The
// section page renders the provider once; both panels consume it.
//
// v1.96.3: extended with users / suppliers / navTags / guestGroups so
// the inline EditTaskDialog (the per-row Edit affordance on the
// linked-tasks panels) can render TaskForm with the full option set
// pre-populated. Same single-provider-at-page-level pattern.

import { createContext, useContext, type ReactNode } from "react";
import type {
  BookSectionOpt,
  BookSubsectionOpt,
  NavTagOpt,
  GuestGroupOpt,
} from "@/app/(app)/tasks/TopicPicker";
import type { SupplierOpt, UserOpt } from "@/app/(app)/tasks/TaskForm";

type BookTopicsContextValue = {
  bookSections: BookSectionOpt[];
  bookSubsections: BookSubsectionOpt[];
  // v1.96.3: edit-mode form options. Default to empty arrays so
  // older consumers that only used the v1.95.1 shape (sections +
  // subsections) keep typechecking without changes.
  users: UserOpt[];
  suppliers: SupplierOpt[];
  navTags: NavTagOpt[];
  guestGroups: GuestGroupOpt[];
};

const Ctx = createContext<BookTopicsContextValue>({
  bookSections: [],
  bookSubsections: [],
  users: [],
  suppliers: [],
  navTags: [],
  guestGroups: [],
});

export function BookTopicsProvider({
  bookSections,
  bookSubsections,
  users,
  suppliers,
  navTags,
  guestGroups,
  children,
}: BookTopicsContextValue & { children: ReactNode }) {
  return (
    <Ctx.Provider
      value={{ bookSections, bookSubsections, users, suppliers, navTags, guestGroups }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useBookTopics(): BookTopicsContextValue {
  return useContext(Ctx);
}
