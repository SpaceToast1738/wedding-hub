"use server";

// v2.1.0 phase 1: thread server actions consumed by ChatPanel.
// v2.1.0 phase 2: adds proposal actions — list pending, apply,
// edit-and-apply, dismiss.
//
// Chat writes stay on the streaming POST /api/ai/chat endpoint so
// token accounting can't be routed around.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/actions";
import { canEdit, canView } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { sendMessage } from "@/lib/ai/client";
import { AI_FEATURES, AiDisabledError } from "@/lib/ai/config";
import { BudgetExceeded, RateLimited } from "@/lib/ai/guards";
import {
  bookCardAppendSchema,
  eventCreateSchema,
  guestCreateSchema,
  humanLabel,
  taskCreateSchema,
  taskUpdateSchema,
  type ProposalKind,
} from "@/lib/ai/proposals/schemas";
import {
  createTask as createTaskAction,
  updateTask as updateTaskAction,
} from "@/app/(app)/tasks/actions";
import { createScheduleEvent as createScheduleEventAction } from "@/app/(app)/schedule/actions";
import {
  createHousehold as createHouseholdAction,
  createGuest as createGuestAction,
} from "@/app/(app)/guests/actions";
import { updateBookSubsection as updateBookSubsectionAction } from "@/app/(app)/book/actions";

export type ThreadListItem = {
  id: string;
  title: string | null;
  updatedAt: string;
  messageCount: number;
};

export async function listMyThreads(): Promise<ThreadListItem[]> {
  const user = await requireUser();
  if (!(await canView(user, "ai_chat"))) return [];
  const threads = await db.aiThread.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });
  return threads.map((t) => ({
    id: t.id,
    title: t.title,
    updatedAt: t.updatedAt.toISOString(),
    messageCount: t._count.messages,
  }));
}

export type ThreadMessage = {
  id: string;
  role: string;
  content: string;
  toolNames: string[];
  createdAt: string;
};

export type ThreadDetail = {
  id: string;
  title: string | null;
  messages: ThreadMessage[];
};

/** Load a thread + its messages. Filters `tool` rows out of the
 *  transcript — they're internal plumbing, not user-facing. */
export async function getThread(threadId: string): Promise<ThreadDetail | null> {
  const user = await requireUser();
  if (!(await canView(user, "ai_chat"))) return null;
  const thread = await db.aiThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      userId: true,
      title: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          toolCalls: true,
          createdAt: true,
        },
      },
    },
  });
  if (!thread || thread.userId !== user.id) return null;

  return {
    id: thread.id,
    title: thread.title,
    messages: thread.messages
      .filter((m) => m.role !== "tool")
      .map((m) => {
        const rawCalls = (m.toolCalls as unknown[] | null) ?? [];
        const toolNames = Array.isArray(rawCalls)
          ? rawCalls
              .filter(
                (b): b is { type: string; name?: string } =>
                  typeof b === "object" && b !== null && "type" in b,
              )
              .filter((b) => b.type === "tool_use" && typeof b.name === "string")
              .map((b) => b.name as string)
          : [];
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          toolNames,
          createdAt: m.createdAt.toISOString(),
        };
      }),
  };
}

// ─── Proposals ────────────────────────────────────────────────────────

export type PendingProposal = {
  id: string;
  kind: ProposalKind;
  kindLabel: string;
  rationale: string;
  createdAt: string;
  createdBy: string;
  payload: unknown;
  /** Small preview line rendered without opening the details drawer. */
  summary: string;
};

function summariseProposal(kind: string, payload: unknown): string {
  const p = payload as Record<string, unknown>;
  if (kind === "task.create") {
    const title = typeof p.title === "string" ? p.title : "(untitled)";
    const priority = typeof p.priority === "string" ? p.priority : "MEDIUM";
    const due = typeof p.dueDate === "string" && p.dueDate ? ` · due ${p.dueDate}` : "";
    return `${title} (${priority})${due}`;
  }
  if (kind === "task.update") {
    const bits: string[] = [];
    if (typeof p.status === "string") bits.push(`status → ${p.status}`);
    if (typeof p.priority === "string") bits.push(`priority → ${p.priority}`);
    if (typeof p.dueDate === "string" && p.dueDate) bits.push(`due → ${p.dueDate}`);
    if (typeof p.title === "string") bits.push(`title → "${p.title}"`);
    return bits.join(", ") || "small tweak";
  }
  if (kind === "event.create") {
    const title = typeof p.title === "string" ? p.title : "(untitled)";
    const start = typeof p.startTime === "string" ? p.startTime : "";
    return `${title} · ${start.slice(0, 16)}`;
  }
  if (kind === "guest.create") {
    const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "(name pending)";
    const side = typeof p.side === "string" ? ` · ${p.side}` : "";
    return `${name}${side}`;
  }
  if (kind === "book.card.append") {
    const heading = typeof p.heading === "string" ? p.heading : "Summary";
    const text = typeof p.text === "string" ? p.text : "";
    return `${heading}: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}`;
  }
  return "";
}

