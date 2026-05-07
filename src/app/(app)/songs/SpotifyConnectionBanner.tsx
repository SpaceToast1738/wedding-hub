// v1.73.0: Spotify connection banner mirroring prototype/SongsPage.jsx.
// Renders a green gradient strip showing connection state + chips
// for each playlist. Server component — pure presentational, no state.
//
// Visible only when SPOTIFY_CLIENT_ID + SECRET are configured AND at
// least one playlist exists; otherwise the existing "Spotify off" chip
// in the page header carries the message.

type BannerPlaylist = {
  id: string;
  name: string;
  songCount: number;
  spotifyId: string | null;
  lastSyncedAt: Date | null;
};

function relTime(d: Date | null): string | null {
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  if (diff < 0) return null;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function SpotifyConnectionBanner({
  playlists,
  spotifyEnabled,
}: {
  playlists: BannerPlaylist[];
  spotifyEnabled: boolean;
}) {
  if (!spotifyEnabled || playlists.length === 0) return null;
  const linked = playlists.filter((p) => p.spotifyId).length;
  // Most recent sync across all playlists — used as the "last synced"
  // timestamp on the banner.
  const lastSync = playlists
    .map((p) => p.lastSyncedAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const subtitle = lastSync
    ? `last synced ${relTime(lastSync)} · auto-syncs when songs are added or removed`
    : `${linked} of ${playlists.length} playlist${playlists.length === 1 ? "" : "s"} linked · sync hasn't run yet`;
  return (
    <div className="px-4 sm:px-6 pt-3">
      <div
        className="rounded-md p-4 text-white flex flex-wrap items-start gap-3.5"
        style={{
          background: "linear-gradient(135deg, #1DB954 0%, #168d40 100%)",
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.16)" }}
        >
          ♫
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-[13px] font-semibold mb-0.5">
            Spotify connected · {playlists.length} playlist
            {playlists.length === 1 ? "" : "s"}
          </div>
          <div className="text-[11px] opacity-90">{subtitle}</div>
        </div>
        <div className="flex flex-wrap gap-1.5 basis-full">
          {playlists.map((p) => (
            <a
              key={p.id}
              href={`#playlist-${p.id}`}
              title={p.name}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-white no-underline"
              style={{
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.22)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: "#fff" }}
              />
              {p.name}
              <span className="opacity-75 tabular-nums">{p.songCount}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
