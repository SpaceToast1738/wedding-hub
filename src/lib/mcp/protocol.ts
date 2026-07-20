// v2.7.0: MCP (Model Context Protocol) — pure protocol layer.
//
// Wedding Hub exposes its AI tool registry to LAN MCP clients via a
// stateless streamable-HTTP endpoint (POST /api/mcp). This module is
// the JSON-RPC/MCP state machine: message in, outcome out. It imports
// NOTHING from the app — the route wires the registry through the
// `ProtocolDeps` seam, and the unit tests inject fakes with no mocks.
//
// Deliberate protocol subset (documented in docs/MCP.md):
// - Stateless: no Mcp-Session-Id, no GET/SSE channel, one JSON-RPC
//   message per POST. JSON-RPC batch arrays are rejected (-32600) —
//   removed from the spec in 2025-06-18; no mainstream client sends
//   them.
// - The MCP-Protocol-Version request header is ignored: this server
//   behaves identically across every revision it supports, so there
//   is nothing to vary on.
//
// Hard-won classification rules (each broke a real client in review):
// - A message is a notification iff it has NO `id` member. Never use
//   truthiness — SDK clients number requests from 0, so the very
//   first request (initialize) arrives with `"id": 0`.
// - `id: null` is invalid per MCP (stricter than base JSON-RPC) and
//   gets -32600.
// - Responses echo the request id verbatim, preserving JSON type.

export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export const SERVER_NAME = "wedding-hub";

// JSON-RPC 2.0 error codes (plus the implementation-defined range).
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;

export type JsonRpcId = string | number;

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: unknown;
  error?: { code: number; message: string };
};

/** What the tool-calling seam returns. `unknownTool` distinguishes a
 *  registry miss (→ -32602 per spec) from a tool that ran and failed
 *  (→ isError result — the model can read the message and self-correct). */
export type ToolCallOutput = {
  text: string;
  isError: boolean;
  unknownTool?: boolean;
};

export type McpToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

// v2.8.2: prompts capability. Shapes mirror the MCP prompts spec —
// prompts/list returns definitions, prompts/get returns a message list.
export type McpPromptListItem = {
  name: string;
  description: string;
  arguments?: { name: string; description: string; required?: boolean }[];
};
export type McpPromptGetResult = {
  description: string;
  messages: { role: "user" | "assistant"; content: { type: "text"; text: string } }[];
};

export type ProtocolDeps = {
  serverVersion: string;
  listTools: () => McpToolDef[];
  callTool: (name: string, args: unknown) => Promise<ToolCallOutput>;
  // v2.8.2: canned planner workflows. getPrompt returns null for an
  // unknown name (→ -32602), matching the tools/call unknown-tool path.
  listPrompts: () => McpPromptListItem[];
  getPrompt: (name: string, args: Record<string, string>) => McpPromptGetResult | null;
};

/** The route maps outcomes to HTTP: `response` → 200 + body (JSON-RPC
 *  errors included — SDK clients treat non-2xx as transport failure and
 *  never read the body); `notification` → 202, empty body. */
export type ProtocolOutcome =
  | { kind: "response"; body: JsonRpcResponse }
  | { kind: "notification" };

function errorResponse(id: JsonRpcId | null, code: number, message: string): ProtocolOutcome {
  return { kind: "response", body: { jsonrpc: "2.0", id, error: { code, message } } };
}

