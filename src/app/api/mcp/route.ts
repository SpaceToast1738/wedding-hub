// v2.7.0: MCP server endpoint — stateless streamable HTTP.
//
// LAN-only by three independent layers:
//   1. Caddy's public :80 block 403s /api/mcp* (the Cloudflare Tunnel
//      can never reach it);
//   2. the Host allowlist below (works even if the host-side Caddyfile
//      sync hasn't landed — public-path requests arrive with the
//      public hostname and die here);
//   3. per-user bearer tokens (Settings → MCP tokens), hashed in the DB.
// The LAN listener is Caddy :8090 → this route (see caddy/Caddyfile).
//
// HTTP status contract (SDK clients treat non-2xx as a transport
// failure BEFORE reading the body, so JSON-RPC error objects must ride
// 200): 200 any JSON-RPC response, 202 notification, 400 unparseable
// body, 401 auth (+ WWW-Authenticate so clients report a clean auth
// failure instead of probing OAuth discovery), 403 host/origin,
// 405 GET/DELETE, 413 body cap, 415 content type, 429 auth-failure
// rate limit, 503 kill-switch.
//
// This file is deliberately thin: protocol logic lives in
// src/lib/mcp/protocol.ts (pure, DI seam), token auth in
// src/lib/mcp/auth.ts. Permission gates mirror the chat loop exactly
// (src/lib/ai/chat.ts:105,199): canView("ai_chat") for anything beyond
// the handshake, canEdit("ai_write") → ctx.canWrite. Tool calls cost
// nothing (no Anthropic usage), so the AI budget/rate guards don't
// apply; the only limiter here is on failed auth attempts.

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";
import { canEdit, canView } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { checkMcpAuthLimit, recordFailedMcpAuth } from "@/lib/rate-limit";
import { verifyMcpToken } from "@/lib/mcp/auth";
import {
  handleMcpMessage,
  PARSE_ERROR,
  type JsonRpcId,
  type ProtocolDeps,
} from "@/lib/mcp/protocol";
import { hasTool, runTool, toolDefinitions } from "@/lib/ai/tools/registry";
import type { ToolContext } from "@/lib/ai/tools/types";
import { listPrompts, getPrompt } from "@/lib/mcp/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

// JSON-RPC implementation-defined server-error code for "authenticated
// but not permitted" — distinct from -32602 so clients surface it as a
// server-side policy refusal, not a malformed call.
const PERMISSION_DENIED = -32001;

function mcpEnabled(): boolean {
  // Same default-on semantics as AI_ENABLED (src/lib/ai/config.ts).
  return process.env.MCP_ENABLED !== "false";
}

// v2.7.1: comma-separated allowlist. Beyond the Caddy LAN listener,
// the endpoint is reachable over the user's tailnet: the mcp-proxy
// compose service (bridge-only socat) publishes :8090 on Tower's own
// IPs and relays to caddy — needed because macvlan isolation stops
// Tower reaching 192.168.50.25, and Docker skips ports: publishing
// for macvlan-primary containers. Tailscale traffic is WireGuard-
// encrypted, so plain HTTP is fine there. Still never internet-
// exposed: the Cloudflare Tunnel only routes :80, which 403s /api/mcp.
function allowedHosts(): string[] {
  return (process.env.MCP_LAN_HOST ?? "192.168.50.25:8090")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

function isAllowedHost(host: string | null): boolean {
  if (!host) return false;
  if (allowedHosts().includes(host)) return true;
  // localhost is fine: not remotely reachable, needed for dev + e2e,
  // and DNS rebinding always arrives under an attacker hostname.
  const hostname = host.split(":")[0]?.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "unauthorized" },
    { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
  );
}

function clientIp(req: Request): string {
  // First X-Forwarded-For hop only — Caddy ≥2.5 replaces untrusted
  // clients' X-Forwarded-* headers, so this is the real LAN peer on
  // the proxied path. Never x-real-ip (not Caddy-managed by default).
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "direct";
}

/** Read the body counting BYTES as chunks arrive; null once the cap is
 *  exceeded (the reader is cancelled — nothing further is buffered). */
