// v2.1.0 phase 0: /ai — proposal review dashboard placeholder.
//
// Phase 1 fills in the pending-proposal list; phase 2 adds the
// dashboard header (weekly spend chart, per-feature breakdown).
//
// v2.5.0: reordered — Pending proposals (the page's actual job) now
// leads, ahead of the spend dashboard, state-of-the-wedding summary,
// and guest-parsing tool that used to bury it fifth on the page. Cap
// + per-feature usage are merged into one "Usage & spend" section
// further down, and the smoke test (developer-facing, technical copy)
// is couple-only now that the chat pipeline has months of production
// use behind it — not something a wedding-party member needs to see.

import Link from "next/link";
import { requireUser } from "@/lib/actions";
import { canEdit, canView } from "@/lib/permissions";
import { readCapState } from "@/lib/ai/guards";
import { AI_ENABLED } from "@/lib/ai/config";
import { PageHeader } from "@/components/ui/PageHeader";
import { PingButton } from "./PingButton";
import { listPendingProposals } from "./actions";
import { groupByBatch } from "@/lib/ai/proposals/grouping";
import { ProposalReviewCard } from "./ProposalReviewCard";
import { ProposalBatchGroup } from "./ProposalBatchGroup";
import { ParseGuestsPanel } from "./ParseGuestsPanel";
import { UsageDashboard } from "./UsageDashboard";
import { WeddingReviewPanel } from "./WeddingReviewPanel";
import { listEnhancementSuggestions } from "./enhancement-actions";
import { EnhancementsPanel } from "./EnhancementsPanel";

export const dynamic = "force-dynamic";

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export default async function AiPage() {
  const user = await requireUser();
  const allowed = await canView(user, "ai_chat");
  if (!allowed) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="AI planner" />
        <div className="p-6 text-sm text-ink-secondary">
          You don&rsquo;t have access to the AI planner. Ask the couple to grant
          you access from the Settings page.
        </div>
      </div>
    );
  }

  const [cap, pending, canApply, enhancements] = await Promise.all([
    readCapState(),
    listPendingProposals(),
    canEdit(user, "ai_write"),
    listEnhancementSuggestions(),
  ]);
  const pctSpent = cap.capPence === 0 ? 0 : Math.round((cap.spentPence / cap.capPence) * 100);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="AI planner"
        subtitle={`${cap.weddingWeeksLeft} weeks until the wedding`}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!AI_ENABLED && (
          <section>
            <div className="rounded-md border border-marigold-200 bg-marigold-100 p-4 text-sm text-marigold-700">
              AI is currently disabled (<code>AI_ENABLED=false</code>). Set the
              env var to <code>true</code> and recreate the stack to turn it
              back on.
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
            Pending proposals {pending.length > 0 && `(${pending.length})`}
          </h2>
          {pending.length === 0 ? (
            <div className="rounded-md border border-border-soft bg-surface p-6 text-sm text-ink-secondary">
              Nothing to review right now. Open the side panel and ask the AI
              for something — e.g. &ldquo;suggest 3 tasks I&rsquo;ve probably
              forgotten this month.&rdquo;
            </div>
          ) : !canApply ? (
            <div className="rounded-md border border-marigold-200 bg-marigold-100 p-4 text-sm text-marigold-700">
              You have {pending.length} proposal{pending.length === 1 ? "" : "s"} to
              review, but Apply/Dismiss needs the <code>ai_write</code>{" "}
              permission — ask the couple to grant it from Settings.
            </div>
          ) : (
            <div className="space-y-3">
              {groupByBatch(pending).map((group) => {
                const first = group.items[0];
                return group.items.length === 1 && first ? (
                  <ProposalReviewCard key={group.key} proposal={first} />
                ) : (
                  <ProposalBatchGroup key={group.key} proposals={group.items} />
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
            State of the wedding
          </h2>
          <WeddingReviewPanel />
        </section>

        {/* v2.8.0 (§C2): agent-filed product feedback (dev backlog for
            the website / MCP / AI surface). Hidden entirely while empty
            — most visitors will never have seen the agent file one. */}
        {enhancements.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
              Enhancement suggestions ({enhancements.length})
            </h2>
            <EnhancementsPanel
              suggestions={enhancements}
              isCouple={user.isCouple}
            />
          </section>
        )}

        {user.isCouple && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
              Parse a guest list
            </h2>
            <ParseGuestsPanel />
          </section>
        )}

        {/* v2.5.0: cap + per-feature usage merged into one section —
            they were two separate headings ("This month" / "Usage")
            saying the same kind of thing about the same spend. */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
            Usage &amp; spend
          </h2>
          <div className="space-y-3">
            <div className="rounded-md border border-border-soft bg-surface p-4">
              <div className="text-2xl font-semibold text-ink-primary">
                {formatPence(cap.spentPence)}{" "}
                <span className="text-sm font-normal text-ink-secondary">
                  / {formatPence(cap.capPence)} cap ({pctSpent}%)
                </span>
              </div>
              <div className="text-xs text-ink-tertiary mt-1">
                {formatPence(cap.remainingPence)} remaining this month. Edit the
                cap in <Link href="/settings" className="underline">Settings</Link>.
              </div>
            </div>
            <UsageDashboard />
          </div>
        </section>

        {/* v2.5.0: couple-only now — developer-facing smoke test with
            technical jargon ("AiUsage row") shipped to all users. The
            chat pipeline it proves out has been in daily use for
            months; this is now a maintenance tool, not a user feature. */}
        {user.isCouple && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
              Smoke test
            </h2>
            <div className="rounded-md border border-border-soft bg-surface p-4 space-y-2">
              <div className="text-sm text-ink-secondary">
                Round-trips one prompt through Anthropic and writes an{" "}
                <code>AiUsage</code> row. Costs about a tenth of a pence.
              </div>
              <PingButton />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
