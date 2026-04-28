// Pure decision module for B3 — supplier follow-up auto-creates a Task.
//
// When a SupplierCommunication is created with a `followUpAt` set, we
// also want a Task to land in `/tasks` so the couple sees it in their
// daily flow rather than having to dig into the supplier's comm log.
// Keeping the decision pure-function lets the action wrapper stay
// focused on DB writes + transactions, and lets unit tests cover the
// title-format / tag-shape contract without spinning up Prisma.

export type FollowUpTaskInput = {
  supplierId: string;
  supplierName: string;
  // The id of the just-created SupplierCommunication row. Used as a
  // soft FK in the Task's tags so we can link back without a schema
  // change. (R5 may turn this into a real `Task.sourceCommId String?`
  // column if the soft link proves clunky.)
  commId: string;
  followUpAt: Date | null;
  createdById: string | null;
};

export type FollowUpTaskData = {
  title: string;
  type: "TASK";
  status: "OPEN";
  priority: "MEDIUM";
  dueDate: Date;
  assigneeId: string | null;
  tags: string[];
};

// Returns the Task payload to create, or null if no follow-up was set.
// Same shape as `db.task.create({ data })` expects (matches the
// `createTask` template in src/app/(app)/tasks/actions.ts).
export function decideFollowUpTask(input: FollowUpTaskInput): FollowUpTaskData | null {
  if (!input.followUpAt) return null;
  return {
    title: `Follow up: ${input.supplierName}`,
    type: "TASK",
    status: "OPEN",
    priority: "MEDIUM",
    dueDate: input.followUpAt,
    assigneeId: input.createdById,
    tags: [
      "supplier-follow-up",
      `supplier:${input.supplierId}`,
      `comm:${input.commId}`,
    ],
  };
}
