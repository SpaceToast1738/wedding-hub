// v2.1.0 phase 1: read-tool registry.
//
// Collects every AI-callable tool in one place, exports the Anthropic
// tool definitions the chat loop passes to the API, and dispatches
// tool_use blocks back to the right handler. Phase 2 adds write
// tools (propose-task, propose-event) via the same interface.

import type Anthropic from "@anthropic-ai/sdk";
import type { AiTool, ToolContext, ToolResult } from "./types";
import { readTasks } from "./read-tasks";
import { readEvents } from "./read-events";
import { readGuests } from "./read-guests";
import { readBook } from "./read-book";
import { readBookCard } from "./read-book-card";
import { readBudget } from "./read-budget";
import { readStats } from "./read-stats";
import { readSuppliers } from "./read-suppliers";
import { readProposals } from "./read-proposals";
import { readPayments } from "./read-payments";
import { readSeating } from "./read-seating";
import { readSongs } from "./read-songs";
import { readFiles } from "./read-files";
import { proposeTask } from "./propose-task";
import { proposeTaskUpdate } from "./propose-task-update";
import { proposeTaskBreakdown } from "./propose-task-breakdown";
import { proposeEvent } from "./propose-event";
import { proposeEventUpdate } from "./propose-event-update";
import { proposeSupplierCreate } from "./propose-supplier-create";
import { proposeSupplierUpdate } from "./propose-supplier-update";
import { proposeSupplierLogCommunication } from "./propose-supplier-log-communication";
import { proposeSupplierContactAdd } from "./propose-supplier-contact-add";
import { proposeGuestUpdate } from "./propose-guest-update";
import { proposeGuestSetRsvp } from "./propose-guest-set-rsvp";
import { proposeGuestArchive } from "./propose-guest-archive";
import { proposeHouseholdUpdate } from "./propose-household-update";
import { proposeBookSectionCreate } from "./propose-book-section-create";
import { proposeBookCardCreate } from "./propose-book-card-create";
import { proposeBookCardRename } from "./propose-book-card-rename";
import { proposeBookCardReplaceText } from "./propose-book-card-replace-text";
import { proposeBookFieldSet } from "./propose-book-field-set";
import { proposeBookRecipeUpdate } from "./propose-book-recipe-update";
import { proposeBookShotAdd } from "./propose-book-shot-add";
import { proposeBookShotUpdate } from "./propose-book-shot-update";
import { proposeBookOutfitUpdate } from "./propose-book-outfit-update";
import { proposeBookBuildUpdate } from "./propose-book-build-update";
import { proposeBookMenuUpdate } from "./propose-book-menu-update";
import { proposeBookBarUpdate } from "./propose-book-bar-update";
import { proposeBookSetupUpdate } from "./propose-book-setup-update";
import { proposeBookStayUpdate } from "./propose-book-stay-update";
import { proposeBookLodgingUpdate } from "./propose-book-lodging-update";
import { proposeBookDresscodeUpdate } from "./propose-book-dresscode-update";
import { proposeBookWpSetCell } from "./propose-book-weddingparty-set-cell";
import { proposeBookWpAddMember } from "./propose-book-weddingparty-add-member";
import { proposeBookWpAddItem } from "./propose-book-weddingparty-add-item";
import { proposeBookWpUpdateHeader } from "./propose-book-weddingparty-update-header";
import { proposeBudgetCategoryCreate } from "./propose-budget-category-create";
import { proposeBudgetLineCreate } from "./propose-budget-line-create";
import { proposeBudgetLineUpdate } from "./propose-budget-line-update";
import { proposePaymentCreate } from "./propose-payment-create";
import { proposePaymentUpdate } from "./propose-payment-update";
import { proposePaymentSetStatus } from "./propose-payment-set-status";
import { proposeQuestionAnswer } from "./propose-question-answer";
import { proposeSongAdd } from "./propose-song-add";
import { proposeCustomFieldSet } from "./propose-custom-field-set";
import { proposeSeatAssign } from "./propose-seat-assign";
// v2.8.0: planner build-out — file content read, agent product feedback,
// destructive kinds (snapshot-backed), and the MCP-only self-apply pair.
import { readFileContent } from "./read-file-content";
import { readEnhancements } from "./read-enhancements";
import { suggestEnhancement } from "./suggest-enhancement";
import { proposeTaskDelete } from "./propose-task-delete";
import { proposeEventDelete } from "./propose-event-delete";
import { proposeGuestHardDelete } from "./propose-guest-hard-delete";
import { proposeSupplierDelete } from "./propose-supplier-delete";
import { proposeSupplierContactRemove } from "./propose-supplier-contact-remove";
import { proposePaymentDelete } from "./propose-payment-delete";
import { proposeBudgetLineDelete } from "./propose-budget-line-delete";
import { proposeBudgetCategoryDelete } from "./propose-budget-category-delete";
import { proposeBookCardDelete } from "./propose-book-card-delete";
import { proposeBookSectionDelete } from "./propose-book-section-delete";
import { proposeSongRemove } from "./propose-song-remove";
import { proposeSeatingTableDelete } from "./propose-seating-table-delete";
import { applyProposals as applyProposalsTool, dismissProposals as dismissProposalsTool } from "./apply-proposals";

