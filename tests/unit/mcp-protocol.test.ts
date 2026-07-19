import { describe, expect, it, vi } from "vitest";
import {
  handleMcpMessage,
  INVALID_PARAMS,
  INVALID_REQUEST,
  LATEST_PROTOCOL_VERSION,
  METHOD_NOT_FOUND,
  SERVER_NAME,
  type JsonRpcResponse,
  type McpToolDef,
  type ProtocolDeps,
  type ProtocolOutcome,
} from "@/lib/mcp/protocol";

// v2.7.0: MCP protocol state machine. The module is pure — the route
// wires the real registry through the ProtocolDeps seam, and these
// tests inject fakes, so there is no vi.mock anywhere in this file.
//
// The classification edge cases here each broke a real client during
// design review, which is why they get their own tests:
// - SDK clients number requests from 0, so `initialize` arrives with
//   `"id": 0`. A truthiness check would misread it as a notification
//   (202, empty body) and hang the client forever on its first message.
// - Current clients request protocol revisions newer than we support
//   and accept a counter-offer — negotiation's counter branch is the
//   HOT path, not the fallback.
// - `id: null` is forbidden by MCP (stricter than base JSON-RPC).

const TOOLS: McpToolDef[] = [
  {
    name: "read_stats",
    description: "Read wedding stats",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "propose_task",
    description: "Propose a task",
    inputSchema: { type: "object", properties: { title: { type: "string" } } },
  },
];

function makeDeps(
  callTool?: ProtocolDeps["callTool"],
): ProtocolDeps & { callTool: ReturnType<typeof vi.fn> } {
  return {
    serverVersion: "2.7.0-test",
    listTools: () => TOOLS,
    callTool: vi.fn(callTool ?? (async () => ({ text: "ok", isError: false }))),
  };
}

// Narrow an outcome to its response body (fails the test on a
// notification outcome) so assertions read cleanly.
function responseBody(outcome: ProtocolOutcome): JsonRpcResponse {
  expect(outcome.kind).toBe("response");
  if (outcome.kind !== "response") throw new Error("expected a response outcome");
  return outcome.body;
}

describe("handleMcpMessage — initialize", () => {
  it('handles "id": 0 as a request, echoing id exactly 0 (SDK-client hot path)', async () => {
    const out = await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 0,
        method: "initialize",
        params: { protocolVersion: "2025-06-18" },
      },
      makeDeps(),
    );
    const body = responseBody(out);
    // Exactly 0 — not null, not "0". A truthiness bug here makes every
    // SDK client's first request vanish into a 202.
    expect(body.id).toBe(0);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.error).toBeUndefined();
    const result = body.result as {
      protocolVersion: string;
      capabilities: { tools: Record<string, never> };
      serverInfo: { name: string; version: string };
    };
    expect(result.protocolVersion).toBe("2025-06-18");
    expect(result.capabilities.tools).toEqual({});
    expect(result.serverInfo).toEqual({ name: SERVER_NAME, version: "2.7.0-test" });
  });

  it("echoes a supported requested version", async () => {
    const out = await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18" },
      },
      makeDeps(),
    );
    const result = responseBody(out).result as { protocolVersion: string };
    expect(result.protocolVersion).toBe("2025-06-18");
  });

  it("counter-offers the latest supported version for an unknown/newer request (HOT path)", async () => {
    // Current clients request 2025-11-25; they accept the counter-offer.
    const out = await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "initialize",
        params: { protocolVersion: "2025-11-25" },
      },
      makeDeps(),
    );
    const result = responseBody(out).result as { protocolVersion: string };
    expect(result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
    expect(result.protocolVersion).toBe("2025-06-18");
  });

  it("counter-offers when params are missing entirely", async () => {
    const out = await handleMcpMessage(
      { jsonrpc: "2.0", id: 3, method: "initialize" },
      makeDeps(),
    );
    const result = responseBody(out).result as { protocolVersion: string };
    expect(result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
  });
});

describe("handleMcpMessage — message classification", () => {
  it("treats a message with no id member as a notification", async () => {
    const out = await handleMcpMessage(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      makeDeps(),
    );
    expect(out.kind).toBe("notification");
  });

  it("ignores unknown notification methods (no id to address an error to)", async () => {
    const out = await handleMcpMessage(
      { jsonrpc: "2.0", method: "notifications/definitely-not-real" },
      makeDeps(),
    );
    expect(out.kind).toBe("notification");
  });

  it('rejects "id": null with -32600 (MCP forbids null ids)', async () => {
    const out = await handleMcpMessage(
      { jsonrpc: "2.0", id: null, method: "ping" },
      makeDeps(),
    );
    const body = responseBody(out);
    expect(body.id).toBe(null);
    expect(body.error?.code).toBe(INVALID_REQUEST);
  });

  it("preserves a string id verbatim", async () => {
    const out = await handleMcpMessage(
      { jsonrpc: "2.0", id: "abc", method: "ping" },
      makeDeps(),
    );
    expect(responseBody(out).id).toBe("abc");
  });

  it("preserves the empty-string id verbatim", async () => {
    const out = await handleMcpMessage(
      { jsonrpc: "2.0", id: "", method: "ping" },
      makeDeps(),
    );
    expect(responseBody(out).id).toBe("");
  });

  it("preserves id 0 verbatim on non-initialize methods too", async () => {
    const out = await handleMcpMessage(
      { jsonrpc: "2.0", id: 0, method: "ping" },
      makeDeps(),
    );
    expect(responseBody(out).id).toBe(0);
  });
});

