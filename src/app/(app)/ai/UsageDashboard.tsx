// v2.1.0 phase 4: usage dashboard block for /ai.
// Server component: aggregates AiUsage rows for this calendar month
// and renders a per-feature breakdown + a per-day sparkline-style
// bar strip. No client state.

import { db } from "@/lib/db";

const FEATURE_LABELS: Record<string, string> = {
  chat: "Chat",
  ping: "Smoke tests",
  "summarize-card": "Book summarize",
  "parse-guest-list": "Guest paste",
  "suggest-tasks": "Task suggestions",
  "suggest-due-dates": "Due-date suggestions",
  "generate-timeline": "Timeline generate",
  "draft-guest-message": "Message drafts",
  "review-wedding": "State-of-wedding review",
};

function label(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

function pence(p: number): string {
  return `£${(p / 100).toFixed(2)}`;
}

export async function UsageDashboard() {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const rows = await db.aiUsage.findMany({
    where: { createdAt: { gte: startOfMonth } },
    select: {
      costPence: true,
      feature: true,
      inputTokens: true,
      outputTokens: true,
      createdAt: true,
    },
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border-soft bg-surface p-4 text-sm text-ink-secondary">
        No AI calls this month yet. As soon as the chat panel or a one-shot
        feature runs, the breakdown lands here.
      </div>
    );
  }

  // ── By feature ──────────────────────────────────────────────────
  const byFeature = new Map<
    string,
    { pence: number; count: number; inputTokens: number; outputTokens: number }
  >();
  for (const r of rows) {
    const cur = byFeature.get(r.feature) ?? {
      pence: 0,
      count: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    cur.pence += r.costPence;
    cur.count += 1;
    cur.inputTokens += r.inputTokens;
    cur.outputTokens += r.outputTokens;
    byFeature.set(r.feature, cur);
  }
  const featureRows = [...byFeature.entries()].sort(
    (a, b) => b[1].pence - a[1].pence,
  );

  // ── By day ──────────────────────────────────────────────────────
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const day = r.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + r.costPence);
  }
  const days = [...byDay.entries()].sort();
  const maxDay = Math.max(1, ...days.map(([, p]) => p));

  return (
    <div className="rounded-md border border-border-soft bg-surface p-4 space-y-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
          By feature
        </div>
        <table className="w-full text-sm">
          <tbody>
            {featureRows.map(([feature, stats]) => (
              <tr key={feature} className="border-b border-border-soft last:border-0">
                <td className="py-1.5 text-ink-primary">{label(feature)}</td>
                <td className="py-1.5 text-right tabular-nums text-ink-secondary">
                  {stats.count}× · {(stats.inputTokens + stats.outputTokens).toLocaleString()} tokens
                </td>
                <td className="py-1.5 text-right tabular-nums text-ink-primary pl-4">
                  {pence(stats.pence)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {days.length > 1 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
            Daily spend
          </div>
          <div className="flex items-end gap-1 h-16">
            {days.map(([day, p]) => (
              <div
                key={day}
                className="flex-1 min-w-0 flex flex-col justify-end items-center"
                title={`${day} · ${pence(p)}`}
              >
                <div
                  className="w-full bg-ink-primary/70 rounded-sm"
                  style={{ height: `${Math.round((p / maxDay) * 100)}%` }}
                />
                <div className="text-[10px] text-ink-tertiary mt-1 truncate w-full text-center">
                  {day.slice(5)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
