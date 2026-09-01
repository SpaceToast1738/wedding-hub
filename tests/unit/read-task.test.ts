// v2.12.0: read_task — the full-text single-task read that closes the
// notes read/write hazard. read_tasks clips notes to 240 chars and
// propose_task_update REPLACES the field, so before this tool a task
// with long notes could not be safely edited at all.
//
// Covers: the permission gate, unknown id, field selection across the
// three unbounded @db.Text columns, and the shared character-paging
// contract (nextOffset chain, byte-exact reassembly, past-end error).

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "@/lib/ai/tools/types";

type TaskRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  notes: string | null;
  questionAnswer: string | null;
  decisionAnswer: string | null;
  customFieldValues: unknown;
  assignees: Array<{ id: string; name: string | null; firstName: string | null }>;
  supplier: { id: string; name: string } | null;
  bookSections: Array<{ id: string; title: string }>;
  bookSubsections: Array<{ id: string; title: string }>;
  navTags: Array<{ id: string; name: string }>;
  guestGroups: Array<{ id: string; name: string }>;
};

let taskRows: Record<string, TaskRow> = {};
let permissionRows: Array<{ section: string; level: string }> = [];

vi.mock("@/lib/db", () => ({
  db: {
    task: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => taskRows[args.where.id] ?? null),
    },
    customField: { findMany: vi.fn(async () => [] as Array<{ id: string; name: string }>) },
    user: {
      findUnique: vi.fn(async (args: { where: { id: string } }) =>
        args.where.id === "u_member"
          ? {
              id: "u_member",
              role: "VIEWER",
              isCouple: false,
              email: "member@example.com",
              firstName: null,
              lastName: null,
              name: "Member",
            }
          : null,
      ),
    },
    permissionGroup: { findMany: vi.fn(async () => []) },
    groupPermission: { findMany: vi.fn(async () => []) },
    permission: { findMany: vi.fn(async () => permissionRows) },
  },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: <T>(fn: T) => fn };
});

const { readTask } = await import("@/lib/ai/tools/read-task");

function ctxFor(user: { id: string; isCouple: boolean }): ToolContext {
  return {
    user: {
      id: user.id,
      email: `${user.id}@example.com`,
      name: null,
      isCouple: user.isCouple,
      role: user.isCouple ? "COUPLE" : "VIEWER",
    },
    canWrite: false,
  };
}
const coupleCtx = ctxFor({ id: "u_couple", isCouple: true });
const memberCtx = ctxFor({ id: "u_member", isCouple: false });

let taskCounter = 0;

function addTask(opts: Partial<TaskRow> & { notes?: string | null }): string {
  taskCounter += 1;
  const id = `task_${taskCounter}`;
  taskRows[id] = {
    title: opts.title ?? "Trial bake weekend",
    type: "TASK",
    status: "OPEN",
    priority: "MEDIUM",
    dueDate: null,
    notes: opts.notes ?? null,
    questionAnswer: opts.questionAnswer ?? null,
    decisionAnswer: opts.decisionAnswer ?? null,
    customFieldValues: null,
    assignees: [],
    supplier: null,
    bookSections: [],
    bookSubsections: [],
    navTags: [],
    guestGroups: [],
    ...opts,
    id,
  };
  return id;
}

type Payload = {
  id: string;
  title: string;
  field: string;
  content: string;
  truncated?: boolean;
  textFields: { notes: number; questionAnswer: number; decisionAnswer: number };
  page: { offset: number; returnedChars: number; totalChars: number; nextOffset: number | null };
};

beforeEach(() => {
  taskRows = {};
  permissionRows = [];
  taskCounter = 0;
});

describe("read_task — gates", () => {
  it("refuses a caller without tasks visibility", async () => {
    const id = addTask({ notes: "x" });
    const r = await readTask.handler({ taskId: id }, memberCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("aren't visible");
  });

  it("allows a non-couple caller holding tasks VIEW", async () => {
    permissionRows = [{ section: "tasks", level: "VIEW" }];
    const id = addTask({ notes: "hello" });
    const r = await readTask.handler({ taskId: id }, memberCtx);
    expect(r.ok).toBe(true);
  });

  it("reports an unknown id", async () => {
    const r = await readTask.handler({ taskId: "nope" }, coupleCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("No task matches");
  });
});

describe("read_task — full notes (the v2.12.0 hazard)", () => {
  // The real case: read_tasks clips at 240, so anything past that was
  // invisible to a proposer that would REPLACE the whole field.
  const LONG_NOTES =
    "Three separate cakes, not tiers. ".repeat(20) + "FINAL LINE: collect boxes from Bryony.";

  it("returns notes untruncated past the 240-char read_tasks clip", async () => {
    const id = addTask({ notes: LONG_NOTES });
    const r = await readTask.handler({ taskId: id }, coupleCtx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.data as Payload;
    expect(LONG_NOTES.length).toBeGreaterThan(240);
    expect(p.content).toBe(LONG_NOTES);
    expect(p.content).toContain("FINAL LINE");
    expect(p.field).toBe("notes");
    expect(p.truncated).toBeUndefined();
    expect(p.page.nextOffset).toBeNull();
  });

  it("reports the length of every unbounded field", async () => {
    const id = addTask({ notes: "abc", questionAnswer: "de", decisionAnswer: null });
    const r = await readTask.handler({ taskId: id }, coupleCtx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.data as Payload;
    expect(p.textFields).toEqual({ notes: 3, questionAnswer: 2, decisionAnswer: 0 });
  });

  it("selects questionAnswer and decisionAnswer via `field`", async () => {
    const id = addTask({ notes: "N", questionAnswer: "Q", decisionAnswer: "D" });
    const q = await readTask.handler({ taskId: id, field: "questionAnswer" }, coupleCtx);
    const d = await readTask.handler({ taskId: id, field: "decisionAnswer" }, coupleCtx);
    expect(q.ok && (q.data as Payload).content).toBe("Q");
    expect(d.ok && (d.data as Payload).content).toBe("D");
  });

  it("returns empty content for a null field rather than erroring", async () => {
    const id = addTask({ notes: null });
    const r = await readTask.handler({ taskId: id }, coupleCtx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.data as Payload;
    expect(p.content).toBe("");
    expect(p.page.totalChars).toBe(0);
    expect(p.page.nextOffset).toBeNull();
  });
});

describe("read_task — paging", () => {
  const HUGE = "n".repeat(20_000) + "TAIL";

  it("pages notes over 16000 chars and reassembles byte-exact", async () => {
    const id = addTask({ notes: HUGE });
    let offset: number | null = 0;
    let assembled = "";
    let calls = 0;
    while (offset !== null) {
      const r = await readTask.handler({ taskId: id, offset }, coupleCtx);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const p = r.data as Payload;
      assembled += p.content.slice(0, p.page.returnedChars);
      offset = p.page.nextOffset;
      if (++calls > 10) throw new Error("nextOffset failed to terminate");
    }
    expect(assembled).toBe(HUGE);
    expect(assembled).toContain("TAIL");
    expect(calls).toBe(2);
  });

  it("marks the first slice truncated and names the next call", async () => {
    const id = addTask({ notes: HUGE });
    const r = await readTask.handler({ taskId: id }, coupleCtx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.data as Payload;
    expect(p.truncated).toBe(true);
    expect(p.page.nextOffset).toBe(16_000);
    expect(p.content).toContain("call read_task again with offset=16000");
  });

  it("rejects an offset past the end with the real length", async () => {
    const id = addTask({ notes: "short" });
    const r = await readTask.handler({ taskId: id, offset: 900 }, coupleCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("5 chars");
  });
});
