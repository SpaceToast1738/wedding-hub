"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SidebarItem({
  href,
  label,
  icon,
  count,
}: {
  href: string;
  label: string;
  // v2.6.14: a rendered element, not a LucideIcon component reference.
  // Sidebar.tsx (the caller) is a Server Component — passing the raw
  // icon component as a prop into this Client Component crashed
  // production with "Functions cannot be passed directly to Client
  // Components" (icon components are forwardRef objects, not
  // serializable data). Rendering the icon in the server parent and
  // passing the resulting element is the standard fix: JSX elements
  // are plain serializable objects, function references aren't.
  icon: ReactNode;
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
        {icon}
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