export async function listPendingProposals(): Promise<PendingProposal[]> {
  const user = await requireUser();
  if (!(await canView(user, "ai_chat"))) return [];

  // v2.1.0 phase 2: proposals are owned by the user who created
  // them — that's who sees them in the review dashboard. The
  // couple can also see proposals authored by anyone (helpful when
  // the planner is the one chatting and the couple is doing review).
  const where = user.isCouple ? {} : { createdById: user.id };
  const rows = await db.aiProposal.findMany({
    where: { ...where, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      kind: true,
      payload: true,
      rationale: true,
      createdAt: true,
      createdBy: {
        select: { firstName: true, name: true, email: true },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as ProposalKind,
    kindLabel: humanLabel(r.kind as ProposalKind),
    rationale: r.rationale,
    createdAt: r.createdAt.toISOString(),
    createdBy:
      r.createdBy.firstName ??
      r.createdBy.name ??
      r.createdBy.email ??
      "someone",
    payload: r.payload,
    summary: summariseProposal(r.kind, r.payload),
  }));
}

type ApplyResult =
  | { ok: true; entityId: string }
  | { ok: false; error: string };

/** Load + verify the proposal belongs to the caller (or to any user
 *  when the caller is the couple). Returns the row or throws. */
async function loadOwnedProposal(id: string, callerId: string, isCouple: boolean) {
  const proposal = await db.aiProposal.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      payload: true,
      status: true,
      createdById: true,
    },
  });
  if (!proposal) throw new Error("Proposal not found.");
  if (!isCouple && proposal.createdById !== callerId) {
    throw new Error("Proposal not found.");
  }
  return proposal;
}

/** Convert task.create payload → FormData that matches createTask's
 *  parser. */
function taskPayloadToFormData(payload: Record<string, unknown>): FormData {
  const fd = new FormData();
  fd.append("title", String(payload.title ?? ""));
  fd.append("type", String(payload.type ?? "TASK"));
  fd.append("priority", String(payload.priority ?? "MEDIUM"));
  fd.append("status", String(payload.status ?? "OPEN"));
  if (payload.dueDate) fd.append("dueDate", String(payload.dueDate));
  if (payload.notes) fd.append("notes", String(payload.notes));
  if (payload.supplierId) fd.append("supplierId", String(payload.supplierId));
  const assignees = Array.isArray(payload.assigneeIds) ? payload.assigneeIds : [];
  for (const id of assignees) fd.append("assigneeIds", String(id));
  const topicKeys: string[] = [];
  const secs = Array.isArray(payload.bookSectionIds) ? payload.bookSectionIds : [];
  for (const id of secs) topicKeys.push(`bookSection:${id}`);
  const tags = Array.isArray(payload.navTagIds) ? payload.navTagIds : [];
  for (const id of tags) topicKeys.push(`navTag:${id}`);
  const groups = Array.isArray(payload.guestGroupIds) ? payload.guestGroupIds : [];
  for (const id of groups) topicKeys.push(`guestGroup:${id}`);
  for (const k of topicKeys) fd.append("topicKeys", k);
  return fd;
}

/** task.update payload → FormData for updateTask. */
function taskUpdatePayloadToFormData(payload: Record<string, unknown>): FormData {
  const fd = new FormData();
  if (payload.title !== undefined) fd.append("title", String(payload.title));
  if (payload.status !== undefined) fd.append("status", String(payload.status));
  if (payload.priority !== undefined) fd.append("priority", String(payload.priority));
  if (payload.dueDate !== undefined && payload.dueDate !== null) {
    fd.append("dueDate", String(payload.dueDate));
  }
  if (payload.notes !== undefined && payload.notes !== null) {
    fd.append("notes", String(payload.notes));
  }
  return fd;
}

/** guest.create payload → FormData for createGuest. Caller supplies
 *  the resolved householdId (from a pre-Apply household lookup or
 *  fresh createHousehold call). */
function guestPayloadToFormData(
  payload: Record<string, unknown>,
  householdId: string,
): FormData {
  const fd = new FormData();
  fd.append("householdId", householdId);
  fd.append("firstName", String(payload.firstName ?? ""));
  fd.append("lastName", String(payload.lastName ?? ""));
  if (payload.email) fd.append("email", String(payload.email));
  if (payload.phone) fd.append("phone", String(payload.phone));
  fd.append("side", String(payload.side ?? "BOTH"));
  if (payload.isChild) fd.append("isChild", "on");
  if (payload.plusOneAllowed) fd.append("plusOneAllowed", "on");
  if (payload.plusOneName) fd.append("plusOneName", String(payload.plusOneName));
  if (payload.role) fd.append("role", String(payload.role));
  if (payload.dietary) fd.append("dietary", String(payload.dietary));
  if (payload.notes) fd.append("notes", String(payload.notes));
  return fd;
}

/** household → FormData for createHousehold. */
function householdPayloadToFormData(
  name: string,
  side: string,
): FormData {
  const fd = new FormData();
  fd.append("name", name);
  fd.append("side", side);
  return fd;
}

/** book.card.append: build the updated bodyHtml (existing + heading +
 *  new text) and post it as an updateBookSubsection FormData. */
