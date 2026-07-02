"use client";

// v2.1.0 phase 6.1: Anthropic API key editor.
// Couple-only. Never shows the raw key back — only a mask + source.

import { useState, useTransition } from "react";
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
          message: clear ? "Cleared — falling back to the env var." : "Saved.",
        });
      } else {
        setStatus({ kind: "error", message: res.error });
      }
    });
  }

  return (
    <div className="rounded-md border border-border-soft bg-surface p-4 space-y-3">
      <div className="text-sm text-ink-secondary">
        Anthropic API key — used by the AI chat and every one-shot feature.
        Set it here to avoid editing <code>.env</code> on the server. Falls
        back to the <code>ANTHROPIC_API_KEY</code> env var when blank.
      </div>

      <div className="text-sm">
        <span className="font-medium text-ink-primary">Current key:</span>{" "}
        {state.source === "settings" && (
          <span className="text-emerald-700">
            {state.mask} · from Settings (this panel wins over the env var)
          </span>
        )}
        {state.source === "env" && (
          <span className="text-ink-secondary">
            {state.mask} · from <code>.env</code>
          </span>
        )}
        {state.source === "none" && (
          <span className="text-rose-700">
            none configured — AI features will return 503 until you set one
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          placeholder="sk-ant-…"
          className="flex-1 rounded-md border border-border-soft bg-canvas text-sm px-2 py-1 font-mono"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => save(false)}
            disabled={pending || value.trim() === ""}
            className="rounded-md bg-ink-primary text-canvas px-3 py-1 text-sm disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {state.source === "settings" && (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={pending}
              className="rounded-md border border-border-soft text-ink-secondary px-3 py-1 text-sm disabled:opacity-60"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {status.kind === "saved" && (
        <div className="text-xs text-emerald-700">✓ {status.message}</div>
      )}
      {status.kind === "error" && (
        <div className="text-xs text-rose-700">✗ {status.message}</div>
      )}

      <div className="text-[11px] text-ink-tertiary">
        The key is written to <code>WeddingSettings.anthropicApiKey</code> —
        stored in your Postgres, never sent to Anthropic (except as the
        Authorization header on the API call itself). The full value is never
        returned from the server after save; only a masked preview.
      </div>
    </div>
  );
}
