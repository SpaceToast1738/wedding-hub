"use client";

import type { LucideIcon } from "lucide-react";

export function Tag({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        // v2.5.0: py-2 sm:py-0.5 bakes the 40px touch floor into
        // interactive tags/filter chips on mobile, reverting to the
        // dense desktop size at 640px+.
        "text-xs px-2.5 py-2 sm:py-0.5 rounded-full border whitespace-nowrap transition-colors cursor-pointer",
        Icon ? "inline-flex items-center gap-1" : "",
        active
          // text-on-moss (not hardcoded white): dark mode's moss-500
          // is a light fill, so white text there failed AA.
          ? "bg-moss-500 text-on-moss border-moss-500 font-semibold"
          : "bg-muted text-ink-secondary border-border-soft hover:bg-canvas",
      ].join(" ")}
    >
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" aria-hidden />}
      {label}
    </button>
  );
}
