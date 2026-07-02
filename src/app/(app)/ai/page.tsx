// v2.1.0 phase 0: /ai — proposal review dashboard placeholder.
//
// Phase 1 fills in the pending-proposal list; phase 2 adds the
// dashboard header (weekly spend chart, per-feature breakdown).
// For now this is the smoke-test surface — cap state + a ping button
// prove the pipeline works before the real UI lands.

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

  const [cap, pending, canApply] = await Promise.all([
    readCapState(),
    listPendingProposals(),
    canEdit(user, "ai_write"),
  ]);
  const pctSpent = cap.capPence === 0 ? 0 : Math.round((cap.spentPence / cap.capPence) * 100);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="AI planner"
        subtitle={`${cap.weddingWeeksLeft} weeks until the wedding`}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
            This month
          </h2>
          <div className="rounded-md border border-border-soft bg-surface p-4">
            <div className="text-2xl font-semibold text-ink-primary">
              {formatPence(cap.spentPence)}{" "}
              <span className="text-sm font-normal text-ink-secondary">
                / {formatPence(cap.capPence)} cap ({pctSpent}%)
              </span>
            </div>
            <div className="text-xs text-ink-tertiary mt-1">
              {formatPence(cap.remainingPence)} remaining. Edit the cap in{" "}
              <Link href="/settings" className="underline">Settings</Link>.
            </div>
          </div>
        </section>

        {!AI_ENABLED && (
          <section>
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              AI is currently disabled (<code>AI_ENABLED=false</code>). Set the
              env var to <code>true</code> and recreate the stack to turn it
              back on.
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
            State of the wedding
          </h2>
          <WeddingReviewPanel />
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
            Usage
          </h2>
          <UsageDashboard />
        </section>

        {user.isCouple && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-tertiary mb-2">
              Parse a guest list
            </h2>
            <ParseGuestsPanel />
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
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
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
      </div>
    </div>
  );
}
