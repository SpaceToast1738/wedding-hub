// v2.2.0: pathname → human label for page-aware chat.
//
// Longest-prefix match against the sidebar nav config, so the AI can
// be told "the user is viewing the Guests page" or "a detail page
// under Guests" instead of a raw path. Unknown routes return null and
// the caller falls back to quoting the raw pathname. Pure — unit
// tested in tests/unit/route-context.test.ts.

import { NAV_GROUPS } from "@/components/shell/nav-config";

// Routes that exist but aren't in the sidebar nav.
const EXTRA_LABELS: Record<string, string> = {
  "/ai": "the AI planner page",
  "/settings": "the Settings page",
  "/menu": "the More menu",
  "/welcome": "the welcome flow",
};

export function describeRoute(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";

  if (normalized === "/") return "the Today dashboard";

  const extra = EXTRA_LABELS[normalized];
  if (extra) return extra;

  // Longest-prefix match over nav items (skipping "/", which would
  // match everything).
  let best: { href: string; label: string } | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === "/") continue;
      if (
        normalized === item.href ||
        normalized.startsWith(`${item.href}/`)
      ) {
        if (!best || item.href.length > best.href.length) {
          best = { href: item.href, label: item.label };
        }
      }
    }
  }
  if (!best) return null;

  return normalized === best.href
    ? `the ${best.label} page`
    : `a detail page under ${best.label}`;
}
