"use client";

import { useEffect } from "react";

export function Toast({
  message,
  onClose,
  durationMs = 3000,
}: {
  message: string;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const t = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(t);
  }, [onClose, durationMs]);

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] bg-surface border border-border-soft rounded-md px-4 py-2 text-sm text-ink-primary shadow-lg"
    >
      {message}
    </div>
  );
}
