"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export function SidebarItem({
  href,
  label,
  icon: Icon,
  count,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-2.5 px-3.5 py-1.5 text-[13px] transition-colors",
        "border-l-[3px] rounded-r-sm",
        active
          ? "border-moss-500 bg-moss-50/40 text-moss-700 font-semibold"
          : "border-transparent text-ink-secondary hover:bg-surface",
      ].join(" ")}
    >
      <span className="w-4 flex items-center justify-center opacity-75">
        <Icon aria-hidden className="w-3.5 h-3.5" />
      </span>
      <span className="flex-1">{label}</span>
      {count != null && count > 0 && (
        <span
          className={[
            "text-[10px] px-1.5 py-px rounded-md min-w-[18px] text-center border",
            active
              ? "bg-moss-100/60 text-moss-700 border-moss-100 font-semibold"
              : "bg-canvas text-ink-tertiary border-border-soft font-medium",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