async function bookCardAppendToFormData(
  payload: Record<string, unknown>,
): Promise<{ subsectionId: string; formData: FormData }> {
  const subsectionId = String(payload.subsectionId ?? "");
  const heading = String(payload.heading ?? "Summary");
  const newText = String(payload.text ?? "");
  const existing = await db.bookSubsection.findUnique({
    where: { id: subsectionId },
    select: { title: true, bodyHtml: true, body: true, kind: true },
  });
  if (!existing) throw new Error("Book card not found.");
  if (existing.kind !== "TEXT") {
    throw new Error(
      `Can only append to TEXT cards, not ${existing.kind}.`,
    );
  }

  // Wrap new text in <h3> + <p>. Escape angle brackets and ampersands
  // — updateBookSubsection re-runs sanitizeBookHtml, but escaping
  // here means the AI's literal content survives the sanitiser
  // untouched.
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = newText
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const block = `<h3>${esc(heading)}</h3>${paragraphs}`;
  const nextHtml = (existing.bodyHtml ?? "") + block;

  const fd = new FormData();
  fd.append("title", existing.title);
  fd.append("bodyHtml", nextHtml);
  return { subsectionId, formData: fd };
}

/** Convert event.create payload → FormData for createScheduleEvent.
 *  Splits the ISO datetime into the date+time fields the existing
 *  action expects. */
function eventPayloadToFormData(payload: Record<string, unknown>): FormData {
  const fd = new FormData();
  fd.append("title", String(payload.title ?? ""));

  const startIso = String(payload.startTime ?? "");
  const [startDate, startTimeRaw] = startIso.split("T");
  fd.append("startDate", startDate ?? "");
  fd.append("startTime", (startTimeRaw ?? "").slice(0, 5));

  if (payload.endTime) {
    const [endDate, endTimeRaw] = String(payload.endTime).split("T");
    fd.append("endDate", endDate ?? "");
    fd.append("endTime", (endTimeRaw ?? "").slice(0, 5));
  }

  if (payload.location) fd.append("location", String(payload.location));
  if (payload.notes) fd.append("notes", String(payload.notes));
  if (payload.allDay) fd.append("allDay", "true");

  const refs = Array.isArray(payload.attendeeRefs) ? payload.attendeeRefs : [];
  for (const r of refs) fd.append("attendeeRefs", String(r));

  return fd;
}

/** Apply a proposal — reuses the existing createTask /
 *  createScheduleEvent actions so the AI's writes are audit-log
 *  identical to a human's. Accepts an optional override that merges
 *  into the payload before validation. */
export async function applyProposal(
  id: string,
  override?: Record<string, unknown>,
): Promise<ApplyResult> {
  const user = await requireUser();
  if (!(await canEdit(user, "ai_write"))) {
    return { ok: false, error: "You don't have permission to apply AI proposals." };
  }

  let proposal;
  try {
    proposal = await loadOwnedProposal(id, user.id, user.isCouple);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Not found." };
  }
  if (proposal.status !== "PENDING") {
    return { ok: false, error: `Proposal is already ${proposal.status.toLowerCase()}.` };
  }

  const merged = { ...(proposal.payload as Record<string, unknown>), ...(override ?? {}) };
  let created: { id: string };

  try {
    if (proposal.kind === "task.create") {
      const parsed = taskCreateSchema.parse(merged);
      const result = await createTaskAction(taskPayloadToFormData(parsed));
      if (!result?.id) throw new Error("createTask did not return an id.");
      created = { id: result.id };
    } else if (proposal.kind === "task.update") {
      const parsed = taskUpdateSchema.parse(merged);
      await updateTaskAction(parsed.taskId, taskUpdatePayloadToFormData(parsed));
      // updateTask returns void; the entity id IS the taskId, no new row.
      created = { id: parsed.taskId };
    } else if (proposal.kind === "event.create") {
      const parsed = eventCreateSchema.parse(merged);
      const result = await createScheduleEventAction(eventPayloadToFormData(parsed));
      if (!result?.id) throw new Error("createScheduleEvent did not return an id.");
      created = { id: result.id };
    } else if (proposal.kind === "guest.create") {
      const parsed = guestCreateSchema.parse(merged);
      // Reuse an existing household by name (case-insensitive) if the
      // couple has one; otherwise create a new one and link the guest.
      const householdName =
        parsed.householdName?.trim() || `${parsed.lastName} household`;
      let household = await db.household.findFirst({
        where: { name: { equals: householdName, mode: "insensitive" } },
        select: { id: true },
      });
      if (!household) {
        const created = await createHouseholdAction(
          householdPayloadToFormData(householdName, parsed.side),
        );
        if (!created?.id) throw new Error("createHousehold did not return an id.");
        household = { id: created.id };
      }
      const guest = await createGuestAction(
        guestPayloadToFormData(parsed, household.id),
      );
      if (!guest?.id) throw new Error("createGuest did not return an id.");
      created = { id: guest.id };
    } else if (proposal.kind === "book.card.append") {
      const parsed = bookCardAppendSchema.parse(merged);
      const { subsectionId, formData } = await bookCardAppendToFormData(parsed);
      await updateBookSubsectionAction(subsectionId, formData);
      created = { id: subsectionId };
    } else {
      return { ok: false, error: `Unknown proposal kind: ${proposal.kind}` };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Apply failed during creation.",
    };
  }

  const status = override && Object.keys(override).length > 0
    ? "EDITED_AND_APPLIED"
    : "APPLIED";

  await db.aiProposal.update({
    where: { id },
    data: { status, appliedEntityId: created.id, reviewedAt: new Date() },
  });
  await logAudit({
    userId: user.id,
    action: `ai.proposal.${status.toLowerCase()}`,
    entity: "AiProposal",
    entityId: id,
    metadata: {
      kind: proposal.kind,
      appliedEntityId: created.id,
      hadOverride: Boolean(override && Object.keys(override).length > 0),
    },
  });

  revalidatePath("/ai");
  return { ok: true, entityId: created.id };
}

