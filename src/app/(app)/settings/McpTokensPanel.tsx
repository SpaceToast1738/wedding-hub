"use client";

// v2.7.0: MCP token management panel. Couple-only — the Settings page
// gates mounting, and every action re-checks requireCouple server-side.
//
// The one design-critical bit: the raw token exists only in the create
// action's return value. We hold it in local state just long enough for
// the couple to copy it (the amber box below), and it vanishes on
// dismiss or refresh — after that only the SHA-256 hash exists anywhere.

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { notify } from "@/lib/notify";
import { timeAgo } from "@/lib/time-ago";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  createMcpToken,
  revokeMcpToken,
  setMcpTokenCanApply,
  setMcpTokenCanDismissOwn,
  setMcpTokenCanProposeSend,
  type McpTokenRow,
  type TokenEligibleUser,
} from "./mcp-token-actions";

export function McpTokensPanel({
  tokens,
  eligibleUsers,
}: {
  tokens: McpTokenRow[];
  eligibleUsers: TokenEligibleUser[];
}) {
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The copy-once box: raw token + the label it was created under.
  // Local state only — a refresh or "Done" makes it unrecoverable.
  const [fresh, setFresh] = useState<{ token: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const confirm = useConfirm();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const createdLabel = label.trim();
    startTransition(async () => {
      const res = await createMcpToken({ label, userId });
      if (res.ok) {
        setFresh({ token: res.token, label: createdLabel });
        setCopied(false);
        setLabel("");
        setUserId("");
        notify("success", `Token "${createdLabel}" created`);
      } else {
        setError(res.error);
      }
    });
  }

  async function revoke(id: string, tokenLabel: string) {
    if (!(await confirm({
      title: `Revoke "${tokenLabel}"?`,
      body: "Any MCP client using this token stops working immediately. This can't be undone — create a new token to reconnect.",
      confirmLabel: "Revoke",
      tone: "danger",
    }))) return;
    startTransition(async () => {
      const res = await revokeMcpToken(id);
      if (res.ok) notify("success", `Token "${tokenLabel}" revoked`);
      else notify("error", res.error);
    });
  }

  // v2.8.0: no confirm dialog on the way ON — the warning line under
  // the checkbox is always visible, and the flip is instantly
  // reversible (unlike revoke). The server action re-checks
  // requireCouple and refuses revoked tokens.
  function toggleCanApply(id: string, tokenLabel: string, canApply: boolean) {
    startTransition(async () => {
      const res = await setMcpTokenCanApply(id, canApply);
      if (res.ok) {
        notify(
          "success",
          canApply
            ? `"${tokenLabel}" can now apply changes`
            : `"${tokenLabel}" is back to propose-only`,
        );
      } else {
        notify("error", res.error);
      }
    });
  }

  // v2.9.0: the narrower dismiss-own opt-in — same no-confirm pattern
  // as toggleCanApply (instantly reversible, warning text always shown).
  function toggleCanDismissOwn(id: string, tokenLabel: string, canDismissOwn: boolean) {
    startTransition(async () => {
      const res = await setMcpTokenCanDismissOwn(id, canDismissOwn);
      if (res.ok) {
        notify(
          "success",
          canDismissOwn
            ? `"${tokenLabel}" can now dismiss its own proposals`
            : `"${tokenLabel}" can no longer dismiss its own proposals`,
        );
      } else {
        notify("error", res.error);
      }
    });
  }

  // v2.9.2: the gated nudge-send opt-in — same no-confirm pattern. This
  // one only lets the agent QUEUE a send proposal; a human (or a canApply
  // token) still Applies it to actually email anyone.
  function toggleCanProposeSend(id: string, tokenLabel: string, canProposeSend: boolean) {
    startTransition(async () => {
      const res = await setMcpTokenCanProposeSend(id, canProposeSend);
      if (res.ok) {
        notify(
          "success",
          canProposeSend
            ? `"${tokenLabel}" can now propose sending the nudge digest`
            : `"${tokenLabel}" can no longer propose sends`,
        );
      } else {
        notify("error", res.error);
      }
    });
  }

  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some browsers block clipboard writes over http — silent
      // fallback: the token text is select-all-able by hand.
    }
  }

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft">
        <h2 className="text-sm font-semibold text-ink-primary">MCP tokens</h2>
        <p className="text-xs text-ink-tertiary mt-0.5">
          Bearer tokens for the LAN MCP server — see docs/MCP.md. Each token
          acts as the member it&apos;s issued to, with their normal permissions.
        </p>
      </header>

      {fresh && (
        <div className="mx-4 mt-4 rounded-md border border-marigold-200 bg-marigold-100 p-3 space-y-2">
          <p className="text-xs font-medium text-marigold-700 flex items-start gap-1.5">
            <KeyRound aria-hidden className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Token &quot;{fresh.label}&quot; created — copy it now. This is
              the only time you&apos;ll see it.
            </span>
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <code className="flex-1 min-w-0 text-xs font-mono bg-surface border border-border-soft rounded-sm px-2 py-1.5 break-all select-all text-ink-primary">
              {fresh.token}
            </code>
            <div className="flex gap-2 flex-shrink-0">
              <Button type="button" variant="secondary" size="sm" onClick={copy}>
                {copied ? "✓ Copied" : "Copy"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFresh(null);
                  setCopied(false);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="px-4 py-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            label="Label"
            wrapperClassName="flex-1"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Jamie's desktop"
            maxLength={64}
            required
            disabled={pending}
          />
          <div>
            <label className="block text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-1">
              Acts as
            </label>
            <select
              value={userId}
              disabled={pending}
              onChange={(e) => setUserId(e.target.value)}
              className="text-sm bg-canvas border border-border-soft rounded-sm px-2 py-[7px] text-ink-primary outline-none disabled:opacity-50 h-[38px] max-w-full"
            >
              <option value="">Select member…</option>
              {eligibleUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ? `${u.name} (${u.email})` : u.email}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={pending || !label.trim() || !userId}
        >
          {pending ? "Creating…" : "Create token"}
        </Button>
      </form>

      <div className="border-t border-border-soft">
        <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-tertiary">
          Tokens
        </p>
        {tokens.length === 0 ? (
          <p className="px-4 pb-3 text-xs text-ink-tertiary italic">
            No tokens yet.
          </p>
        ) : (
          <ul className="divide-y divide-border-soft">
            {tokens.map((t) => (
              <li key={t.id} className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-ink-primary flex items-center gap-2 min-w-0">
                      <span className="truncate">{t.label}</span>
                      {t.revokedAt && (
                        <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-danger-bg text-danger border border-danger-border">
                          Revoked
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-ink-tertiary block truncate">
                      {t.user.email}
                      {" · "}created {timeAgo(new Date(t.createdAt))}
                      {" · "}last used{" "}
                      {t.lastUsedAt ? timeAgo(new Date(t.lastUsedAt)) : "never"}
                    </span>
                  </div>
                  {!t.revokedAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => revoke(t.id, t.label)}
                      className="flex-shrink-0"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
                {/* v2.8.0: per-token self-apply opt-in. Hidden for
                    revoked tokens — they can't authenticate, so the
                    flag would be dead UI. */}
                {!t.revokedAt && (
                  <div className="mt-2 flex items-start gap-2">
                    <input
                      type="checkbox"
                      id={`can-apply-${t.id}`}
                      checked={t.canApply}
                      disabled={pending}
                      onChange={(e) => toggleCanApply(t.id, t.label, e.target.checked)}
                      className="accent-moss-500 mt-0.5"
                    />
                    <label
                      htmlFor={`can-apply-${t.id}`}
                      className="cursor-pointer min-w-0"
                    >
                      <span className="text-xs text-ink-primary block">
                        Can apply changes
                      </span>
                      <span
                        className={`text-[11px] block ${
                          t.canApply ? "text-marigold-700" : "text-ink-tertiary"
                        }`}
                      >
                        Lets the connected agent make its own changes real —
                        including creating, editing and permanently deleting
                        tasks, guests, suppliers, budget and more — without
                        human review. Deletions keep a recovery snapshot but
                        undoing them is manual. Leave off to keep every change
                        in the review queue.
                      </span>
                    </label>
                  </div>
                )}
                {/* v2.9.0: narrower opt-in — dismiss its own proposals
                    only, no apply power. Redundant while "Can apply
                    changes" is on (that already includes dismiss), but
                    kept independent so switching apply off doesn't
                    silently drop dismiss-own. */}
                {!t.revokedAt && (
                  <div className="mt-2 flex items-start gap-2">
                    <input
                      type="checkbox"
                      id={`can-dismiss-own-${t.id}`}
                      checked={t.canDismissOwn}
                      disabled={pending}
                      onChange={(e) => toggleCanDismissOwn(t.id, t.label, e.target.checked)}
                      className="accent-moss-500 mt-0.5"
                    />
                    <label
                      htmlFor={`can-dismiss-own-${t.id}`}
                      className="cursor-pointer min-w-0"
                    >
                      <span className="text-xs text-ink-primary block">
                        Can dismiss its own proposals
                      </span>
                      <span className="text-[11px] block text-ink-tertiary">
                        Lets the connected agent withdraw proposals it created
                        itself (e.g. after refining a plan) without waiting for
                        a review sweep. It cannot apply anything, and it cannot
                        touch proposals from anyone else. Dismissed proposals
                        stay in the history.
                      </span>
                    </label>
                  </div>
                )}
                {/* v2.9.2: the gated nudge-send opt-in. Only lets the
                    agent QUEUE a send proposal — a human (or a "Can
                    apply changes" token) still Applies it before any
                    email goes out. Couple-tier tokens only in practice
                    (the tool is couple-only). */}
                {!t.revokedAt && (
                  <div className="mt-2 flex items-start gap-2">
                    <input
                      type="checkbox"
                      id={`can-propose-send-${t.id}`}
                      checked={t.canProposeSend}
                      disabled={pending}
                      onChange={(e) => toggleCanProposeSend(t.id, t.label, e.target.checked)}
                      className="accent-moss-500 mt-0.5"
                    />
                    <label
                      htmlFor={`can-propose-send-${t.id}`}
                      className="cursor-pointer min-w-0"
                    >
                      <span className="text-xs text-ink-primary block">
                        Can propose sends
                      </span>
                      <span
                        className={`text-[11px] block ${
                          t.canProposeSend ? "text-marigold-700" : "text-ink-tertiary"
                        }`}
                      >
                        Lets the connected agent QUEUE a proposal to email the
                        RSVP-chase or overdue-task nudge digest to you and any
                        planners (never guests). Nothing is emailed until the
                        proposal is Applied — by you on the AI page, or
                        automatically if this token also has &quot;Can apply
                        changes&quot;. Leave off to keep the agent preview-only.
                      </span>
                    </label>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
