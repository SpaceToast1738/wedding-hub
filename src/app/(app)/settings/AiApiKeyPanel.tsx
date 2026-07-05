"use client";

// v2.1.0 phase 6.1: Anthropic API key editor.
// Couple-only. Never shows the raw key back — only a mask + source.
//
// v2.5.0 (design pass #7): swapped hardcoded emerald/rose palette
// colors for the app's semantic success/danger tokens (the raw
// colors had no dark-mode counterpart), replaced the hand-rolled
// buttons with the shared Button component, and rewrote the copy to
// drop engineering jargon (HTTP status codes, .env, DB column names)
// that means nothing to a non-technical co-admin.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  updateAnthropicApiKey,
  type ApiKeyState,
} from "./wedding-settings-actions";

export function AiApiKeyPanel({ initialState }: { initialState: ApiKeyState }) {
  const [state, setState] = useState<ApiKeyState>(initialState);
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saved"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function save(clear: boolean) {
    setStatus({ kind: "idle" });
    startTransition(async () => {
      const fd = new FormData();
      if (clear) fd.append("clear", "1");
      else fd.append("apiKey", value);
      const res = await updateAnthropicApiKey(fd);
      if (res.ok) {
        setState(res.state);
        setValue("");
        setStatus({
          kind: "saved",
          message: clear
            ? "Cleared — the AI planner will use the server's own key, if one is set up."
            : "Saved.",
        });
      } else {
        setStatus({ kind: "error", message: res.error });
      }
    });
  }

  return (
    <div className="rounded-md border border-border-soft bg-surface p-4 space-y-3">
      <div className="text-sm text-ink-secondary">
        The AI planner — chat and every one-shot helper — needs an Anthropic
        API key to run. Paste yours below; it&apos;s only ever used to talk
        to Anthropic on the wedding&apos;s behalf.
      </div>

      <div className="text-sm">
        <span className="font-medium text-ink-primary">Current key:</span>{" "}
        {state.source === "settings" && (
          <span className="text-success">{state.mask} · saved here in Settings</span>
        )}
        {state.source === "env" && (
          <span className="text-ink-secondary">{state.mask} · configured on the server</span>
        )}
        {state.source === "none" && (
          <span className="text-danger">
            No key configured yet — AI features are switched off until one is added.
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <Input
          wrapperClassName="flex-1"
          label="Anthropic API key"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          placeholder="sk-ant-…"
          className="font-mono"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => save(false)}
            disabled={pending || value.trim() === ""}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
          {state.source === "settings" && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => save(true)}
              disabled={pending}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {status.kind === "saved" && (
        <div className="text-xs text-success">✓ {status.message}</div>
      )}
      {status.kind === "error" && (
        <div className="text-xs text-danger">✗ {status.message}</div>
      )}

      <div className="text-[11px] text-ink-tertiary">
        Your key is stored securely in the wedding&apos;s own database. Once
        saved, you&apos;ll only ever see a masked preview here — never the
        full key again.
      </div>
    </div>
  );
}
