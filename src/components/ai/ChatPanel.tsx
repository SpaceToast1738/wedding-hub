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
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  applyProposal,
  applyProposals,
  dismissProposal,
  dismissProposals,
  getThread,
  listMyThreads,
  listPendingProposals,
  type ThreadListItem,
  type ThreadMessage,
} from "@/app/(app)/ai/actions";
import { MarkdownMessage } from "./MarkdownMessage";
// v2.5.0: same human-label helper the /ai review dashboard uses (via
// PendingProposal.kindLabel, computed server-side) — chat cards were
// falling back to the raw "task.update"-style kind string for most of
// the ~40 proposal kinds. Pure module (only imports "zod"), safe in a
// client bundle.
import { humanLabel, type ProposalKind } from "@/lib/ai/proposals/schemas";

// Client-side copies of the tool progress labels — the server
// registry imports Prisma-backed modules and can't be bundled into a
// client component. Fallback: the raw tool name.
const TOOL_LABELS: Record<string, string> = {
  read_stats: "Read wedding stats",
  read_tasks: "Read tasks",
  read_events: "Read schedule",
  read_guests: "Read guests",
  read_book: "Read the wedding book",
  read_book_card: "Read a book card",
  read_budget: "Read the budget",
  read_suppliers: "Read suppliers",
  read_proposals: "Checked pending proposals",
  read_payments: "Read payments",
  read_seating: "Read the seating plan",
  read_songs: "Read playlists",
  read_files: "Read files",
  propose_task: "Proposed a task",
  propose_task_update: "Proposed a task update",
  propose_task_breakdown: "Proposed a task breakdown",
  propose_event: "Proposed an event",
  propose_event_update: "Proposed an event update",
  propose_supplier_create: "Proposed a supplier",
  propose_supplier_update: "Proposed a supplier update",
  propose_supplier_log_communication: "Proposed a supplier log",
  propose_supplier_contact_add: "Proposed a supplier contact",
  propose_guest_update: "Proposed a guest update",
  propose_guest_set_rsvp: "Proposed an RSVP change",
  propose_guest_archive: "Proposed archiving a guest",
  propose_household_update: "Proposed a household update",
  propose_book_section_create: "Proposed a book section",
  propose_book_card_create: "Proposed a book card",
  propose_book_card_rename: "Proposed a card rename",
  propose_book_card_replace_text: "Proposed a card rewrite",
  propose_book_field_set: "Proposed a field change",
  propose_book_recipe_update: "Proposed a recipe update",
  propose_book_shot_add: "Proposed a photo shot",
  propose_book_shot_update: "Proposed a shot update",
  propose_book_outfit_update: "Proposed an outfit update",
  propose_book_build_update: "Proposed a build update",
  propose_book_menu_update: "Proposed a menu update",
  propose_book_bar_update: "Proposed a bar update",
  propose_book_setup_update: "Proposed a setup update",
  propose_book_runsheet_update: "Proposed a runsheet update",
  propose_book_stay_update: "Proposed a stay update",
  propose_book_lodging_update: "Proposed a lodging update",
  propose_book_dresscode_update: "Proposed a dress-code update",
  propose_book_weddingparty_set_cell: "Proposed a wedding-party status",
  propose_book_weddingparty_add_member: "Proposed a wedding-party member",
  propose_book_weddingparty_add_item: "Proposed a wedding-party item",
  propose_book_weddingparty_update_header: "Proposed a wedding-party update",
  propose_budget_category_create: "Proposed a budget category",
  propose_budget_line_create: "Proposed a budget line",
  propose_budget_line_update: "Proposed a budget-line update",
  propose_payment_create: "Proposed a payment",
  propose_payment_update: "Proposed a payment update",
  propose_payment_set_status: "Proposed a payment status change",
  propose_question_answer: "Proposed an answer",
  propose_song_add: "Proposed a song",
  propose_custom_field_set: "Proposed a field value",
  propose_seat_assign: "Proposed a seat assignment",
};

type LocalProposal = {
  id: string;
  kind: string;
  title: string;
  /** v2.2.0: resolved-names line ("→ Sarah · Flowers"). */
  detail?: string;
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
      detail?: string;
      batchId?: string;
    }
  | { type: "message_end"; costPence: number; model: string }
  | { type: "done"; totalCostPence: number }
  | { type: "error"; error: string; code?: string };

function rand(): string {
  return Math.random().toString(36).slice(2, 10);
}

