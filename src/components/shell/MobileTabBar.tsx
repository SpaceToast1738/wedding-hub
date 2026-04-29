"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MOBILE_TABS, NAV_GROUPS } from "@/components/shell/nav-config";
import { APP_VERSION } from "@/lib/version";

export function MobileTabBar({
  isCouple,
  signOutAction,
}: {
  isCouple: boolean;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.coupleOnly || isCouple),
  })).filter((g) => g.items.length > 0);

  const moreItems = visibleGroups
    .flatMap((g) => g.items)
    .filter((i) => !["/", "/tasks", "/guests"].includes(i.href));

  return (
    <>
      <nav
        className="mobile-tabbar fixed bottom-0 left-0 right-0 bg-surface border-t border-border-soft flex items-center h-14 z-[200]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MOBILE_TABS.map((tab) => {
          const active =
            tab.isMore
              ? moreOpen
              : tab.href === "/"
                // v1.19.0: Today tab also active on /today/day-of (and any
                // future /today/* sub-pages). Without this, /today/day-of
                // showed no active tab — disorienting on mobile where the
                // sidebar isn't there to anchor the user.
                ? pathname === "/" || pathname.startsWith("/today")
                : pathname.startsWith(tab.href);
          if (tab.isMore) {
            return (
              <button
                key={tab.href}
                onClick={() => setMoreOpen((v) => !v)}
                className={[
                  "flex-1 flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer",
                  active ? "text-moss-500 font-semibold" : "text-ink-tertiary",
                ].join(" ")}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="text-[10px]">{tab.label}</span>
              </button>
            );
          }
          // v1.25.4: full <Link> revert. v1.25.2 probed Today only;
          // the SW cleanup mounted at root has now been live for a
          // release without regressing, so it's safe to graduate
          // the rest of the tabs (Tasks, Guests) back to client-side
          // navigation. The probe-revert + per-tab branching from
          // v1.25.2 collapses back into one happy path.
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                "flex-1 flex flex-col items-center justify-center gap-0.5 h-full",
                active ? "text-moss-500 font-semibold" : "text-ink-tertiary",
              ].join(" ")}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="text-[10px]">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-[300] flex flex-col justify-end"
          onClick={() => setMoreOpen(false)}
        >
          <div className="flex-1 bg-black/30" />
          <div
            className="bg-surface rounded-t-lg pt-3 pb-6 max-h-[70vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-9 h-1 rounded bg-border-strong mx-auto mb-4" />
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3.5 w-full px-5 py-3 text-[15px] text-ink-primary"
              >
                <span className="w-5 text-center opacity-70">{item.icon}</span>
                {item.label}
              </Link>
            ))}
            {/* Sign out — mobile users have no other path to it (the
                AvatarMenu lives in the Sidebar, which is display:none
                at ≤720px). Form-based so the server action handles
                redirect to /signin. */}
            <div className="mt-2 pt-2 border-t border-border-soft">
              <form action={signOutAction}>
                <button
                  type="submit"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3.5 w-full px-5 py-3 text-[15px] text-ink-primary cursor-pointer"
                >
                  <span className="w-5 text-center opacity-70">⏻</span>
                  Sign out
                </button>
              </form>
            </div>
            {/* v1.27.1: app version footer. Mobile users couldn't see
                the version (Sidebar's `v…` chip is display:none at
                ≤720px). Useful when the user reports a bug — they
                can read the version off the More sheet. */}
            <div className="px-5 pt-1 pb-2 text-[10px] text-ink-tertiary tracking-wider font-mono select-none text-center">
              v{APP_VERSION}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
