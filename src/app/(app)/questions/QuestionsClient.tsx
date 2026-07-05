"use client";

import { useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import { Tag } from "@/components/ui/Tag";
import { formatRelativeDue, isoForInput } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { deleteTask, updateTask } from "@/app/(app)/tasks/actions";
import { TaskForm, type UserOpt as TaskFormUserOpt } from "@/app/(app)/tasks/TaskForm";
import type { BookSectionOpt, BookSubsectionOpt, NavTagOpt, GuestGroupOpt } from "@/app/(app)/tasks/TopicPicker";
import { AnswerForm } from "./AnswerForm";

type Q = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  // v1.96.0: multi-assignee — flat list of user IDs from the m2m.
  assigneeIds: string[];
  dueDate: Date | null;
  questionAnswer: string | null;
  notes?: string | null;
  tags?: string[];
  customFieldValues?: Record<string, string | number | null> | null;
  // v1.90.1: existing topic m2m links — used to pre-select the
  // TopicPicker in the inline edit form. Parity with /tasks.
  bookSectionIds: string[];
  bookSubsectionIds: string[];
  navTagIds: string[];
  guestGroupIds: string[];
};

type UserOpt = { id: string; name: string | null; email: string };

type TypeFilter = "all" | "QUESTION" | "DECISION";
type PriorityFilter = "all" | "HIGH" | "MED" | "LOW";

import type { CustomFieldDef } from "@/lib/custom-fields";