export async function dismissProposal(id: string): Promise<ApplyResult | { ok: true; entityId: null }> {
  const user = await requireUser();
  if (!(await canEdit(user, "ai_write"))) {
    return { ok: false, error: "You don't have permission to dismiss proposals." };
  }

  let proposal;
  try {
    proposal = await loadOwnedProposal(id, user.id, user.isCouple);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Not found." };
  }
  if (proposal.status !== "PENDING") {
    return { ok: false, error: `Proposal is already ${proposal.status.toLowerCase()}.` };
  }

  await db.aiProposal.update({
    where: { id },
    data: { status: "DISMISSED", reviewedAt: new Date() },
  });
  await logAudit({
    userId: user.id,
    action: "ai.proposal.dismissed",
    entity: "AiProposal",
    entityId: id,
    metadata: { kind: proposal.kind },
  });

  revalidatePath("/ai");
  return { ok: true, entityId: null };
}

// ─── One-shot surfaces (phase 3) ─────────────────────────────────────

type OneShotResult =
  | { ok: true; proposalId: string; summary: string }
  | { ok: false; error: string };

/** Strip HTML to plain text — same rule as read-book uses. Keeps
 *  the AI focused on content, not markup. */
function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Summarize a Wedding Book TEXT card. Generates a short summary
 *  via the fast model tier, then creates a book.card.append
 *  proposal the couple can Apply to prepend the summary to the
 *  existing bodyHtml. Read-only surfaces (COUPLE_ONLY visibility a
 *  non-couple user can't see) are rejected. */
export async function summarizeBookCard(
  subsectionId: string,
): Promise<OneShotResult> {
  const user = await requireUser();
  if (!(await canEdit(user, "ai_write"))) {
    return { ok: false, error: "You need ai_write permission to summarize cards." };
  }

  const card = await db.bookSubsection.findUnique({
    where: { id: subsectionId },
    select: {
      id: true,
      title: true,
      kind: true,
      bodyHtml: true,
      body: true,
      visibility: true,
      section: { select: { title: true, visibility: true } },
    },
  });
  if (!card) return { ok: false, error: "Card not found." };
  if (card.kind !== "TEXT") {
    return {
      ok: false,
      error: `Only TEXT cards can be summarized (this is ${card.kind}).`,
    };
  }
  if (!user.isCouple) {
    if (card.visibility === "COUPLE_ONLY" || card.section.visibility === "COUPLE_ONLY") {
      return { ok: false, error: "This card is couple-only." };
    }
  }

  const source = stripHtml(card.bodyHtml ?? card.body).slice(0, 8000);
  if (source.length < 40) {
    return {
      ok: false,
      error: "There isn't enough text on this card to summarize yet.",
    };
  }

  try {
    const result = await sendMessage({
      userId: user.id,
      feature: AI_FEATURES.summarizeCard,
      tier: "fast",
      maxTokens: 512,
      system:
        "You write concise summaries of wedding-book notes for a couple to skim. Aim for 2–4 short bullet points, ≤ 80 words total, no preamble, no closing line. Use plain prose (no markdown asterisks in the output).",
      messages: [
        {
          role: "user",
          content: `Summarize this card titled "${card.title}" (from the "${card.section.title}" section):\n\n${source}`,
        },
      ],
    });
    const summary = result.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    if (!summary) {
      return { ok: false, error: "The model returned an empty summary." };
    }

    const proposal = await db.aiProposal.create({
      data: {
        createdById: user.id,
        kind: "book.card.append",
        payload: {
          subsectionId: card.id,
          heading: "Summary",
          text: summary,
        } as unknown as object,
        rationale: `AI-generated summary of ${card.section.title} → ${card.title} (${source.length} chars in).`,
      },
    });
    revalidatePath("/ai");
    return { ok: true, proposalId: proposal.id, summary };
  } catch (err) {
    if (err instanceof BudgetExceeded || err instanceof RateLimited || err instanceof AiDisabledError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Summarize failed.",
    };
  }
}

/** Parse a pasted guest list (from an email, spreadsheet, note) into
 *  a set of guest.create proposals — one per row. Couple-only.
 *  Returns proposalIds so the caller can jump to the /ai dashboard. */
export async function parseGuestList(
  pastedText: string,
): Promise<
  | { ok: true; proposalIds: string[]; count: number; skipped: string[] }
  | { ok: false; error: string }
> {
  const user = await requireUser();
  if (!user.isCouple) {
    return { ok: false, error: "Parsing pasted guest lists is couple-only." };
  }
  if (!(await canEdit(user, "ai_write"))) {
    return { ok: false, error: "You need ai_write permission." };
  }

  const trimmed = pastedText.trim();
  if (trimmed.length < 8) {
    return { ok: false, error: "Paste a bit more — that's not enough text to parse." };
  }
  if (trimmed.length > 8000) {
    return { ok: false, error: "That's too much text at once. Split into chunks." };
  }

  // Strict JSON output — the model is forced by output_config to
  // emit valid JSON matching this schema. Replaces the pre-phase-4
  // "please return JSON" instruction + code-fence peeling.
  const guestJsonSchema = {
    type: "object",
    properties: {
      guests: {
        type: "array",
        items: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            householdName: { type: ["string", "null"] },
            side: { type: "string", enum: ["BRIDE", "GROOM", "BOTH"] },
            email: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            isChild: { type: "boolean" },
            plusOneAllowed: { type: "boolean" },
            plusOneName: { type: ["string", "null"] },
            dietary: { type: ["string", "null"] },
            role: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
          },
          required: ["firstName", "lastName", "side"],
        },
      },
    },
    required: ["guests"],
  } as const;

  try {
    const result = await sendMessage({
      userId: user.id,
      feature: AI_FEATURES.parseGuestList,
      tier: "balanced",
      maxTokens: 4096,
      system: `You extract structured guest data from pasted text. Rules:\n- One entry per person (children count as separate people).\n- Group co-habiting people under the same householdName; couples usually share a household.\n- 'side' is BRIDE or GROOM if the text makes it obvious, else BOTH.\n- Never invent an email or phone. Leave those null if not in the source.\n- Skip anything you can't parse confidently — under-extract rather than fabricate.`,
      messages: [{ role: "user", content: `Extract guests from:\n\n${trimmed}` }],
      outputConfig: {
        format: { type: "json_schema", schema: guestJsonSchema as unknown as Record<string, unknown> },
      },
    });
    const jsonText = result.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let rows: unknown;
    try {
      const parsed = JSON.parse(jsonText) as { guests?: unknown };
      rows = parsed.guests ?? [];
    } catch {
      return {
        ok: false,
        error: "The AI didn't return valid JSON. Try shorter or clearer text.",
      };
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: "No guests found in the pasted text." };
    }

    const { guestCreateSchema: schema } = await import("@/lib/ai/proposals/schemas");
    const proposalIds: string[] = [];
    const skipped: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const parsed = schema.safeParse(rows[i]);
      if (!parsed.success) {
        skipped.push(`row ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
        continue;
      }
      const proposal = await db.aiProposal.create({
        data: {
          createdById: user.id,
          kind: "guest.create",
          payload: parsed.data as unknown as object,
          rationale: `Parsed from pasted list (row ${i + 1}).`,
        },
      });
      proposalIds.push(proposal.id);
    }

    revalidatePath("/ai");
    return {
      ok: true,
      proposalIds,
      count: proposalIds.length,
      skipped,
    };
  } catch (err) {
    if (err instanceof BudgetExceeded || err instanceof RateLimited || err instanceof AiDisabledError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Guest parse failed.",
    };
  }
}

/** One-shot: pick open tasks with no dueDate, ask the deep tier to
 *  assign realistic dates based on weeks-to-wedding, emit one
 *  task.update proposal per assignment. Returns proposal count. */
export async function suggestDueDates(): Promise<
  | { ok: true; count: number; skipped: number }
  | { ok: false; error: string }
> {
  const user = await requireUser();
  if (!(await canEdit(user, "ai_write"))) {
    return { ok: false, error: "You need ai_write permission." };
  }

  const openTasks = await db.task.findMany({
    where: {
      type: "TASK",
      status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
      dueDate: null,
    },
    take: 30,
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, priority: true, notes: true },
  });
  if (openTasks.length === 0) {
    return { ok: false, error: "Every open task already has a due date." };
  }

  const settings = await import("@/lib/wedding-settings");
  const wedding = await settings.getWeddingSettings();
  const daysToWedding = Math.max(
    0,
    Math.ceil(
      (wedding.weddingDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    ),
  );
  const weeks = Math.floor(daysToWedding / 7);

  const responseSchema = {
    type: "object",
    properties: {
      dates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            taskId: { type: "string" },
            dueDate: {
              type: "string",
              description: "ISO date YYYY-MM-DD.",
            },
            rationale: { type: "string" },
          },
          required: ["taskId", "dueDate", "rationale"],
        },
      },
    },
    required: ["dates"],
  } as const;

  const taskList = openTasks
    .map(
      (t) =>
        `- id=${t.id} priority=${t.priority}: ${t.title}${t.notes ? ` — ${t.notes.slice(0, 100)}` : ""}`,
    )
    .join("\n");

  try {
    const result = await sendMessage({
      userId: user.id,
      feature: AI_FEATURES.suggestDueDates,
      tier: "deep",
      maxTokens: 4096,
      system: `You assign realistic due dates to wedding tasks. Rules:\n- Wedding is ${wedding.weddingDate.toISOString().slice(0, 10)} (in ${daysToWedding} days, ~${weeks} weeks).\n- Today is ${new Date().toISOString().slice(0, 10)}.\n- Every date MUST be in the future and BEFORE the wedding.\n- URGENT/HIGH tasks get earlier dates; LOW tasks can slip closer to the wedding.\n- Group logically-sequential tasks (e.g. "book florist" before "confirm floral order").\n- One rationale per task, 1 sentence, explaining the timing.\n- Assign a date to EVERY task in the list — don't skip.`,
      messages: [
        {
          role: "user",
          content: `Assign due dates to these open tasks:\n\n${taskList}`,
        },
      ],
      outputConfig: {
        format: {
          type: "json_schema",
          schema: responseSchema as unknown as Record<string, unknown>,
        },
      },
    });
    const text = result.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let parsed: { dates?: Array<{ taskId: string; dueDate: string; rationale: string }> };
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      return { ok: false, error: "The AI didn't return valid JSON." };
    }
    const dates = parsed.dates ?? [];
    if (dates.length === 0) {
      return { ok: false, error: "The AI didn't produce any suggestions." };
    }

    const validIds = new Set(openTasks.map((t) => t.id));
    const wedTs = wedding.weddingDate.getTime();
    const now = Date.now();
    let count = 0;
    let skipped = 0;

    for (const d of dates) {
      if (!validIds.has(d.taskId)) {
        skipped++;
        continue;
      }
      const dt = new Date(d.dueDate);
      if (Number.isNaN(dt.getTime()) || dt.getTime() < now || dt.getTime() > wedTs) {
        skipped++;
        continue;
      }
      await db.aiProposal.create({
        data: {
          createdById: user.id,
          kind: "task.update",
          payload: {
            taskId: d.taskId,
            dueDate: d.dueDate,
          } as unknown as object,
          rationale: d.rationale,
        },
      });
      count++;
    }

    revalidatePath("/ai");
    return { ok: true, count, skipped };
  } catch (err) {
    if (err instanceof BudgetExceeded || err instanceof RateLimited || err instanceof AiDisabledError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Suggest due dates failed.",
    };
  }
}