async function readBodyCapped(req: Request): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(req: Request): Promise<Response> {
  if (!mcpEnabled()) {
    return NextResponse.json({ error: "MCP is disabled" }, { status: 503 });
  }
  if (!isAllowedHost(req.headers.get("host"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Spec MUST: reject browser-originating requests (DNS-rebinding
  // defence). Real MCP clients are not browsers and never send Origin.
  if (req.headers.get("origin") !== null) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return NextResponse.json({ error: "unsupported media type" }, { status: 415 });
  }

  // Fast-path 413 on the declared length — covers every real client
  // (fetch always sends Content-Length for string bodies) without
  // reading a byte. Chunked bodies are caught by the capped read below.
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  const authz = req.headers.get("authorization");
  if (!authz?.startsWith("Bearer ")) {
    // No Authorization header → plain 401, no DB writes, no body read.
    // Cross-site no-cors requests can't set the header, so they can't
    // burn the rate-limit bucket or spam audit rows.
    return unauthorized();
  }

  const ip = clientIp(req);
  const limit = await checkMcpAuthLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "too many failed auth attempts" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const verified = await verifyMcpToken(authz.slice("Bearer ".length).trim());
  if (!verified) {
    // The failure row goes in FIRST, then the audit write is skipped
    // once the post-write count is over budget — so a parallel burst
    // from one IP can overshoot the attempt rows (they self-prune in
    // 5 minutes) but cannot flood the 30-day-retention audit log.
    await recordFailedMcpAuth(ip);
    const postWrite = await checkMcpAuthLimit(ip);
    if (postWrite.ok) {
      await logAudit({
        action: "mcp_auth_failed",
        entity: "McpToken",
        ip,
        metadata: { summary: "MCP request with an invalid or revoked token" },
      });
    }
    return unauthorized();
  }
  // v2.8.0: canApply is a property of the presented TOKEN, not the
  // user — verifyMcpToken returns both so the same member can hold a
  // self-applying token and a propose-only one.
  const { user, canApply } = verified;

  // Byte-capped incremental read, only after auth: the cap exists for
  // callers that bypass Caddy's 2MB request_body limit by reaching
  // web:3000 directly, and it must bound MEMORY, not just respond 413
  // after buffering — so count BYTES as chunks arrive and abort past
  // the cap (string .length would count UTF-16 code units, ~3x looser
  // for multibyte payloads).
  const raw = await readBodyCapped(req);
  if (raw === null) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: PARSE_ERROR, message: "Parse error" } },
      { status: 400 },
    );
  }

  // Permission gate, mirroring the chat loop's canView("ai_chat")
  // (src/lib/ai/chat.ts:105). The handshake (initialize/ping) stays
  // open to any valid token so clients can connect and report a clean
  // permission error instead of a mysterious transport failure.
  const peek = typeof msg === "object" && msg !== null && !Array.isArray(msg)
    ? (msg as Record<string, unknown>)
    : undefined;
  const method = typeof peek?.method === "string" ? peek.method : "";
  const isNotification = peek !== undefined && !("id" in peek);
  const handshake = method === "initialize" || method === "ping";
  if (!handshake && !(await canView(user, "ai_chat"))) {
    if (isNotification) return new Response(null, { status: 202 });
    const id = peek && (typeof peek.id === "string" || typeof peek.id === "number")
      ? (peek.id as JsonRpcId)
      : null;
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: PERMISSION_DENIED,
        message:
          "MCP access requires the AI chat permission (ai_chat) — ask the couple to grant it in Settings",
      },
    });
  }

  const canWrite = await canEdit(user, "ai_write");
  // v2.8.1: batchId is (re)derived per tools/call in the callTool closure
  // below from an optional `batchKey` argument — pass the same key across
  // calls to group their proposals into one reviewable /ai batch. This
  // random default only stands in for the handshake path, where no tool —
  // and therefore no proposal — ever runs. See docs/MCP.md.
  const ctx: ToolContext = {
    user,
    canWrite,
    batchId: randomUUID(),
    proposalsCreated: { count: 0 },
    // v2.8.0: token-level apply rights — the apply/dismiss tools check
    // this on top of canWrite. Chat contexts never set it.
    canApply,
  };

  const deps: ProtocolDeps = {
    serverVersion: APP_VERSION,
    listTools: () =>
      toolDefinitions({ canWrite, canApply }).map((d) => ({
        name: d.name,
        description: d.description ?? "",
        inputSchema: d.input_schema as Record<string, unknown>,
      })),
    callTool: async (name, args) => {
      if (!hasTool(name)) return { text: "", isError: true, unknownTool: true };
      // v2.8.1: opt-in batch grouping. The model can only influence a
      // tool's `arguments` (never JSON-RPC `_meta`), so a shared
      // `batchKey` string threaded through several tools/call requests
      // groups their proposals into one reviewable /ai batch. Namespaced
      // by user id so two members can't collide on the same key. Absent
      // (or blank) → a fresh random id per call, so proposals stay
      // singletons as before. The tools' own non-strict Zod schemas drop
      // the extra key on safeParse, so no per-tool schema edit is needed.
      const batchKey =
        typeof args === "object" && args !== null && !Array.isArray(args)
          ? (args as Record<string, unknown>).batchKey
          : undefined;
      ctx.batchId =
        typeof batchKey === "string" && batchKey.length > 0
          ? `mcp:${user.id}:${batchKey}`
          : randomUUID();
      const { result, text } = await runTool(name, args, ctx);
      return { text, isError: !result.ok };
    },
    // v2.8.2: canned planner workflows (pure data — no gate beyond the
    // ai_chat check already applied above to reach any non-handshake
    // method).
    listPrompts,
    getPrompt,
  };

  const outcome = await handleMcpMessage(msg, deps);
  if (outcome.kind === "notification") return new Response(null, { status: 202 });
  return NextResponse.json(outcome.body);
}

// Stateless server: no GET/SSE notification channel, no sessions to
// DELETE. 405 with Allow tells spec-following clients not to retry.
export function GET(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