export function QuestionsClient({
  questions,
  users,
  editable,
  customFieldDefs = [],
  bookSections = [],
  bookSubsections = [],
  navTags = [],
  guestGroups = [],
}: {
  questions: Q[];
  users: UserOpt[];
  editable: boolean;
  customFieldDefs?: CustomFieldDef[];
  // v1.90.1: option lists for the inline edit form's TopicPicker.
  // Same shapes as on AddTaskToggle (page already loads them).
  bookSections?: BookSectionOpt[];
  bookSubsections?: BookSubsectionOpt[];
  navTags?: NavTagOpt[];
  guestGroups?: GuestGroupOpt[];
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [search, setSearch] = useState("");

  const usersById = useMemo(() => {
    const m = new Map<string, UserOpt>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return questions.filter((q) => {
      if (typeFilter !== "all" && q.type !== typeFilter) return false;
      if (priorityFilter !== "all") {
        const bucket =
          q.priority === "URGENT" || q.priority === "HIGH"
            ? "HIGH"
            : q.priority === "LOW"
              ? "LOW"
              : "MED";
        if (bucket !== priorityFilter) return false;
      }
      if (term) {
        const hay = `${q.title} ${q.questionAnswer ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [questions, typeFilter, priorityFilter, search]);

  const open = filtered.filter((q) => q.status !== "DONE" && q.status !== "ARCHIVED");
  const answered = filtered.filter((q) => q.status === "DONE");

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="bg-surface border border-border-soft rounded-md shadow-sm p-3 space-y-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions and answers…"
            className="!text-sm"
          />
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mr-1">
              Type
            </span>
            <Tag label="All" active={typeFilter === "all"} onClick={() => setTypeFilter("all")} />
            <Tag label="? Questions" active={typeFilter === "QUESTION"} onClick={() => setTypeFilter("QUESTION")} />
            <Tag label="△ Decisions" active={typeFilter === "DECISION"} onClick={() => setTypeFilter("DECISION")} />
            <span className="w-2" />
            <span className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mr-1">
              Priority
            </span>
            <Tag label="All" active={priorityFilter === "all"} onClick={() => setPriorityFilter("all")} />
            <Tag label="High" active={priorityFilter === "HIGH"} onClick={() => setPriorityFilter("HIGH")} />
            <Tag label="Med" active={priorityFilter === "MED"} onClick={() => setPriorityFilter("MED")} />
            <Tag label="Low" active={priorityFilter === "LOW"} onClick={() => setPriorityFilter("LOW")} />
          </div>
        </div>

        {questions.length === 0 ? (
          // v2.5.0 (mod #10): distinct from the "no matches" case below
          // — a genuinely empty list gets an actionable next step
          // instead of a filter-tuning hint that doesn't apply yet.
          <div className="text-center py-12 space-y-1">
            <p className="text-sm font-medium text-ink-primary">No questions yet</p>
            <p className="text-sm text-ink-tertiary">
              Use the + New button above to add your first question or decision.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-sm text-ink-tertiary">No matches for this filter.</p>
            <button
              type="button"
              onClick={() => {
                setTypeFilter("all");
                setPriorityFilter("all");
                setSearch("");
              }}
              className="text-sm text-moss-700 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <Section title="Open" items={open} users={users} usersById={usersById} editable={editable} customFieldDefs={customFieldDefs} bookSections={bookSections} bookSubsections={bookSubsections} navTags={navTags} guestGroups={guestGroups} />
            <Section title="Answered" items={answered} users={users} usersById={usersById} editable={editable} customFieldDefs={customFieldDefs} bookSections={bookSections} bookSubsections={bookSubsections} navTags={navTags} guestGroups={guestGroups} />
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  users,
  usersById,
  editable,
  customFieldDefs,
  bookSections,
  bookSubsections,
  navTags,
  guestGroups,
}: {
  title: string;
  items: Q[];
  users: UserOpt[];
  usersById: Map<string, UserOpt>;
  editable: boolean;
  customFieldDefs: CustomFieldDef[];
  // v1.90.1: passed through to Row → TaskForm for the Topics picker.
  bookSections: BookSectionOpt[];
  bookSubsections: BookSubsectionOpt[];
  navTags: NavTagOpt[];
  guestGroups: GuestGroupOpt[];
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="text-[11px] font-bold text-ink-tertiary uppercase tracking-wider mb-2">{title}</h2>
      {/* v2.5.0 (mod #10): overflow-hidden clips each row's left-border
          accent (added below) neatly to the container's rounded-md
          corners. */}
      <ol className="bg-surface border border-border-soft rounded-md shadow-sm divide-y divide-border-soft overflow-hidden">
        {items.map((q) => (
          <Row
            key={q.id}
            q={q}
            users={users}
            usersById={usersById}
            editable={editable}
            customFieldDefs={customFieldDefs}
            bookSections={bookSections}
            bookSubsections={bookSubsections}
            navTags={navTags}
            guestGroups={guestGroups}
          />
        ))}
      </ol>
    </section>
  );
}

function Row({
  q,
  users,
  usersById,
  editable,
  customFieldDefs,
  bookSections,
  bookSubsections,
  navTags,
  guestGroups,
}: {
  q: Q;
  users: UserOpt[];
  usersById: Map<string, UserOpt>;
  editable: boolean;
  customFieldDefs: CustomFieldDef[];
  // v1.90.1: option lists for TaskForm's TopicPicker.
  bookSections: BookSectionOpt[];
  bookSubsections: BookSubsectionOpt[];
  navTags: NavTagOpt[];
  guestGroups: GuestGroupOpt[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  // v1.96.0: render the first assignee in the chip (most common
  // case still has 0 or 1). Multi-assignee row indicator is shown
  // as a "+N" suffix when there's more than one.
  const primaryAssignee = q.assigneeIds[0] ? usersById.get(q.assigneeIds[0]) : null;
  const extraAssigneeCount = Math.max(0, q.assigneeIds.length - 1);
  const priorityBucket =
    q.priority === "URGENT" || q.priority === "HIGH"
      ? "HIGH"
      : q.priority === "LOW"
        ? "LOW"
        : "MED";

  // v2.5.0 (mod #10): left-border accent per state — answered (moss),
  // overdue (danger), open (marigold) — replaces uniform white rows.
  // Same overdue definition as TaskRow/TaskBoard.
  const isAnswered = q.status === "DONE";
  const isOverdue = !isAnswered && !!q.dueDate && q.dueDate.getTime() < Date.now();
  const accentClass = isAnswered
    ? "border-l-moss-500"
    : isOverdue
      ? "border-l-danger"
      : "border-l-marigold-500";

  async function onDelete() {
    if (!(await confirm({ title: `Delete "${q.title}"?`, confirmLabel: "Delete", tone: "danger" }))) return;
    startTransition(async () => {
      try {
        await deleteTask(q.id);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Couldn't delete");
      }
    });
  }

  if (editing) {
    return (
      <li className="bg-surface border-y border-moss-100 px-4 py-3">
        <TaskForm
          users={users as TaskFormUserOpt[]}
          submitLabel="Save"
          // v1.90.1: forward topic option lists + existing IDs so the
          // TopicPicker renders + pre-selects existing links. Parity
          // with /tasks' edit drawer.
          bookSections={bookSections}
          bookSubsections={bookSubsections}
          navTags={navTags}
          guestGroups={guestGroups}
          initial={{
            title: q.title,
            type: q.type,
            priority: q.priority,
            status: q.status,
            // v1.96.0: multi-assignee.
            assigneeIds: q.assigneeIds,
            dueDate: isoForInput(q.dueDate),
            // v1.96.0: Category field dropped from TaskForm.
            notes: q.notes ?? "",
            bookSectionIds:    q.bookSectionIds,
            bookSubsectionIds: q.bookSubsectionIds,
            navTagIds:         q.navTagIds,
            guestGroupIds:     q.guestGroupIds,
          }}
          onSubmit={async (fd) => {
            await updateTask(q.id, fd);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          taskId={q.id}
          customFieldDefs={customFieldDefs}
          customFieldValues={q.customFieldValues ?? null}
        />
      </li>
    );
  }

  return (
    <li className={`px-4 py-3 pl-3 border-l-4 group ${accentClass}`}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className={[
            "text-[10px] font-bold flex-shrink-0 px-1 rounded",
            q.type === "DECISION"
              ? "text-marigold-700 bg-marigold-100"
              : "text-info bg-[color:#eef4f5] dark:bg-muted",
          ].join(" ")}
        >
          {q.type === "DECISION" ? "△" : "?"}
        </span>
        <span
          className={[
            "text-sm flex-1 min-w-[180px]",
            q.status === "DONE" ? "text-ink-tertiary" : "text-ink-primary font-medium",
          ].join(" ")}
        >
          {q.title}
        </span>
        {primaryAssignee && (
          <span className="flex items-center gap-1 flex-shrink-0">
            <Avatar name={primaryAssignee.name ?? primaryAssignee.email} size={18} />
            <span className="text-xs text-ink-tertiary">
              {(primaryAssignee.name ?? primaryAssignee.email).split(" ")[0]}
              {extraAssigneeCount > 0 ? ` +${extraAssigneeCount}` : ""}
            </span>
          </span>
        )}
        <StatusPill
          status={q.status === "DONE" ? "DONE" : priorityBucket}
          label={q.status === "DONE" ? "Answered" : priorityBucket}
        />
        <span className="text-xs text-ink-tertiary w-20 text-right">
          {formatRelativeDue(q.dueDate)}
        </span>
        {editable && (
          // v1.18.5: Edit/Delete actions. Visible on touch / hover-fade
          // on desktop. v2.5.0: added sm:focus-within:opacity-100 — the
          // hover-only version had no keyboard/focus fallback, so the
          // controls were unreachable without a mouse on desktop.
          <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
              Delete
            </Button>
          </div>
        )}
      </div>
      {q.questionAnswer && q.status === "DONE" && (
        <p className="text-xs text-ink-secondary italic mt-2 pl-6">{q.questionAnswer}</p>
      )}
      {editable && q.status !== "DONE" && (
        <AnswerForm taskId={q.id} initialAnswer={q.questionAnswer ?? ""} />
      )}
    </li>
  );
}
