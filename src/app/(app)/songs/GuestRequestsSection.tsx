type GuestRequest = {
  id: string;
  title: string;
  artist: string | null;
  guest: { id: string; firstName: string; lastName: string } | null;
};

export function GuestRequestsSection({ requests }: { requests: GuestRequest[] }) {
  // Group by guest so it's clear who suggested what. Same guest with three
  // requests (Q3 + Q5 + Q9 from Say I Do) shows once with three lines.
  const byGuest = new Map<string, { name: string; songs: GuestRequest[] }>();
  for (const r of requests) {
    const key = r.guest?.id ?? "anonymous";
    const name = r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Anonymous";
    if (!byGuest.has(key)) byGuest.set(key, { name, songs: [] });
    byGuest.get(key)!.songs.push(r);
  }
  const groups = Array.from(byGuest.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="bg-surface border border-border-soft rounded-md shadow-sm">
      <header className="px-4 py-3 border-b border-border-soft">
        <h2 className="text-sm font-semibold text-ink-primary">Guest requests</h2>
        <p className="text-[11px] text-ink-tertiary">
          Imported from RSVPs (Q3 / Q5 / Q9 in the Say I Do export). Not yet attached to a playlist — review and add the ones you want into your DJ&apos;s setlists above.
        </p>
      </header>
      <ul className="divide-y divide-border-soft">
        {groups.map((g) => (
          <li key={g.name} className="px-4 py-3">
            <div className="text-xs font-semibold text-ink-secondary mb-1">
              {g.name}{" "}
              <span className="text-ink-tertiary font-normal">
                · {g.songs.length} request{g.songs.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="space-y-0.5 pl-1">
              {g.songs.map((s) => (
                <li key={s.id} className="text-sm text-ink-primary leading-snug">
                  <span className="text-ink-tertiary mr-1.5">♪</span>
                  {s.title}
                  {s.artist && <span className="text-ink-tertiary"> — {s.artist}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
