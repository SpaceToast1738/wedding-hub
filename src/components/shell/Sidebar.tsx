import { SidebarItem } from "@/components/shell/SidebarItem";
import { AvatarMenu } from "@/components/shell/AvatarMenu";
import { NAV_GROUPS, type Counts } from "@/components/shell/nav-config";
import { APP_VERSION } from "@/lib/version";
import { getWeddingSettings, formatWeddingDateShort } from "@/lib/wedding-settings";

type Props = {
  user: { id: string; name?: string | null; email: string; isCouple: boolean; role: string; darkMode: boolean | null };
  counts: Counts;
  signOutAction: () => Promise<void>;
};

export async function Sidebar({ user, counts, signOutAction }: Props) {
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.coupleOnly || user.isCouple),
  })).filter((g) => g.items.length > 0);
  const wedding = await getWeddingSettings();
  // v2.5.0: the subline was a static date — every page carried the
  // same "26 Sep 2026" no matter how close the wedding got. A running
  // countdown gives a gentle, always-current time anchor without
  // needing its own page. Exact date still available on hover.
  const daysLeft = Math.ceil(
    (wedding.weddingDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  const weeksLeft = Math.max(0, Math.floor(daysLeft / 7));
  const countdown =
    daysLeft <= 0 ? "today!" : weeksLeft > 0 ? `${weeksLeft} week${weeksLeft === 1 ? "" : "s"} to go` : `${daysLeft} day${daysLeft === 1 ? "" : "s"} to go`;
  const headline = `${wedding.brideFirst} & ${wedding.groomFirst} · ${countdown}`;

  return (
    <aside
      className="desktop-sidebar flex-shrink-0 bg-muted border-r border-border-soft flex flex-col h-screen overflow-hidden"
      style={{ width: 220 }}
    >
      <div className="px-4 pt-4 pb-3 border-b border-border-soft">
        <div className="font-display text-[17px] font-semibold text-moss-700 -tracking-tight">
          Wedding Hub
        </div>
        <div
          className="text-[11px] text-ink-tertiary mt-0.5"
          title={formatWeddingDateShort(wedding)}
        >
          {headline}
        </div>
      </div>

      <nav className="flex-1 overflow-auto py-2">
        {groups.map((group, idx) => (
          <div key={group.id}>
            {idx > 0 && <div className="h-px bg-border-soft my-1" />}
            {group.items.map((item) => (
              <SidebarItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<item.icon aria-hidden className="w-3.5 h-3.5" />}
                count={item.countKey ? counts[item.countKey] : undefined}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-border-soft px-3 py-2.5">
        <AvatarMenu user={user} signOutAction={signOutAction} />
        <div
          className="mt-2 px-1 text-[10px] text-ink-tertiary tracking-wider font-mono select-none"
          title="App version"
        >
          v{APP_VERSION}
        </div>
      </div>
    </aside>
  );
}
