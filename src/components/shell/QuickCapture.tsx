"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { quickCapture, type QuickCaptureInput } from "@/app/(app)/actions";

type CaptureType = "task" | "question" | "event";

const TYPE_META: Record<CaptureType, { label: string; placeholder: string }> = {
  task: { label: "Task", placeholder: "What needs doing?" },
  question: { label: "Question", placeholder: "Ask a question…" },
  event: { label: "Event", placeholder: "Event title…" },
};

// True when the keypress originated in something that takes text input.
// We don't want C inside a textarea to pop the modal.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return false;
}

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CaptureType>("task");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ type: CaptureType; title: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keypress: 'C' opens the modal anywhere except in a typing target.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (open) return;
      if (e.key !== "c" && e.key !== "C") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the input when the modal opens.
  useEffect(() => {
    if (open) {
      // Microtask so the input is mounted before we focus.
      const id = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Auto-dismiss the success toast after 1.4s.
  useEffect(() => {
    if (!confirm) return;
    const id = window.setTimeout(() => setConfirm(null), 1_400);
    return () => window.clearTimeout(id);
  }, [confirm]);

  const reset = useCallback(() => {
    setText("");
    setError(null);
    setOpen(false);
  }, []);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    const input: QuickCaptureInput = { type, text: trimmed };
    startTransition(async () => {
      const result = await quickCapture(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirm({ type: result.type, title: result.title });
      reset();
    });
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[600] flex items-start justify-center pt-20 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quick capture"
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => !pending && setOpen(false)}
          />
          <div className="relative bg-surface border border-border-soft rounded-lg shadow-lg w-full max-w-[520px] p-5">
            <div className="mb-3">
              <div className="text-[10px] font-bold text-ink-tertiary uppercase tracking-wider mb-2">
                Quick capture
              </div>
              <div className="flex gap-1.5 mb-3">
                {(Object.keys(TYPE_META) as CaptureType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={[
                      "text-xs px-2.5 py-1 rounded-sm border transition-colors",
                      type === t
                        ? "bg-moss-500 text-white border-moss-500"
                        : "bg-canvas text-ink-secondary border-border-soft hover:border-moss-300",
                    ].join(" ")}
                  >
                    {TYPE_META[t].label}
                  </button>
                ))}
              </div>
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
                disabled={pending}
                placeholder={TYPE_META[type].placeholder}
                className="w-full text-base bg-surface text-ink-primary border-[1.5px] border-border-soft rounded-sm px-3 py-2.5 outline-none focus:border-moss-500 disabled:opacity-50"
              />
            </div>
            {error && <p className="text-xs text-danger mb-2">{error}</p>}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-ink-tertiary">
                Press <kbd>Esc</kbd> to dismiss · <kbd>C</kbd> shortcut anytime
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={submit}
                  disabled={pending || !text.trim()}
                >
                  {pending ? "Adding…" : `Add ${TYPE_META[type].label}`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[700] bg-moss-700 text-white text-sm px-4 py-2 rounded-md shadow-lg"
          role="status"
          aria-live="polite"
        >
          ✓ {TYPE_META[confirm.type].label} added: <strong>{confirm.title}</strong>
        </div>
      )}
    </>
  );
}