/** One-shot: draft a warm RSVP reminder text for a specific guest.
 *  Returns text, not a proposal — the couple copies it into email/
 *  SMS themselves. Couple-only (guest email is sensitive). */
export async function draftRsvpReminder(
  guestId: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!user.isCouple) {
    return { ok: false, error: "Drafting reminders is couple-only." };
  }
  if (!(await canEdit(user, "ai_write"))) {
    return { ok: false, error: "You need ai_write permission." };
  }

  const guest = await db.guest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      rsvp: true,
      side: true,
      role: true,
      isChild: true,
      plusOneAllowed: true,
      plusOneName: true,
      email: true,
      household: { select: { name: true } },
    },
  });
  if (!guest) return { ok: false, error: "Guest not found." };
  if (guest.rsvp !== "PENDING" && guest.rsvp !== "MAYBE") {
    return {
      ok: false,
      error: `${guest.firstName} has already ${guest.rsvp.toLowerCase()} — no reminder needed.`,
    };
  }
  if (guest.isChild) {
    return { ok: false, error: "Send the reminder to the child's parent instead." };
  }

  const settings = await import("@/lib/wedding-settings");
  const wedding = await settings.getWeddingSettings();
  const weeks = Math.max(
    0,
    Math.floor(
      (wedding.weddingDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000),
    ),
  );

  const guestSummary = [
    `${guest.firstName} ${guest.lastName}`,
    guest.role ? `role: ${guest.role}` : null,
    guest.plusOneAllowed
      ? `plus-one allowed${guest.plusOneName ? `: ${guest.plusOneName}` : ""}`
      : null,
    `current RSVP: ${guest.rsvp}`,
    `side: ${guest.side}`,
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    const result = await sendMessage({
      userId: user.id,
      feature: AI_FEATURES.draftGuestMessage,
      tier: "balanced",
      maxTokens: 512,
      system: `You draft warm, short RSVP-reminder messages the couple will send by email or SMS. Rules:\n- Length: 60–100 words. Not a paragraph, but not a one-liner.\n- Tone: friendly and personal, not corporate. First-person from the couple: "we".\n- Reference the specific guest (their first name, and any wedding-party role).\n- Mention the wedding date (${wedding.weddingDate.toISOString().slice(0, 10)}, ${weeks} weeks away).\n- Sign off as "${wedding.brideFirst} & ${wedding.groomFirst}".\n- Do NOT include a subject line, do NOT include a greeting like "Dear" (keep it casual — "Hi Jo!" is fine).\n- Do NOT add explanations or preamble before the message — just the message itself.`,
      messages: [
        {
          role: "user",
          content: `Draft a reminder for: ${guestSummary}. Household: "${guest.household.name}".`,
        },
      ],
    });

    const text = result.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) return { ok: false, error: "The model returned an empty draft." };

    await logAudit({
      userId: user.id,
      action: "ai.rsvp_reminder.drafted",
      entity: "Guest",
      entityId: guestId,
      metadata: { firstName: guest.firstName, lastName: guest.lastName },
    });

    return { ok: true, text };
  } catch (err) {
    if (err instanceof BudgetExceeded || err instanceof RateLimited || err instanceof AiDisabledError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Draft failed.",
    };
  }
}

