"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { getDigestPreview, sendDigestEmail, type DigestPreview } from "./nudge-actions";

// v1.25.0: nudges Settings panel. Couple-only. Two manually-triggered
// digests — RSVPs to chase, overdue tasks. Sends to couple + planners
// (admin-only standing rule). Per-row 7-day cooldown enforced by the
// pure decision module so nobody appears in two consecutive sends.
//
// Cron-triggered nudges are deferred — the user can revisit when /
// if real demand emerges. For now manual is honest about who's
// chasing what and gives the planner a bias to act each week.
export function NudgesPanel() {
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  function refresh() {
    setRefreshing(true);
    getDigestPreview()
      .then((p) => setPreview(p))
      .catch((err) => notify("error", err instanceof Error ? err.message : "Couldn't load preview"))
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  function send(kind: "rsvp" | "tasks") {
    startTransition(async () => {
      const res = await sendDigestEmail(kind);
      if (res.ok) {
        notify("success", `Sent to ${res.sentTo.length} recipient${res.sentTo.length === 1 ? "" : "s"} · ${res.included} item${res.included === 1 ? "" : "s"}`);
        refresh();
      } else {
        notify("error", res.error);
      }
    });
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm p-5">
      <h2 className="text-base font-semibold text-ink-primary mb-1">Nudges</h2>
      <p className="text-xs text-ink-tertiary mb-4">
        Manually send a digest email to the couple and planners. Each guest /
        task only appears in one digest per 7 days.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <DigestCard
          title="RSVPs to chase"
          empty="Everyone has confirmed (or was nudged in the last 7 days)."
          count={preview?.rsvp.count}
          firstFew={preview?.rsvp.firstFew.map((g) => g.name)}
          loading={refreshing && !preview}
          disabled={pending || (preview?.rsvp.count ?? 0) === 0}
          onSend={() => send("rsvp")}
        />
        <DigestCard
          title="Overdue tasks"
          empty="No overdue tasks (or all were nudged in the last 7 days)."
          count={preview?.tasks.count}
          firstFew={preview?.tasks.firstFew.map((t) => {
            const due = t.dueDate
              ? new Date(t.dueDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })
              : "no date";
            return `${t.title} · ${due}`;
          })}
          loading={refreshing && !preview}
          disabled={pending || (preview?.tasks.count ?? 0) === 0}
          onSend={() => send("tasks")}
        />
      </div>
    </section>
  );
}

function DigestCard({
  title,
  empty,
  count,
  firstFew,
  loading,
  disabled,
  onSend,
}: {
  title: string;
  empty: string;
  count?: number;
  firstFew?: string[];
  loading: boolean;
  disabled: boolean;
  onSend: () => void;
}) {
  return (
    <div className="border border-border-soft rounded-md p-3 bg-canvas/40">
      <div className="flex items-baseline justify-between mb-1.5">
        <strong className="text-[11px] uppercase tracking-wider text-ink-secondary font-bold">
          {title}
        </strong>
        {count !== undefined && (
          <span className="text-[11px] text-ink-tertiary tabular-nums">
            {count} eligible
          </span>
        )}
      </div>
      {loading ? (
        <p className="text-xs text-ink-tertiary italic">Loading…</p>
      ) : count === 0 ? (
        <p className="text-xs text-ink-tertiary italic">{empty}</p>
      ) : (
        <>
          <ul className="text-xs text-ink-secondary space-y-0.5 mb-2">
            {firstFew?.map((label, i) => (
              <li key={i} className="truncate">· {label}</li>
            ))}
            {(count ?? 0) > (firstFew?.length ?? 0) && (
              <li className="text-ink-tertiary italic">
                + {(count ?? 0) - (firstFew?.length ?? 0)} more…
              </li>
            )}
          </ul>
        </>
      )}
      <div className="flex justify-end mt-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onSend}
          disabled={disabled}
        >
          Send digest
        </Button>
      </div>
    </div>
  );
}