function resultResponse(id: JsonRpcId, result: unknown): ProtocolOutcome {
  return { kind: "response", body: { jsonrpc: "2.0", id, result } };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Handle one parsed JSON-RPC message. The caller has already dealt
 *  with transport concerns (auth, body caps, unparseable JSON). */
export async function handleMcpMessage(
  msg: unknown,
  deps: ProtocolDeps,
): Promise<ProtocolOutcome> {
  if (Array.isArray(msg)) {
    return errorResponse(null, INVALID_REQUEST, "Batch requests are not supported");
  }
  if (!isPlainObject(msg) || msg.jsonrpc !== "2.0") {
    return errorResponse(null, INVALID_REQUEST, "Not a JSON-RPC 2.0 message");
  }

  const method = msg.method;
  if (typeof method !== "string") {
    const id = "id" in msg && isValidId(msg.id) ? (msg.id as JsonRpcId) : null;
    return errorResponse(id, INVALID_REQUEST, "Missing method");
  }

  // Notification: no `id` member at all. (Presence check, NOT
  // truthiness — initialize arrives with id 0 from SDK clients.)
  if (!("id" in msg)) {
    // Unknown notifications are ignored per JSON-RPC — there is no id
    // to address an error to.
    return { kind: "notification" };
  }

  if (!isValidId(msg.id)) {
    // MCP forbids null ids (and base JSON-RPC forbids the rest).
    return errorResponse(null, INVALID_REQUEST, "Invalid request id");
  }
  const id = msg.id as JsonRpcId;
  const params = isPlainObject(msg.params) ? msg.params : {};

  switch (method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      // Counter-offer is the HOT path: current clients request newer
      // revisions than we support and accept the counter-offer.
      const negotiated = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
        ? requested
        : LATEST_PROTOCOL_VERSION;
      return resultResponse(id, {
        protocolVersion: negotiated,
        // v2.8.2: declare prompts alongside tools. listChanged is
        // omitted on both — the sets are static per release.
        capabilities: { tools: {}, prompts: {} },
        serverInfo: { name: SERVER_NAME, version: deps.serverVersion },
        // Keep this tight — it lands in every connected client's
        // context. The fuller ripple-map version lives in the
        // consistency_check prompt (src/lib/mcp/prompts.ts).
        instructions:
          "Wedding Hub planning data for Jamie & Bryony's wedding. " +
          "read_* tools return live data. propose_* tools never write " +
          "directly — they create proposals that a human reviews and " +
          "applies (or dismisses) in the app's AI page. " +
          "When proposing any update, consider what else references the " +
          "same fact (a date shift ripples into schedule, stays and " +
          "payment due dates; a booking into contacts, contract, budget " +
          "and payments; an RSVP into seating, meals and headcounts) — " +
          "propose the consistency fixes in the same batch (shared " +
          "batchKey), or say explicitly what you left stale. The " +
          "consistency_check prompt has the full ripple map.",
      });
    }

    case "ping":
      return resultResponse(id, {});

    case "tools/list":
      // No pagination: the full list is small and static per release.
      // A cursor param, if sent, is deliberately ignored.
      return resultResponse(id, { tools: deps.listTools() });

    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string" || name.length === 0) {
        return errorResponse(id, INVALID_PARAMS, "tools/call requires a string `name`");
      }
      const args = "arguments" in params ? params.arguments : {};
      if (args !== undefined && !isPlainObject(args)) {
        return errorResponse(id, INVALID_PARAMS, "`arguments` must be an object");
      }
      const out = await deps.callTool(name, args ?? {});
      if (out.unknownTool) {
        // The spec's canonical -32602 example is exactly "Unknown tool".
        return errorResponse(id, INVALID_PARAMS, `Unknown tool: ${name}`);
      }
      return resultResponse(id, {
        content: [{ type: "text", text: out.text }],
        isError: out.isError,
      });
    }

    case "prompts/list":
      // Static, small — no pagination (a cursor param is ignored, as in
      // tools/list).
      return resultResponse(id, { prompts: deps.listPrompts() });

    case "prompts/get": {
      const name = params.name;
      if (typeof name !== "string" || name.length === 0) {
        return errorResponse(id, INVALID_PARAMS, "prompts/get requires a string `name`");
      }
      // The spec types prompt arguments as strings; ignore non-object
      // arguments rather than reject (lenient, like tools/call).
      const rawArgs = isPlainObject(params.arguments) ? params.arguments : {};
      const args: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawArgs)) {
        if (typeof v === "string") args[k] = v;
      }
      const result = deps.getPrompt(name, args);
      if (!result) {
        // Same -32602 treatment as an unknown tool.
        return errorResponse(id, INVALID_PARAMS, `Unknown prompt: ${name}`);
      }
      return resultResponse(id, result);
    }

    default:
      return errorResponse(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

function isValidId(id: unknown): boolean {
  return typeof id === "string" || (typeof id === "number" && Number.isFinite(id));
}
