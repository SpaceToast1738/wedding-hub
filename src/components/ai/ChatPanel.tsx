"use client";

// v2.1.0 phase 1: ChatPanel — the slide-in AI assistant.
// v2.1.0 phase 2: renders inline proposal cards with Apply/Dismiss
// buttons whenever the assistant emits a proposal_created event.
//
// State model (kept in component-local state; the transcript is the
// source of truth for the DB, so we don't try to reconcile — a fresh
// mount just picks up whatever thread the SSE handshake creates):
//   threadId: string | null  — the current thread; null = "new chat"
//   messages: LocalMsg[]     — the visible transcript, streamed in
//   busy: boolean            — a request is in-flight
//
// The SSE parser is straightforward: split incoming text on `\n\n`,
// parse each frame's `event:` + `data:` lines, dispatch by type. No
// libraries — the frame format matches what `route.ts` writes.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { applyProposal, dismissProposal } from "@/app/(app)/ai/actions";

type LocalProposal = {
  id: string;
  kind: string;
  title: string;
  status: "pending" | "applied" | "dismissed" | "error";
  error?: string;
};

type LocalMsg = {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  tools?: { id: string; label: string; done?: boolean; ok?: boolean }[];
  proposals?: LocalProposal[];
};

type ChatEvent =
  | { type: "thread"; threadId: string }
  | { type: "text"; text: string }
  | { type: "tool_start"; id: string; name: string; label: string }
  | { type: "tool_end"; id: string; ok: boolean }
  | {
      type: "proposal_created";
      proposalId: string;
      kind: string;
      title: string;
    }
  | { type: "message_end"; costPence: number; model: string }
  | { type: "done"; totalCostPence: number }
  | { type: "error"; error: string; code?: string };

