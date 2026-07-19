// v2.8.2 (Tier 3): MCP prompts — canned planner workflows.
//
// The `prompts` capability lets an MCP client (Claude Code's slash
// menu, MCP Inspector, etc.) offer these as one-click starting points.
// prompts/get returns a single user-role message that briefs the agent
// on a workflow, grounded in the same judgement rules as
// docs/planner/PLANNER.md: read first, propose don't self-apply the
// risky stuff, draft messages instead of sending them, end with a
// summary.
//
// These are PURE data (no DB, no app imports) so protocol.ts stays
// dependency-free and the unit tests need no mocks. The couple/planner
// runs them; the tools they name are the ones the registry exposes.

export type McpPromptArgument = {
  name: string;
  description: string;
  required?: boolean;
};

export type McpPromptDef = {
  name: string;
  description: string;
  arguments?: McpPromptArgument[];
};

export type McpPromptMessage = {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
};

export type McpPromptResult = {
  description: string;
  messages: McpPromptMessage[];
};

// Shared preamble — the judgement layer, kept short so it rides on
// every workflow without bloating the message.
const PREAMBLE =
  "You are acting as the wedding planner for Jamie & Bryony (see " +
  "docs/planner/PLANNER.md for standing rules). Read live data with the " +
  "read_* tools before proposing anything; ids must come from this " +
  "session's reads, never memory. Draft any guest/supplier messages as " +
  "task notes — never send. Prefer leaving proposals in the /ai review " +
  "queue; only self-apply routine, additive, clearly-correct changes, " +
  "and never self-apply deletes, money, or guest-facing changes. Finish " +
  "with a short plain-English summary of what you found, proposed, and " +
  "(if anything) applied.";

type PromptSpec = McpPromptDef & { build: (args: Record<string, string>) => string };

const SPECS: PromptSpec[] = [
  {
    name: "weekly_review",
    description:
      "Monday status review: countdown, overdue tasks, RSVP funnel, payments due soon, unseated guests, and the pending-proposal queue — with proposed next steps.",
    build: () =>
      `${PREAMBLE}\n\nRun the weekly planner review:\n` +
      "1. read_stats for the countdown and headline task/RSVP numbers.\n" +
      "2. read_tasks(overdue:true) and read_tasks(status:IN_PROGRESS) — flag stalls; propose_task_update to re-date/re-prioritise, or propose_task_breakdown for anything too big.\n" +
      "3. read_payments(dueBefore: ~14 days out) and, if you're couple-tier, read_budget — flag anything due or over budget.\n" +
      "4. read_guests(rsvp:PENDING) for the outstanding RSVP count and read_seating for unseated attending guests.\n" +
      "5. read_proposals to see what's already queued (don't duplicate).\n" +
      "Propose tasks for genuine gaps on the critical path. Summarise the week's picture and the top 3 things needing the couple's attention.",
  },
  {
    name: "overdue_triage",
    description:
      "Work through overdue and stalled tasks: re-date, re-prioritise, split, or reassign — one reviewable batch.",
    build: () =>
      `${PREAMBLE}\n\nTriage overdue work:\n` +
      "1. read_tasks(overdue:true) and read_tasks(status:IN_PROGRESS).\n" +
      "2. For each: is it still needed? propose_task_update to re-date/re-prioritise; propose_task_breakdown if it's stalled because it hides several steps; note (don't invent) an owner only if obvious.\n" +
      "Pass the same batchKey to every propose_* call so they land as one approve-all card. Summarise what you re-planned.",
  },
  {
    name: "rsvp_chase",
    description:
      "Segment guests who haven't RSVP'd and draft a chase list (messages as task notes — never sent).",
    build: () =>
      `${PREAMBLE}\n\nBuild an RSVP chase:\n` +
      "1. read_guests(rsvp:PENDING) — group by household and side.\n" +
      "2. For each household, propose_task with a drafted, friendly chase message in the notes for a human to send. Do NOT change anyone's RSVP yourself (that's propose_guest_set_rsvp, only when you actually know their answer).\n" +
      "Summarise how many are outstanding and the chase waves you queued.",
  },
  {
    name: "supplier_confirmation_sweep",
    description:
      "For every booked supplier with no recent contact, queue a final-confirmation task; note contract/RSVP gaps.",
    build: () =>
      `${PREAMBLE}\n\nSweep booked suppliers for final confirmations:\n` +
      "1. read_suppliers(status:BOOKED) — note who has no recent logged communication or an unsigned/missing contract (read_files for contract flags).\n" +
      "2. propose_task (linked to the supplier) to confirm arrival time/scope; after a real call happens, propose_supplier_log_communication records it (followUpAt auto-creates a follow-up).\n" +
      "Summarise which suppliers still need confirming and which contracts are outstanding.",
  },
  {
    name: "payment_reconciliation",
    description:
      "Couple-only: reconcile the payment schedule against the budget and supplier balances; flag anything due or missing.",
    build: () =>
      `${PREAMBLE}\n\nReconcile payments (couple-tier token required — budget/payments are couple-only):\n` +
      "1. read_payments(dueBefore: the next milestone) and read_budget for the full tree.\n" +
      "2. Check every booked supplier balance has a payment row with a sane due date; propose_payment_create / propose_payment_update / propose_payment_set_status for gaps or status drift (marking PAID stamps today unless you pass an explicit paidDate).\n" +
      "Never self-apply money changes — leave them for the couple to approve. Summarise what's due, what's missing, and any variance.",
  },
  {
    name: "day_of_runsheet",
    description:
      "Build a minute-level wedding-day run sheet by merging schedule events, Wedding-Book SETUP cards, and supplier arrivals; fill gaps.",
    build: () =>
      `${PREAMBLE}\n\nBuild the day-of run sheet:\n` +
      "1. read_events for the wedding day, read_book / read_book_card for SETUP-card times (florist/venue setup, pack-down), and read_suppliers for arrival contacts.\n" +
      "2. Merge into a single minute-by-minute timeline; propose_event or propose_event_update (attendeeRefs from read_members) to fill gaps — echo existing refs exactly.\n" +
      "Render the run sheet as text in your reply and summarise any timing conflicts you found.",
  },
];

export function listPrompts(): McpPromptDef[] {
  return SPECS.map(({ name, description, arguments: args }) => ({
    name,
    description,
    ...(args ? { arguments: args } : {}),
  }));
}

/** Returns null for an unknown name (→ the caller maps to -32602). */
export function getPrompt(
  name: string,
  args: Record<string, string> = {},
): McpPromptResult | null {
  const spec = SPECS.find((s) => s.name === name);
  if (!spec) return null;
  return {
    description: spec.description,
    messages: [{ role: "user", content: { type: "text", text: spec.build(args) } }],
  };
}