// AiTool<TSchema> is invariant in TSchema, so a heterogeneous list of
// tools with different Zod object shapes can't share a single default
// binding. `any` here loses input-type info at the registry boundary,
// which is fine — the handler is dispatched by name + safeParse'd
// against the tool's own schema before it's called.
// Ordering is deterministic and append-only within a release — the
// tool definitions render into the CACHED prompt prefix, so a stable
// order keeps the cache warm between turns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const READ_TOOLS: AiTool<any>[] = [
  readStats,
  readTasks,
  readEvents,
  readGuests,
  readBook,
  readBookCard,
  readBudget,
  readSuppliers,
  readProposals,
  readPayments,
  readSeating,
  readSongs,
  readFiles,
  // v2.8.0: planner build-out. read_enhancements is a read of the
  // agent's own feedback channel; suggest_enhancement WRITES (a direct
  // insert, not a proposal) but lives in the read list on purpose —
  // it touches no wedding data, needs no ai_write, and every caller
  // past the ai_chat gate may file product feedback.
  readFileContent,
  readEnhancements,
  suggestEnhancement,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WRITE_TOOLS: AiTool<any>[] = [
  proposeTask,
  proposeTaskUpdate,
  proposeTaskBreakdown,
  proposeEvent,
  proposeEventUpdate,
  proposeSupplierCreate,
  proposeSupplierUpdate,
  proposeSupplierLogCommunication,
  proposeSupplierContactAdd,
  proposeGuestUpdate,
  proposeGuestSetRsvp,
  proposeGuestArchive,
  proposeHouseholdUpdate,
  proposeBookSectionCreate,
  proposeBookCardCreate,
  proposeBookCardRename,
  proposeBookCardReplaceText,
  proposeBookFieldSet,
  proposeBookRecipeUpdate,
  proposeBookShotAdd,
  proposeBookShotUpdate,
  proposeBookOutfitUpdate,
  proposeBookBuildUpdate,
  proposeBookMenuUpdate,
  proposeBookBarUpdate,
  proposeBookSetupUpdate,
  proposeBookStayUpdate,
  proposeBookLodgingUpdate,
  proposeBookDresscodeUpdate,
  proposeBookWpSetCell,
  proposeBookWpAddMember,
  proposeBookWpAddItem,
  proposeBookWpUpdateHeader,
  proposeBudgetCategoryCreate,
  proposeBudgetLineCreate,
  proposeBudgetLineUpdate,
  proposePaymentCreate,
  proposePaymentUpdate,
  proposePaymentSetStatus,
  proposeQuestionAnswer,
  proposeSongAdd,
  proposeCustomFieldSet,
  proposeSeatAssign,
  // v2.8.0: destructive kinds — permanent deletes with a recovery
  // snapshot written to AiProposal.metadata at apply time. Ordering
  // stays append-only (prompt-cache rule above).
  proposeTaskDelete,
  proposeEventDelete,
  proposeGuestHardDelete,
  proposeSupplierDelete,
  proposeSupplierContactRemove,
  proposePaymentDelete,
  proposeBudgetLineDelete,
  proposeBudgetCategoryDelete,
  proposeBookCardDelete,
  proposeBookSectionDelete,
  proposeSongRemove,
  proposeSeatingTableDelete,
];