function rand(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function ChatPanel({ user }: { user: { id: string; firstName: string } }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  // Auto-scroll on new content.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Focus input when the panel opens.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const startNewChat = useCallback(() => {
    setThreadId(null);
    setMessages([]);
    setInput("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: LocalMsg = { id: `u-${rand()}`, role: "user", text };
    const assistantId = `a-${rand()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", text: "", tools: [] },
    ]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, text }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });

        // SSE frames are `\n\n`-delimited.
        let frameEnd: number;
        while ((frameEnd = buffered.indexOf("\n\n")) !== -1) {
          const frame = buffered.slice(0, frameEnd);
          buffered = buffered.slice(frameEnd + 2);
          const dataLine = frame
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const dataStr = dataLine.slice(5).trim();
          let evt: ChatEvent;
          try {
            evt = JSON.parse(dataStr) as ChatEvent;
          } catch {
            continue;
          }
          applyEvent(evt, assistantId);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat request failed.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, role: "error", text: message } : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  }, [busy, input, threadId]);

  function applyEvent(evt: ChatEvent, assistantId: string) {
    switch (evt.type) {
      case "thread":
        setThreadId(evt.threadId);
        break;
      case "text":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: m.text + evt.text } : m,
          ),
        );
        break;
      case "tool_start":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  tools: [...(m.tools ?? []), { id: evt.id, label: evt.label }],
                }
              : m,
          ),
        );
        break;
      case "tool_end":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  tools: (m.tools ?? []).map((t) =>
                    t.id === evt.id ? { ...t, done: true, ok: evt.ok } : t,
                  ),
                }
              : m,
          ),
        );
        break;
      case "proposal_created":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  proposals: [
                    ...(m.proposals ?? []),
                    {
                      id: evt.proposalId,
                      kind: evt.kind,
                      title: evt.title,
                      status: "pending",
                    },
                  ],
                }
              : m,
          ),
        );
        break;
      case "error":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, role: "error", text: evt.error }
              : m,
          ),
        );
        break;
      case "message_end":
      case "done":
        // No-op for the UI beyond marking the response complete.
        break;
    }
  }

  if (!mounted) return null;

  // Portal so the panel isn't scoped to any page-level container.
  return createPortal(
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI planner" : "Open AI planner"}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[400] rounded-full bg-ink-primary text-canvas w-12 h-12 shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
      >
        <span aria-hidden>{open ? "×" : "✨"}</span>
      </button>

      {/* Backdrop for click-away close on mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-[398] md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed z-[399] bg-surface border-l border-border-soft shadow-xl flex flex-col transition-transform duration-200 top-0 right-0 h-full w-full md:w-[380px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-ink-primary">AI planner</div>
            <div className="text-xs text-ink-tertiary">
              {threadId ? "conversation in progress" : "start a new chat"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startNewChat}
              disabled={busy}
              className="text-xs text-ink-secondary underline disabled:opacity-50"
            >
              New chat
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close panel"
              className="text-ink-tertiary hover:text-ink-primary text-lg leading-none"
            >
              ×
            </button>
          </div>
        </header>

        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        >
          {messages.length === 0 && (
            <div className="text-sm text-ink-tertiary">
              Hi {user.firstName}! Ask me anything about the wedding — I can
              read your tasks, guests, schedule, and (if you have access)
              budget. Try &ldquo;what should we tackle this week?&rdquo; to get
              started.
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              onProposalStateChange={(pid, next) =>
                setMessages((prev) =>
                  prev.map((mm) =>
                    mm.id === m.id
                      ? {
                          ...mm,
                          proposals: (mm.proposals ?? []).map((p) =>
                            p.id === pid ? { ...p, ...next } : p,
                          ),
                        }
                      : mm,
                  ),
                )
              }
            />
          ))}
          {busy && (
            <div className="text-xs text-ink-tertiary italic">
              thinking…
            </div>
          )}
        </div>

        <form
          className="border-t border-border-soft px-3 py-2 flex gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="Ask about the wedding…"
            disabled={busy}
            className="flex-1 rounded-md border border-border-soft bg-canvas text-sm px-2 py-1 resize-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-md bg-ink-primary text-canvas px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </aside>
    </>,
    document.body,
  );
}

function MessageBubble({
  msg,
  onProposalStateChange,
}: {
  msg: LocalMsg;
  onProposalStateChange: (id: string, next: Partial<LocalProposal>) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-ink-primary text-canvas px-3 py-2 text-sm whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.role === "error") {
    return (
      <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
        {msg.text || "Something went wrong."}
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[95%]">
        {msg.tools && msg.tools.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {msg.tools.map((t) => (
              <span
                key={t.id}
                className={`inline-flex items-center gap-1 rounded-full text-xs px-2 py-0.5 border ${
                  t.done
                    ? t.ok === false
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-border-soft bg-surface text-ink-tertiary"
                }`}
              >
                {t.done ? "✓" : "…"} {t.label}
              </span>
            ))}
          </div>
        )}
        {msg.text && (
          <div className="rounded-lg bg-canvas border border-border-soft text-ink-primary px-3 py-2 text-sm whitespace-pre-wrap">
            {msg.text}
          </div>
        )}
        {msg.proposals && msg.proposals.length > 0 && (
          <div className="mt-2 space-y-2">
            {msg.proposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onStateChange={(next) => onProposalStateChange(p.id, next)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  onStateChange,
}: {
  proposal: LocalProposal;
  onStateChange: (next: Partial<LocalProposal>) => void;
}) {
  const [pending, startTransition] = useTransition();

  const kindLabel =
    proposal.kind === "task.create"
      ? "New task"
      : proposal.kind === "event.create"
        ? "New event"
        : proposal.kind;

  async function onApply() {
    startTransition(async () => {
      const res = await applyProposal(proposal.id);
      onStateChange(
        res.ok
          ? { status: "applied" }
          : { status: "error", error: res.error },
      );
    });
  }
  async function onDismiss() {
    startTransition(async () => {
      const res = await dismissProposal(proposal.id);
      onStateChange(
        res.ok
          ? { status: "dismissed" }
          : { status: "error", error: (res as { error: string }).error },
      );
    });
  }

  return (
    <div className="rounded-md border border-border-soft bg-surface px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-ink-tertiary">
            {kindLabel}
          </div>
          <div className="font-medium text-ink-primary truncate">
            {proposal.title}
          </div>
        </div>
        {proposal.status === "pending" && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={onApply}
              disabled={pending}
              className="rounded-md bg-ink-primary text-canvas px-2 py-1 text-xs disabled:opacity-60"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={onDismiss}
              disabled={pending}
              className="rounded-md border border-border-soft text-ink-secondary px-2 py-1 text-xs disabled:opacity-60"
            >
              Dismiss
            </button>
          </div>
        )}
        {proposal.status === "applied" && (
          <span className="text-xs text-emerald-700 flex-shrink-0">✓ applied</span>
        )}
        {proposal.status === "dismissed" && (
          <span className="text-xs text-ink-tertiary flex-shrink-0">dismissed</span>
        )}
        {proposal.status === "error" && (
          <span className="text-xs text-rose-700 flex-shrink-0" title={proposal.error}>
            failed
          </span>
        )}
      </div>
      {proposal.status === "error" && proposal.error && (
        <div className="mt-1 text-xs text-rose-700">{proposal.error}</div>
      )}
    </div>
  );
}
