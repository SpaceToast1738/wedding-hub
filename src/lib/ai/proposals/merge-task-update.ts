// v2.2.0: pure merge logic for task.update proposals.
//
// The trap this module defuses: updateTask (src/app/(app)/tasks/
// actions.ts) REPLACES relations wholesale when the corresponding
// FormData field is present — assignees as one set, and ALL FOUR
// topic relations (bookSections, bookSubsections, navTags,
// guestGroups) as a single unit whenever ANY topicKeys entry is
// posted. An apply bridge that posted only the AI's new topic ids
// would silently wipe every existing link.
//
// So: proposals carry add/remove DELTAS; at apply time we load the
// task's current relation ids, merge here, and post the full merged
// set. Pure function — unit-tested in tests/unit/merge-task-update.test.ts.
//
// v2.6.2: bookSubsectionIds (card-level links) now merge via the same
// add/remove delta pattern as the other three relations — previously
// passed through untouched because propose_task_update had no field
// for it, so re-linking a task to a different Wedding Book card
// required a manual edit even though the DB relation and both apply
// bridges already supported it.

export type TaskRelationState = {
  assigneeIds: string[];
  bookSectionIds: string[];
  bookSubsectionIds: string[];
  navTagIds: string[];
  guestGroupIds: string[];
};

export type TaskRelationPatch = {
  addAssigneeIds?: string[];
  removeAssigneeIds?: string[];
  addNavTagIds?: string[];
  removeNavTagIds?: string[];
  addBookSectionIds?: string[];
  removeBookSectionIds?: string[];
  addBookSubsectionIds?: string[];
  removeBookSubsectionIds?: string[];
  addGuestGroupIds?: string[];
  removeGuestGroupIds?: string[];
};

function mergeSet(
  current: string[],
  add: string[] | undefined,
  remove: string[] | undefined,
): string[] {
  const out = new Set(current);
  for (const id of add ?? []) out.add(id);
  for (const id of remove ?? []) out.delete(id);
  return [...out];
}

/** True when the patch touches assignees at all — the bridge only
 *  posts the assigneeIds field in that case (absent = untouched,
 *  per updateTask's __touched__ semantics). */
export function patchTouchesAssignees(patch: TaskRelationPatch): boolean {
  return Boolean(patch.addAssigneeIds?.length || patch.removeAssigneeIds?.length);
}

/** True when the patch touches any topic relation. When true the
 *  bridge must post the FULL merged topic set for all four relations
 *  (updateTask replaces them as a unit). */
export function patchTouchesTopics(patch: TaskRelationPatch): boolean {
  return Boolean(
    patch.addNavTagIds?.length ||
      patch.removeNavTagIds?.length ||
      patch.addBookSectionIds?.length ||
      patch.removeBookSectionIds?.length ||
      patch.addBookSubsectionIds?.length ||
      patch.removeBookSubsectionIds?.length ||
      patch.addGuestGroupIds?.length ||
      patch.removeGuestGroupIds?.length,
  );
}

/** Apply the deltas to the task's current relation state. Returns the
 *  full post-merge sets — all four topic relations must be re-posted
 *  as a unit whenever any of them change, or updateTask's unit-replace
 *  wipes the ones the patch didn't touch. */
export function mergeTaskRelations(
  current: TaskRelationState,
  patch: TaskRelationPatch,
): TaskRelationState {
  return {
    assigneeIds: mergeSet(
      current.assigneeIds,
      patch.addAssigneeIds,
      patch.removeAssigneeIds,
    ),
    bookSectionIds: mergeSet(
      current.bookSectionIds,
      patch.addBookSectionIds,
      patch.removeBookSectionIds,
    ),
    bookSubsectionIds: mergeSet(
      current.bookSubsectionIds,
      patch.addBookSubsectionIds,
      patch.removeBookSubsectionIds,
    ),
    navTagIds: mergeSet(
      current.navTagIds,
      patch.addNavTagIds,
      patch.removeNavTagIds,
    ),
    guestGroupIds: mergeSet(
      current.guestGroupIds,
      patch.addGuestGroupIds,
      patch.removeGuestGroupIds,
    ),
  };
}