// ─── State-of-the-wedding review ─────────────────────────────────────
//
// One expensive Opus call that reads across tasks, guests, budget
// (couple-only), schedule, wedding book, and suppliers, and returns
// a structured status report. Meant to be run every few weeks as a
// "how are we doing?" health check — that's why the rate limit is a
// low 3/hour.

export type ReviewConcern = {
  severity: "high" | "medium" | "low";
  area: string;
  issue: string;
  suggestion: string;
};

export type ReviewNote = {
  area: string;
  note: string;
};

export type WeddingReview = {
  headline: string;
  weeksToWedding: number;
  onTrack: ReviewNote[];
  concerns: ReviewConcern[];
  nextSteps: string[];
  generatedAt: string;
  costPence: number;
};

export async function reviewWeddingState(): Promise<
  { ok: true; review: WeddingReview } | { ok: false; error: string }
> {
  const user = await requireUser();
  if (!(await canView(user, "ai_chat"))) {
    return { ok: false, error: "You need ai_chat access to run reviews." };
  }

  const settings = await import("@/lib/wedding-settings");
  const wedding = await settings.getWeddingSettings();
  const now = new Date();
  const daysToWedding = Math.max(
    0,
    Math.ceil((wedding.weddingDate.getTime() - now.getTime()) / 86_400_000),
  );
  const weeksToWedding = Math.floor(daysToWedding / 7);

  const canSeeBudget = await canView(user, "budget");

  // ── Load a comprehensive but token-bounded snapshot ─────────────
  const [
    taskGroups,
    urgentTasks,
    overdueTasks,
    guestGroups,
    pendingGuests,
    events,
    sections,
    suppliers,
    budgetCategories,
    upcomingPayments,
  ] = await Promise.all([
    db.task.groupBy({
      by: ["status"],
      where: { type: "TASK" },
      _count: { _all: true },
    }),
    db.task.findMany({
      where: {
        type: "TASK",
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        priority: { in: ["HIGH", "URGENT"] },
      },
      take: 20,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      select: {
        title: true,
        priority: true,
        dueDate: true,
        status: true,
      },
    }),
    db.task.findMany({
      where: {
        type: "TASK",
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        dueDate: { lt: now },
      },
      take: 20,
      orderBy: { dueDate: "asc" },
      select: { title: true, dueDate: true, priority: true },
    }),
    db.guest.groupBy({
      by: ["rsvp"],
      where: { archived: false },
      _count: { _all: true },
    }),
    db.guest.findMany({
      where: { archived: false, rsvp: "PENDING" },
      take: 25,
      orderBy: [{ lastName: "asc" }],
      select: { firstName: true, lastName: true, side: true, role: true },
    }),
    db.scheduleEvent.findMany({
      where: { startTime: { gte: now } },
      take: 10,
      orderBy: { startTime: "asc" },
      select: { title: true, startTime: true, location: true, allDay: true },
    }),
    db.bookSection.findMany({
      orderBy: { order: "asc" },
      select: {
        title: true,
        _count: { select: { subsections: true, tasks: true } },
      },
    }),
    db.supplier.groupBy({
      by: ["status", "category"],
      _count: { _all: true },
    }),
    canSeeBudget
      ? db.budgetCategory.findMany({
          orderBy: { order: "asc" },
          select: {
            name: true,
            lines: { select: { estimated: true, actual: true, paid: true } },
          },
        })
      : Promise.resolve([]),
    canSeeBudget
      ? db.payment.findMany({
          where: { status: { in: ["DUE", "SCHEDULED", "OVERDUE"] } },
          orderBy: { dueDate: "asc" },
          take: 15,
          select: {
            description: true,
            amount: true,
            status: true,
            dueDate: true,
            supplier: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // ── Serialise it compactly for the model ────────────────────────
  const taskStatusMap = Object.fromEntries(
    taskGroups.map((r) => [r.status, r._count._all]),
  );
  const guestStatusMap = Object.fromEntries(
    guestGroups.map((r) => [r.rsvp, r._count._all]),
  );
  const supplierStatusMap: Record<string, number> = {};
  for (const s of suppliers) {
    supplierStatusMap[s.status] = (supplierStatusMap[s.status] ?? 0) + s._count._all;
  }

  let budgetSummary: string | null = null;
  if (canSeeBudget) {
    const totals = { estimated: 0, actual: 0, paid: 0 };
    const perCategory: string[] = [];
    for (const cat of budgetCategories) {
      const e = cat.lines.reduce((s, l) => s + Number(l.estimated ?? 0), 0);
      const a = cat.lines.reduce((s, l) => s + Number(l.actual ?? 0), 0);
      const p = cat.lines.reduce((s, l) => s + Number(l.paid ?? 0), 0);
      totals.estimated += e;
      totals.actual += a;
      totals.paid += p;
      if (e > 0 || a > 0 || p > 0) {
        perCategory.push(
          `${cat.name}: estimated £${e.toFixed(0)}, actual £${a.toFixed(0)}, paid £${p.toFixed(0)}`,
        );
      }
    }
    budgetSummary = [
      `TOTAL: estimated £${totals.estimated.toFixed(0)}, actual £${totals.actual.toFixed(0)}, paid £${totals.paid.toFixed(0)}`,
      ...perCategory,
      "",
      "Upcoming payments:",
      ...upcomingPayments.map(
        (p) =>
          `- ${p.description} · ${p.supplier?.name ?? "no supplier"} · £${Number(p.amount).toFixed(0)} · ${p.status}${p.dueDate ? ` · due ${p.dueDate.toISOString().slice(0, 10)}` : ""}`,
      ),
    ].join("\n");
  }

  const context = [
    `Wedding date: ${wedding.weddingDate.toISOString().slice(0, 10)} at ${wedding.venue}`,
    `Today: ${now.toISOString().slice(0, 10)} — ${daysToWedding} days remaining (~${weeksToWedding} weeks)`,
    "",
    "TASKS (by status):",
    ...Object.entries(taskStatusMap).map(([k, v]) => `- ${k}: ${v}`),
    "",
    `URGENT / HIGH priority open tasks (${urgentTasks.length}):`,
    ...urgentTasks.map(
      (t) =>
        `- [${t.priority}] ${t.title}${t.dueDate ? ` · due ${t.dueDate.toISOString().slice(0, 10)}` : " · no due date"}${t.status !== "OPEN" ? ` · ${t.status}` : ""}`,
    ),
    "",
    `Overdue tasks (${overdueTasks.length}):`,
    ...overdueTasks.map(
      (t) =>
        `- ${t.title}${t.dueDate ? ` · was due ${t.dueDate.toISOString().slice(0, 10)}` : ""}`,
    ),
    "",
    "GUESTS (by RSVP):",
    ...Object.entries(guestStatusMap).map(([k, v]) => `- ${k}: ${v}`),
    "",
    `Pending-RSVP guests (${pendingGuests.length}${pendingGuests.length === 25 ? "+" : ""}):`,
    ...pendingGuests
      .slice(0, 25)
      .map((g) => `- ${g.firstName} ${g.lastName}${g.role ? ` (${g.role})` : ""} · ${g.side}`),
    "",
    `SCHEDULE (next ${events.length}):`,
    ...events.map(
      (e) =>
        `- ${e.title} · ${e.startTime.toISOString().slice(0, 10)}${e.allDay ? "" : "T" + e.startTime.toISOString().slice(11, 16)}${e.location ? ` @ ${e.location}` : ""}`,
    ),
    "",
    "WEDDING BOOK sections (name · cards · linked tasks):",
    ...sections.map(
      (s) => `- ${s.title}: ${s._count.subsections} card(s), ${s._count.tasks} task(s)`,
    ),
    "",
    "SUPPLIERS (by status):",
    ...Object.entries(supplierStatusMap).map(([k, v]) => `- ${k}: ${v}`),
    "",
    canSeeBudget ? "BUDGET:" : "BUDGET: not visible to this reviewer.",
    ...(budgetSummary ? [budgetSummary] : []),
  ].join("\n");

  const responseSchema = {
    type: "object",
    properties: {
      headline: {
        type: "string",
        description:
          "One or two sentences summarising overall state. Lead with the outcome, not the process.",
      },
      onTrack: {
        type: "array",
        items: {
          type: "object",
          properties: {
            area: { type: "string" },
            note: { type: "string" },
          },
          required: ["area", "note"],
        },
      },
      concerns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            severity: { type: "string", enum: ["high", "medium", "low"] },
            area: { type: "string" },
            issue: { type: "string" },
            suggestion: { type: "string" },
          },
          required: ["severity", "area", "issue", "suggestion"],
        },
      },
      nextSteps: {
        type: "array",
        items: { type: "string" },
        description: "3–5 concrete actions the couple should tackle this week.",
      },
    },
    required: ["headline", "onTrack", "concerns", "nextSteps"],
  } as const;

  try {
    const result = await sendMessage({
      userId: user.id,
      feature: AI_FEATURES.reviewWedding,
      tier: "deep",
      maxTokens: 6000,
      system: `You are an experienced wedding planner reviewing the state of a real couple's wedding plan. Rules:\n- The wedding is ${daysToWedding} days away (~${weeksToWedding} weeks). Frame every comment in weeks-to-wedding.\n- Be direct and practical. This is a private tool for the couple — no encouragement filler.\n- Concerns should be things that could realistically go wrong or slip. Rank severity honestly:\n  · high: risks the wedding day itself (missing venue confirmation, no caterer, 40% RSVPs unknown)\n  · medium: causes real stress if not tackled (undated tasks piling up, budget category untouched)\n  · low: worth mentioning but not urgent (small polish items)\n- Do NOT pad the concerns list. If things are genuinely going well, return a short concerns array.\n- On-track notes should highlight 2–4 things that clearly are working.\n- Next steps: 3–5 actions the couple can start THIS WEEK. Concrete verbs (\"call the venue\", \"send the shortlist to Sarah\"), not vague (\"make progress on décor\").\n- Do not mention any budget number if you were told the budget isn't visible.`,
      messages: [
        {
          role: "user",
          content: `Review this wedding plan and produce your report:\n\n${context}`,
        },
      ],
      outputConfig: {
        format: {
          type: "json_schema",
          schema: responseSchema as unknown as Record<string, unknown>,
        },
      },
    });

    const text = result.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let parsed: {
      headline?: string;
      onTrack?: ReviewNote[];
      concerns?: ReviewConcern[];
      nextSteps?: string[];
    };
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      return { ok: false, error: "The AI didn't return valid JSON. Please try again." };
    }
    if (!parsed.headline) {
      return { ok: false, error: "The AI returned an incomplete review." };
    }

    return {
      ok: true,
      review: {
        headline: parsed.headline,
        weeksToWedding,
        onTrack: parsed.onTrack ?? [],
        concerns: parsed.concerns ?? [],
        nextSteps: parsed.nextSteps ?? [],
        generatedAt: new Date().toISOString(),
        costPence: result.costPence,
      },
    };
  } catch (err) {
    if (err instanceof BudgetExceeded || err instanceof RateLimited || err instanceof AiDisabledError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Review failed.",
    };
  }
}
