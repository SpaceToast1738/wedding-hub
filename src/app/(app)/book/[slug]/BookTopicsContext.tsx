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

import { createContext, useContext, type ReactNode } from "react";
import type {
  BookSectionOpt,
  BookSubsectionOpt,
} from "@/app/(app)/tasks/TopicPicker";

type BookTopicsContextValue = {
  bookSections: BookSectionOpt[];
  bookSubsections: BookSubsectionOpt[];
};

const Ctx = createContext<BookTopicsContextValue>({
  bookSections: [],
  bookSubsections: [],
});

export function BookTopicsProvider({
  bookSections,
  bookSubsections,
  children,
}: BookTopicsContextValue & { children: ReactNode }) {
  return (
    <Ctx.Provider value={{ bookSections, bookSubsections }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBookTopics(): BookTopicsContextValue {
  return useContext(Ctx);
}
