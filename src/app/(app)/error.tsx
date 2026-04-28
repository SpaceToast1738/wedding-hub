"use client";

import { useEffect } from "react";
import Link from "next/link";

// B5 (v1.12.0): catches errors thrown by server actions or server
// components inside the (app) tree. Without this, Next falls back to
// the framework's default error UI which (in dev) is the bright red
// overlay — jarring for permission denials like
// `throw new Error("Forbidden: no edit access to budget")`.
//
// What ends up here: anything an action throws that isn't caught by a
// caller. Most forms (SupplierForm, NewLineForm, etc.) wrap their
// `startTransition(async () => { try { await action(...) } catch ... })`
// already; this is the safety net for the ones that don't.
//
// In production we show only a sanitised message; in development the
// raw error.message is exposed so debugging is easy. `error.digest`
// is a Next-generated id that surfaces in server logs — show it so
// the user can mention it if they file a bug.

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in browser devtools. Server-side errors already log
    // with the digest; this just makes the client-side report match.
    // eslint-disable-next-line no-console
    console.error("[wh] caught in (app)/error.tsx:", error);
  }, [error]);

  // Permission denials throw with this prefix in src/lib/actions.ts.
  // Detect them so we can show a more specific message + skip the
  // "try again" affordance (no point retrying a permission failure).
  const isPermissionError = /^Forbidden(\b|:)/i.test(error.message);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface border border-border-soft rounded-md shadow-sm p-6 text-center">
        <div className="text-3xl mb-2">{isPermissionError ? "🔒" : "⚠"}</div>
        <h1 className="font-display text-xl font-semibold text-ink-primary mb-2">
          {isPermissionError ? "Permission denied" : "Something went wrong"}
        </h1>
        <p className="text-sm text-ink-secondary mb-4 whitespace-pre-wrap">
          {isPermissionError
            ? error.message.replace(/^Forbidden:\s*/i, "")
            : "An unexpected error occurred. The team has been notified."}
        </p>
        {process.env.NODE_ENV !== "production" && !isPermissionError && (
          <pre className="text-[11px] text-left text-ink-tertiary bg-canvas border border-border-soft rounded-sm p-2 mb-4 overflow-auto max-h-40 whitespace-pre-wrap">
            {error.message}
            {error.digest && `\n\ndigest: ${error.digest}`}
          </pre>
        )}
        <div className="flex gap-2 justify-center">
          {!isPermissionError && (
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium px-3 py-1.5 rounded-sm bg-moss-500 text-canvas hover:bg-moss-700"
            >
              Try again
            </button>
          )}
          <Link
            href="/"
            className="text-xs font-medium px-3 py-1.5 rounded-sm border border-border-soft bg-canvas text-ink-secondary hover:border-moss-300 hover:text-moss-700"
          >
            Back to Today
          </Link>
        </div>
      </div>
    </div>
  );
}
