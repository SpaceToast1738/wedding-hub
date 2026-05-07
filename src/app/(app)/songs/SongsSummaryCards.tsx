// v1.73.0: Summary card grid mirroring prototype/SongsPage.jsx.
// One card per playlist; click scrolls to that playlist's section
// (PlaylistCard renders with id="playlist-<id>").
//
// Server component — no state. The cards are anchor links rather
// than filter buttons because the underlying playlists already render
// as separate sections below; scrolling is the simplest behaviour
// that matches the prototype's "click to jump" affordance.

type SummaryPlaylist = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  isBlockList: boolean;
  songCount: number;
};

const CATEGORY_HINT: Record<string, string> = {
  BRIDAL_PREP: "Getting-ready playlist (separate vibes for each room)",
  CEREMONY: "Processional, signing, recessional",
  DRINKS_RECEPTION: "Background music in the walled garden",
  WEDDING_BREAKFAST: "Ambient dinner music while plates land",
  FIRST_DANCE: "One song · played immediately after speeches",
  MUST_PLAY: "Played at some point during the reception",
  DO_NOT_PLAY: "Block-list — never queued by Spotify",
};

// Tailwind utility groups per category. The prototype maps each
// category to its own accent — here we keep it to three palette
// hooks (moss / marigold / danger) so we can add new categories
// without touching this file.
const CATEGORY_ACCENT: Record<
  string,
  { label: string; border: string; leftBar: string }
> = {
  BRIDAL_PREP: {
    label: "text-marigold-700",
    border: "border-border-soft",
    leftBar: "border-l-marigold-700",
  },
  CEREMONY: {
    label: "text-moss-700",
    border: "border-border-soft",
    leftBar: "border-l-moss-700",
  },
  DRINKS_RECEPTION: {
    label: "text-moss-500",
    border: "border-border-soft",
    leftBar: "border-l-moss-500",
  },
  WEDDING_BREAKFAST: {
    label: "text-moss-500",
    border: "border-border-soft",
    leftBar: "border-l-moss-500",
  },
  FIRST_DANCE: {
    label: "text-marigold-700",
    border: "border-border-soft",
    leftBar: "border-l-marigold-700",
  },
  MUST_PLAY: {
    label: "text-moss-500",
    border: "border-border-soft",
    leftBar: "border-l-moss-500",
  },
  DO_NOT_PLAY: {
    label: "text-danger",
    border: "border-border-soft",
    leftBar: "border-l-danger",
  },
};

const DEFAULT_ACCENT = {
  label: "text-moss-500",
  border: "border-border-soft",
  leftBar: "border-l-moss-500",
};

export function SongsSummaryCards({ playlists }: { playlists: SummaryPlaylist[] }) {
  if (playlists.length === 0) return null;
  return (
    <div className="px-4 sm:px-6 pt-3 grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {playlists.map((p) => {
        const accent = CATEGORY_ACCENT[p.category] ?? DEFAULT_ACCENT;
        const hint = p.description ?? CATEGORY_HINT[p.category] ?? null;
        return (
          <a
            key={p.id}
            href={`#playlist-${p.id}`}
            className={`block bg-surface border ${accent.border} ${accent.leftBar} border-l-[3px] rounded-md p-3 text-left no-underline hover:bg-canvas/40 transition-colors`}
          >
            <div
              className={`text-[11px] font-semibold uppercase tracking-wider ${accent.label} mb-1`}
            >
              {p.name}
            </div>
            <div className="font-display text-2xl font-semibold text-ink-primary leading-none">
              {p.songCount}
            </div>
            {hint && (
              <div className="text-[11px] text-ink-tertiary mt-1 line-clamp-2">
                {hint}
              </div>
            )}
          </a>
        );
      })}
    </div>
  );
}