// v2.8.0: MCP-only self-apply pair. NOT in WRITE_TOOLS — the in-app
// chat must never list them (chat contexts have no ctx.canApply), and
// they are not propose tools (no proposal_created SSE semantics).
// They ARE in BY_NAME below so dispatch reaches them; their handlers
// hard-refuse without ctx.canApply as the second line of defence.
const APPLY_TOOLS: AiTool<any>[] = [applyProposalsTool, dismissProposalsTool]; // eslint-disable-line @typescript-eslint/no-explicit-any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_TOOLS: AiTool<any>[] = [...READ_TOOLS, ...WRITE_TOOLS, ...APPLY_TOOLS];

const BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t] as const));

/** Return tool definitions to expose to the model.
 *  When `canWrite` is false, propose_* tools are hidden entirely —
 *  the model can't call them, so it won't try. Handlers still gate
 *  again as belt-and-braces.
 *  v2.8.0: `canApply` additionally lists the MCP self-apply pair —
 *  only the MCP route ever passes it (per-token flag), so the in-app
 *  chat's tool list is unchanged. */
export function toolDefinitions(opts?: { canWrite?: boolean; canApply?: boolean }): Anthropic.Tool[] {
  const tools = opts?.canWrite
    ? opts?.canApply
      ? [...READ_TOOLS, ...WRITE_TOOLS, ...APPLY_TOOLS]
      : [...READ_TOOLS, ...WRITE_TOOLS]
    : READ_TOOLS;
  return tools.map((t) => t.definition);
}

/** Tool names classified as "creates a proposal". Used by the chat
 *  loop to emit a proposal_created SSE event after a successful call. */
const PROPOSE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));
export function isProposeTool(name: string): boolean {
  return PROPOSE_TOOL_NAMES.has(name);
}

/** v2.7.0: registry-miss check for the MCP dispatch layer — an unknown
 *  tool name is a protocol-level -32602 there, not a tool result. */
export function hasTool(name: string): boolean {
  return BY_NAME.has(name);
}

export function progressLabelFor(name: string): string {
  return BY_NAME.get(name)?.progressLabel ?? `Running ${name}…`;
}

// v2.4.0: hard ceiling on serialized tool-result size. read_book_card
// on a 200-shot list (or a pasted-novel notes field) must not evict
// chat history from the context window. Truncation happens on the
// serialized text — the model gets a clear marker telling it to
// narrow the query rather than silently missing rows.
const MAX_TOOL_RESULT_CHARS = 24_000;

function capText(text: string): string {
  if (text.length <= MAX_TOOL_RESULT_CHARS) return text;
  return (
    text.slice(0, MAX_TOOL_RESULT_CHARS) +
    `\n…[truncated at ${MAX_TOOL_RESULT_CHARS} chars — narrow your query with filters or a smaller limit]`
  );
}

/** Look up a tool by name and run it. Returns a text-serialisable
 *  string suitable for a tool_result content block. */
export async function runTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<{ result: ToolResult; text: string }> {
  const tool = BY_NAME.get(name);
  if (!tool) {
    const result: ToolResult = { ok: false, error: `Unknown tool: ${name}` };
    return { result, text: JSON.stringify(result) };
  }

  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) {
    const result: ToolResult = {
      ok: false,
      error: `Invalid input for ${name}: ${parsed.error.message}`,
    };
    return { result, text: JSON.stringify(result) };
  }

  try {
    const result = await tool.handler(parsed.data, ctx);
    return { result, text: capText(JSON.stringify(result)) };
  } catch (err) {
    const result: ToolResult = {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown tool error.",
    };
    return { result, text: JSON.stringify(result) };
  }
}
