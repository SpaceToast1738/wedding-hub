// v2.1.0 phase 1: POST /api/ai/chat — SSE streaming chat.
//
// Accepts { threadId?: string, text: string }, drives one turn
// through src/lib/ai/chat.ts, and writes each event as an SSE frame.
// Errors during streaming come back as a final `error` event so the
// client can render them without needing a status-code branch.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/actions";
import { AI_ENABLED } from "@/lib/ai/config";
import { runChatTurn, type ChatEvent } from "@/lib/ai/chat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { threadId?: string; text?: string; pathname?: string };

function sseFrame(event: ChatEvent): string {
  // SSE: `event: <type>\ndata: <json>\n\n` — clients that parse SSE
  // will get discriminated events; browsers streaming via fetch
  // (which is what the ChatPanel uses) get one delimited JSON blob
  // per event.
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  if (!AI_ENABLED) {
    return NextResponse.json({ error: "AI disabled" }, { status: 503 });
  }

  const user = await requireUser();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad JSON body" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json(
      { error: "Message too long — keep it under 4000 characters." },
      { status: 400 },
    );
  }

  // v2.2.0: page context from the panel. Client input that lands in
  // the system prompt — allowlist, don't blocklist. App routes are
  // exclusively slug/cuid segments, so anything outside this charset
  // (spaces, quotes, angle brackets, newlines) is dropped wholesale
  // rather than trimmed.
  const pathname =
    typeof body.pathname === "string" &&
    /^\/[A-Za-z0-9\-_/.]{0,199}$/.test(body.pathname)
      ? body.pathname
      : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runChatTurn({
          user,
          threadId: body.threadId ?? null,
          text,
          pathname,
        })) {
          controller.enqueue(encoder.encode(sseFrame(event)));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown chat error.";
        console.error("chat route crashed", err);
        controller.enqueue(
          encoder.encode(sseFrame({ type: "error", error: message })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
