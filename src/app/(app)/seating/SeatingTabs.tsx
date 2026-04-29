"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// v1.23.1: clear, obvious nav between the reception canvas and the
// ceremony layout. Pre-fix the only path was a small "Ceremony →"
// text link tucked in the header — easy to miss. Tabs are a more
// conventional IA for "two views of the same domain".
export function SeatingTabs() {
  const pathname = usePathname();
  const onCeremony = pathname.startsWith("/seating/ceremony");
  return (
    <div className="px-4 sm:px-6 pt-3">
      <div className="inline-flex bg-canvas border border-border-soft rounded-md p-0.5 shadow-sm">
        <TabLink href="/seating" active={!onCeremony} label="Reception" />
        <TabLink href="/seating/ceremony" active={onCeremony} label="Ceremony" />
      </div>
    </div>
  );
}

function TabLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "text-sm font-semibold px-4 py-1.5 rounded-sm transition-colors",
        active
          ? "bg-moss-500 text-white"
          : "text-ink-secondary hover:text-ink-primary hover:bg-surface",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}
