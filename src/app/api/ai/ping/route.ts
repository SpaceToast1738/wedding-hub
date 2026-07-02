// v2.1.0: /api/ai/ping — smoke test proving the whole AI pipeline
// (auth gate → kill-switch → budget guard → SDK call → AiUsage row →
// audit log) works end-to-end. Costs one output token. Removable
// once the real chat endpoint ships in phase 1.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/actions";
import { AI_ENABLED, AiDisabledError } from "@/lib/ai/config";
import { sendMessage } from "@/lib/ai/client";
import { BudgetExceeded, RateLimited } from "@/lib/ai/guards";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!AI_ENABLED) {
    return NextResponse.json({ ok: false, error: "AI disabled" }, { status: 503 });
  }

  const user = await requireUser();

  try {
    const result = await sendMessage({
      userId: user.id,
      feature: "ping",
      tier: "fast",
      maxTokens: 8,
      system: "Reply with a single word: pong.",
      messages: [{ role: "user", content: "ping" }],
    });

    const reply = result.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();

    return NextResponse.json({
      ok: true,
      model: result.model,
      costPence: result.costPence,
      reply,
    });
  } catch (err) {
    if (err instanceof AiDisabledError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    if (err instanceof BudgetExceeded) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          spentPence: err.spentPence,
          capPence: err.capPence,
        },
        { status: 429 },
      );
    }
    if (err instanceof RateLimited) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 429 });
    }
    console.error("ai ping failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