describe("handleMcpMessage — malformed envelopes", () => {
  it("rejects batch arrays with -32600 (removed in 2025-06-18)", async () => {
    const out = await handleMcpMessage(
      [{ jsonrpc: "2.0", id: 1, method: "ping" }],
      makeDeps(),
    );
    const body = responseBody(out);
    expect(body.id).toBe(null);
    expect(body.error?.code).toBe(INVALID_REQUEST);
  });

  it("rejects non-object messages with -32600", async () => {
    for (const msg of ["hello", 42, null, true]) {
      const out = await handleMcpMessage(msg, makeDeps());
      expect(responseBody(out).error?.code).toBe(INVALID_REQUEST);
    }
  });

  it("rejects a missing jsonrpc member with -32600", async () => {
    const out = await handleMcpMessage({ id: 1, method: "ping" }, makeDeps());
    expect(responseBody(out).error?.code).toBe(INVALID_REQUEST);
  });

  it('rejects jsonrpc !== "2.0" with -32600', async () => {
    const out = await handleMcpMessage(
      { jsonrpc: "1.0", id: 1, method: "ping" },
      makeDeps(),
    );
    expect(responseBody(out).error?.code).toBe(INVALID_REQUEST);
  });

  it("rejects a missing method with -32600, echoing the id when valid", async () => {
    const out = await handleMcpMessage({ jsonrpc: "2.0", id: 7 }, makeDeps());
    const body = responseBody(out);
    expect(body.id).toBe(7);
    expect(body.error?.code).toBe(INVALID_REQUEST);
  });

  it("rejects an unknown method (with id) with -32601", async () => {
    const out = await handleMcpMessage(
      { jsonrpc: "2.0", id: 4, method: "resources/list" },
      makeDeps(),
    );
    const body = responseBody(out);
    expect(body.id).toBe(4);
    expect(body.error?.code).toBe(METHOD_NOT_FOUND);
    expect(body.error?.message).toContain("resources/list");
  });
});

describe("handleMcpMessage — ping and tools/list", () => {
  it("ping returns an empty object result", async () => {
    const out = await handleMcpMessage(
      { jsonrpc: "2.0", id: 5, method: "ping" },
      makeDeps(),
    );
    const body = responseBody(out);
    expect(body.id).toBe(5);
    expect(body.result).toEqual({});
  });

  it("tools/list returns the injected tool definitions", async () => {
    const out = await handleMcpMessage(
      { jsonrpc: "2.0", id: 6, method: "tools/list" },
      makeDeps(),
    );
    expect(responseBody(out).result).toEqual({ tools: TOOLS });
  });
});

describe("handleMcpMessage — tools/call", () => {
  it("happy path: wraps the tool text as content with isError false", async () => {
    const deps = makeDeps(async () => ({ text: "3 tasks due", isError: false }));
    const out = await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: { name: "read_stats", arguments: { limit: 5 } },
      },
      deps,
    );
    const body = responseBody(out);
    expect(body.id).toBe(10);
    expect(body.result).toEqual({
      content: [{ type: "text", text: "3 tasks due" }],
      isError: false,
    });
    expect(deps.callTool).toHaveBeenCalledWith("read_stats", { limit: 5 });
  });

  it("tool ran but failed: isError true result, NOT a JSON-RPC error", async () => {
    // Execution failures stay as tool results so the model can read
    // the message and self-correct.
    const deps = makeDeps(async () => ({ text: "section access denied", isError: true }));
    const out = await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: { name: "read_stats", arguments: {} },
      },
      deps,
    );
    const body = responseBody(out);
    expect(body.error).toBeUndefined();
    expect(body.result).toEqual({
      content: [{ type: "text", text: "section access denied" }],
      isError: true,
    });
  });

  it("unknown tool name: -32602 mentioning the name (registry miss, not a tool result)", async () => {
    const deps = makeDeps(async () => ({ text: "", isError: true, unknownTool: true }));
    const out = await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 12,
        method: "tools/call",
        params: { name: "read_nonexistent", arguments: {} },
      },
      deps,
    );
    const body = responseBody(out);
    expect(body.result).toBeUndefined();
    expect(body.error?.code).toBe(INVALID_PARAMS);
    expect(body.error?.message).toContain("read_nonexistent");
  });

  it("missing name: -32602", async () => {
    const deps = makeDeps();
    const out = await handleMcpMessage(
      { jsonrpc: "2.0", id: 13, method: "tools/call", params: { arguments: {} } },
      deps,
    );
    expect(responseBody(out).error?.code).toBe(INVALID_PARAMS);
    expect(deps.callTool).not.toHaveBeenCalled();
  });

  it("non-object arguments: -32602", async () => {
    const deps = makeDeps();
    for (const args of ["a string", [1, 2], 42]) {
      const out = await handleMcpMessage(
        {
          jsonrpc: "2.0",
          id: 14,
          method: "tools/call",
          params: { name: "read_stats", arguments: args },
        },
        deps,
      );
      expect(responseBody(out).error?.code).toBe(INVALID_PARAMS);
    }
    expect(deps.callTool).not.toHaveBeenCalled();
  });

  it("missing arguments: callTool receives an empty object", async () => {
    const deps = makeDeps();
    const out = await handleMcpMessage(
      { jsonrpc: "2.0", id: 15, method: "tools/call", params: { name: "read_stats" } },
      deps,
    );
    expect(responseBody(out).error).toBeUndefined();
    expect(deps.callTool).toHaveBeenCalledWith("read_stats", {});
  });
});