// v2.5.0: tappable suggested prompts under the empty-state greeting —
// starting a conversation shouldn't require composing text from
// scratch. Three broad, low-risk asks that work regardless of what
// page the user opened the panel from.
const SUGGESTED_PROMPTS = [
  "What should we tackle this week?",
  "Suggest 3 tasks I've probably forgotten",
  "What's still outstanding for the wedding?",
];

function formatRelativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export function ChatPanel({ user }: { user: { id: string; firstName: string } }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // v2.2.0: history view + hydration state.
  const [view, setView] = useState<"chat" | "history">("chat");
  const [threads, setThreads] = useState<ThreadListItem[] | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  // v2.5.0: the floating trigger button unmounts while the panel is
  // open (see below) and remounts fresh on close, so restoring focus
  // to it needs a ref that's re-attached on every mount rather than a
  // snapshot of "whatever had focus before" taken at open time.
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const openedOnceRef = useRef(false);

  useEffect(() => setMounted(true), []);

  // Auto-scroll on new content — but only when the user is already
  // near the bottom, so scrolling up to reread (or to hit Apply on an
  // earlier proposal card) isn't yanked away mid-stream.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Returning to the chat view (from history, or after a resume)
  // remounts the scroller at the top — jump to the latest message.
  useEffect(() => {
    if (view !== "chat") return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view]);

  // Re-focus the input once a reply finishes (disabling the textarea
  // while busy blurs it and browsers don't restore focus).
  useEffect(() => {
    if (!busy && open && view === "chat") inputRef.current?.focus();
  }, [busy, open, view]);

  // Focus input when the panel opens.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // v2.5.0: Escape closes the panel — matches QuickCapture's own
  // Escape handling. Only listens while open so it doesn't steal Esc
  // from other components (ConfirmDialog, QuickCapture) when dormant.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Track the sm: breakpoint (640px) in JS — below it the panel is a
  // full-screen overlay (`w-full sm:w-[380px]` below), so a Tab loop
  // needs to stay inside it rather than escaping into the page behind.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsNarrow(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Focus trap for the mobile full-screen overlay — same pattern as
  // ConfirmDialog's trap. Desktop's docked 380px panel leaves the rest
  // of the page reachable by design, so the trap only engages narrow.
  useEffect(() => {
    if (!open || !isNarrow) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isNarrow]);

  // Restore focus to the trigger button once the panel closes — but
  // not on first mount, where there's nothing to "restore" and
  // stealing focus into a floating button on page load would be
  // jarring.
  useEffect(() => {
    if (open) {
      openedOnceRef.current = true;
      return;
    }
    if (openedOnceRef.current) triggerButtonRef.current?.focus();
  }, [open]);

  const startNewChat = useCallback(() => {
    setThreadId(null);
    setMessages([]);
    setInput("");
    setView("chat");
    setPendingCount(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const openHistory = useCallback(() => {
    setView("history");
    setThreads(null);
    void listMyThreads().then(setThreads).catch(() => setThreads([]));
  }, []);

  const hydrate = useCallback((m: ThreadMessage): LocalMsg => {
    if (m.role === "user") {
      return { id: m.id, role: "user", text: m.content };
    }
    return {
      id: m.id,
      role: "assistant",
      text: m.content,
      tools: m.toolNames.map((n, i) => ({
        id: `${m.id}-t${i}`,
        label: TOOL_LABELS[n] ?? n,
        done: true,
        ok: true,
      })),
    };
  }, []);

  const loadThread = useCallback(
    (id: string) => {
      setLoadingThread(true);
      void (async () => {
        try {
          const detail = await getThread(id);
          if (!detail) return;
          setThreadId(detail.id);
          setMessages(detail.messages.map(hydrate));
          setView("chat");
          // Past proposals: statuses may have changed since the turn,
          // so no stale Apply cards — just a live pending-count strip.
          const pending = await listPendingProposals();
          setPendingCount(pending.length);
        } catch (err) {
          // Network/server failure — stay in the history view rather
          // than leaving an unhandled rejection + half-loaded state.
          console.error("thread load failed", err);
        } finally {
          setLoadingThread(false);
        }
      })();
    },
    [hydrate],
  );

  // v2.5.0: accepts an optional override so the suggested-prompt chips
  // can send immediately without a setInput() + send() race (state
  // updates aren't synchronous, so send() reading the `input` state
  // right after a setInput() call would still see the old value).
  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
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
        body: JSON.stringify({ threadId, text, pathname }),
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
      // v2.5.0: the pending-count strip previously only refreshed on
      // thread-load — a live turn that created (or resolved) proposals
      // left it stale until the next history round-trip. Refresh here
      // too, on every turn, not just when hydrating a past thread.
      try {
        const pendingProposals = await listPendingProposals();
        setPendingCount(pendingProposals.length);
      } catch {
        // Non-fatal — the strip just keeps its previous count until
        // the next refresh trigger.
      }
    }
  }, [busy, input, threadId, pathname]);

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
                      detail: evt.detail,
                      status: "pending",
                    },
                  ],
                }
              : m,
          ),
        );
        break;
      case "error":
        // v2.2.0 review fix: don't wipe a bubble that already carries
        // streamed text / tool chips / proposal cards (a batch turn
        // that hits the token or iteration limit AFTER creating
        // proposals must keep its Apply cards visible). Only convert
        // in place when the assistant message is still empty.
        setMessages((prev) => {
          const target = prev.find((m) => m.id === assistantId);
          const hasContent =
            !!target &&
            (target.text.length > 0 ||
              (target.proposals?.length ?? 0) > 0 ||
              (target.tools?.length ?? 0) > 0);
          if (!hasContent) {
            return prev.map((m) =>
              m.id === assistantId ? { ...m, role: "error", text: evt.error } : m,
            );
          }
          return [
            ...prev,
            { id: `e-${rand()}`, role: "error", text: evt.error },
          ];
        });
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
      {/* Floating trigger — v2.5.0: hidden entirely while the panel is
          open (the header's own × already covers that job; showing
          both duplicated the affordance and risked accidental taps
          over the panel's action buttons). Mobile corner moved from
          bottom-right to bottom-left — bottom-right is the Toaster's
          corner (see Toaster.tsx's items-end/justify-end stacking)
          and the two were visually overlapping. Breakpoint matched to
          sm: (640px), was md: (768px) — out of step with the rest of
          the shell. */}
      {!open && (
        <button
          ref={triggerButtonRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open AI planner"
          // v2.5.2 (review fix): `left-4` was never cancelled at `sm:`,
          // and CSS drops `right` on a fixed-width box when both
          // `left`/`right` are set in LTR — so `sm:right-6` was
          // silently ignored and the button stayed pinned bottom-left
          // at every viewport width (confirmed via render). `sm:left-
          // auto` releases the mobile anchor so the desktop `right-6`
          // actually takes effect.
          className="fixed bottom-20 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-[400] rounded-full bg-ink-primary text-canvas w-12 h-12 shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
        >
          <Sparkles aria-hidden className="w-5 h-5" />
        </button>
      )}

      {/* Backdrop for click-away close on mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-[398] sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Panel. v2.5.0: `inert` when closed — aria-hidden alone left
          every button and the text input in the normal tab order even
          though the panel was transformed off-screen, so a keyboard
          user tabbing through any page hit several invisible,
          non-functional stops before reaching real page content.
          `inert` genuinely removes it (and its focusability) from the
          tab order; aria-hidden stays alongside for older AT. */}
      <aside
        ref={panelRef}
        className={`fixed z-[399] bg-surface border-l border-border-soft shadow-xl flex flex-col transition-transform duration-200 top-0 right-0 h-full w-full sm:w-[380px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
        inert={!open}
      >
        <header className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-ink-primary">AI planner</div>
            <div className="text-xs text-ink-tertiary">
              {threadId ? "conversation in progress" : "start a new chat"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === "chat" ? (
              <button
                type="button"
                onClick={openHistory}
                disabled={busy}
                className="text-xs text-ink-secondary underline disabled:opacity-50"
              >
                History
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setView("chat")}
                className="text-xs text-ink-secondary underline"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={startNewChat}
              disabled={busy || loadingThread}
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

        {view === "history" ? (
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {threads === null && (
              <div className="text-sm text-ink-tertiary">Loading…</div>
            )}
            {threads !== null && threads.length === 0 && (
              <div className="text-sm text-ink-tertiary">
                No past conversations yet.
              </div>
            )}
            {threads !== null && threads.length > 0 && (
              <ul className="divide-y divide-border-soft">
                {threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => loadThread(t.id)}
                      disabled={loadingThread}
                      className="w-full text-left py-2 hover:bg-muted rounded-sm px-1 disabled:opacity-60"
                    >
                      <div className="text-sm text-ink-primary truncate">
                        {t.title || "Untitled chat"}
                      </div>
                      <div className="text-xs text-ink-tertiary">
                        {formatRelativeTime(t.updatedAt)} · {t.messageCount} message
                        {t.messageCount === 1 ? "" : "s"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        >
          {messages.length === 0 && (
            <div className="space-y-2.5">
              <div className="text-sm text-ink-tertiary">
                Hi {user.firstName}! Ask me anything about the wedding — I can
                read your tasks, guests, schedule, and (if you have access)
                budget.
              </div>
              {/* v2.5.0: tappable starter prompts — starting a
                  conversation shouldn't require composing text from
                  scratch. */}
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void send(prompt)}
                    disabled={busy}
                    className="rounded-full border border-border-soft bg-surface px-2.5 py-1 text-xs text-ink-secondary hover:bg-muted disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              locked={busy}
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
          {pendingCount !== null && pendingCount > 0 && (
            <div className="rounded-md border border-marigold-200 bg-marigold-100 px-3 py-2 text-xs text-marigold-700">
              {pendingCount} proposal{pendingCount === 1 ? "" : "s"} still
              pending —{" "}
              <Link href="/ai" className="underline font-medium">
                review on the AI page
              </Link>
              .
            </div>
          )}
          {busy && (
            <div className="text-xs text-ink-tertiary italic">
              thinking…
            </div>
          )}
        </div>
        )}

        {view === "chat" && (
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
        )}
      </aside>
    </>,
    document.body,
  );
}

function MessageBubble({
  msg,
  locked,
  onProposalStateChange,
}: {
  msg: LocalMsg;
  /** True while a turn is streaming — proposal buttons disable so a
   *  single card can't be applied mid-stream and then remount as a
   *  batch card with inconsistent state. */
  locked: boolean;
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
      <div className="rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
        {msg.text || "Something went wrong."}
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[95%]">
        {msg.tools && msg.tools.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {msg.tools.map((t) => {
              // v2.5.0: a failed tool call (t.ok === false) was still
              // rendering a checkmark — any "done" state read as
              // success. Now distinguishes in-progress / succeeded /
              // failed, and uses semantic tokens instead of raw
              // amber/emerald palette classes (the raw colors don't
              // remap for dark mode the way the tokens do).
              const failed = t.done && t.ok === false;
              const succeeded = t.done && t.ok !== false;
              return (
                <span
                  key={t.id}
                  className={`inline-flex items-center gap-1 rounded-full text-xs px-2 py-0.5 border ${
                    failed
                      ? "border-danger-border bg-danger-bg text-danger"
                      : succeeded
                        ? "border-moss-100 bg-moss-50 text-moss-700"
                        : "border-border-soft bg-surface text-ink-tertiary"
                  }`}
                >
                  {failed ? "✗" : succeeded ? "✓" : "…"} {t.label}
                </span>
              );
            })}
          </div>
        )}
        {msg.text && (
          <div className="rounded-lg bg-canvas border border-border-soft text-ink-primary px-3 py-2">
            <MarkdownMessage text={msg.text} />
          </div>
        )}
        {(() => {
          const proposals = msg.proposals ?? [];
          const single = proposals.length === 1 ? proposals[0] : undefined;
          if (single) {
            return (
              <div className="mt-2">
                <ProposalCard
                  proposal={single}
                  locked={locked}
                  onStateChange={(next) => onProposalStateChange(single.id, next)}
                />
              </div>
            );
          }
          if (proposals.length > 1) {
            return (
              <div className="mt-2">
                <ProposalBatchCard
                  proposals={proposals}
                  locked={locked}
                  onStateChange={onProposalStateChange}
                />
              </div>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
}

/** v2.2.0: one card for a whole batch of proposals from a single
 *  assistant turn. Checkbox per item (default checked — deselections
 *  are stored, so proposals that stream in after mount arrive
 *  checked), Apply selected / Dismiss all, per-item status chips. */
function ProposalBatchCard({
  proposals,
  locked,
  onStateChange,
}: {
  proposals: LocalProposal[];
  locked: boolean;
  onStateChange: (id: string, next: Partial<LocalProposal>) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  // "error" items are still PENDING server-side (a failed apply rolls
  // the claim back) — keep them selectable so the reviewer can retry.
  const pendingItems = proposals.filter(
    (p) => p.status === "pending" || p.status === "error",
  );
  const selectedIds = pendingItems
    .filter((p) => !deselected.has(p.id))
    .map((p) => p.id);
  const settled = proposals.length - pendingItems.length;
  const disabled = pending || locked;

  function toggle(id: string) {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyResults(
    results: { id: string; ok: boolean; error: string | null }[],
    okStatus: "applied" | "dismissed",
  ) {
    for (const r of results) {
      onStateChange(
        r.id,
        r.ok
          ? { status: okStatus }
          : { status: "error", error: r.error ?? "Failed" },
      );
    }
  }

  function onApplySelected() {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const { results } = await applyProposals(selectedIds);
      applyResults(results, "applied");
    });
  }
  function onDismissAll() {
    const ids = pendingItems.map((p) => p.id);
    if (ids.length === 0) return;
    startTransition(async () => {
      const { results } = await dismissProposals(ids);
      applyResults(results, "dismissed");
    });
  }

  return (
    <div className="rounded-md border border-border-soft bg-surface px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-xs uppercase tracking-wide text-ink-tertiary">
          {proposals.length} proposals
          {settled > 0 && ` · ${settled} handled`}
        </div>
        {pendingItems.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={onApplySelected}
              disabled={disabled || selectedIds.length === 0}
              className="rounded-md bg-ink-primary text-canvas px-2 py-1 text-xs disabled:opacity-50"
            >
              {pending ? "Working…" : `Apply selected (${selectedIds.length})`}
            </button>
            <button
              type="button"
              onClick={onDismissAll}
              disabled={disabled}
              className="rounded-md border border-border-soft text-ink-secondary px-2 py-1 text-xs disabled:opacity-60"
            >
              Dismiss all
            </button>
          </div>
        )}
      </div>
      <ul className="space-y-1">
        {proposals.map((p) => (
          <li key={p.id} className="flex items-start gap-2">
            {p.status === "pending" || p.status === "error" ? (
              <input
                type="checkbox"
                checked={!deselected.has(p.id)}
                onChange={() => toggle(p.id)}
                disabled={disabled}
                className="mt-1 flex-shrink-0"
                aria-label={`Include "${p.title}"`}
              />
            ) : (
              <span className="mt-0.5 w-4 flex-shrink-0 text-center text-xs">
                {p.status === "applied" ? "✓" : "–"}
              </span>
            )}
            <div className="min-w-0">
              <div
                className={`truncate ${
                  p.status === "dismissed"
                    ? "text-ink-tertiary line-through"
                    : "text-ink-primary"
                }`}
              >
                {p.title}
              </div>
              {p.detail && p.status === "pending" && (
                <div className="text-xs text-ink-secondary truncate">{p.detail}</div>
              )}
              {p.status === "error" && p.error && (
                <div className="text-xs text-danger">✗ {p.error} — still selectable to retry</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProposalCard({
  proposal,
  locked,
  onStateChange,
}: {
  proposal: LocalProposal;
  locked: boolean;
  onStateChange: (next: Partial<LocalProposal>) => void;
}) {
  const [pending, startTransition] = useTransition();
  const disabled = pending || locked;

  // v2.5.0: was a two-case ternary falling back to the raw kind
  // string ("task.update", "book.weddingparty.set_cell", …) for most
  // of the ~40 proposal kinds — humanLabel is the same helper the
  // /ai dashboard already uses, so chat and dashboard never disagree
  // on naming. Falls back to the raw kind for anything humanLabel
  // doesn't recognise (e.g. a kind shipped after this client bundle).
  const kindLabel = humanLabel(proposal.kind as ProposalKind) ?? proposal.kind;

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
          {proposal.detail && (
            <div className="text-xs text-ink-secondary truncate">
              {proposal.detail}
            </div>
          )}
        </div>
        {(proposal.status === "pending" || proposal.status === "error") && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={onApply}
              disabled={disabled}
              className="rounded-md bg-ink-primary text-canvas px-2 py-1 text-xs disabled:opacity-60"
            >
              {proposal.status === "error" ? "Retry" : "Apply"}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              disabled={disabled}
              className="rounded-md border border-border-soft text-ink-secondary px-2 py-1 text-xs disabled:opacity-60"
            >
              Dismiss
            </button>
          </div>
        )}
        {proposal.status === "applied" && (
          <span className="text-xs text-moss-700 flex-shrink-0">✓ applied</span>
        )}
        {proposal.status === "dismissed" && (
          <span className="text-xs text-ink-tertiary flex-shrink-0">dismissed</span>
        )}
      </div>
      {proposal.status === "error" && proposal.error && (
        <div className="mt-1 text-xs text-danger">✗ {proposal.error}</div>
      )}
    </div>
  );
}
