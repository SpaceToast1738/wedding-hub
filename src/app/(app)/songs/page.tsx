import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { isSpotifyConfigured } from "@/lib/spotify";
import { PageLinkedTasksStrip } from "@/components/ui/PageLinkedTasksStrip";
import { AddPlaylistToggle } from "./AddPlaylistToggle";
import { PlaylistCard } from "./PlaylistCard";
import { GuestRequestsSection } from "./GuestRequestsSection";
import { SongsSummaryCards } from "./SongsSummaryCards";
import { SpotifyConnectionBanner } from "./SpotifyConnectionBanner";

// v1.57.0 (XL9): accepts `?guest=<id>` filter so a deep-link from
// `/guests/[id]` lands at the relevant requests-by-this-guest view
// instead of the unfiltered playlist firehose.
export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<{ guest?: string }>;
}) {
  const user = await requireUser();
  const editable = await canEdit(user, "songs");
  const spotifyEnabled = isSpotifyConfigured();
  const sp = await searchParams;
  const guestFilter = typeof sp.guest === "string" ? sp.guest : null;

  // Note: `Song` has no FK to Guest — only `SongRequest.guestId` does.
  // So the `?guest=<id>` filter scopes the **requests** panel only;
  // playlists keep showing all curated songs. The filter is most
  // useful coming from a guest detail page asking "what did they
  // request?".
  const [playlists, guestRequests, filteredGuest, navTagForPage, taskUsers] = await Promise.all([
    db.playlist.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: { songs: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
    }),
    // Imported / guest-submitted requests, only the unassigned ones (those
    // already attached to a playlist render via PlaylistCard above).
    db.songRequest.findMany({
      where: {
        playlistId: null,
        ...(guestFilter ? { guestId: guestFilter } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: {
        guest: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    // Resolve the filter target's display name for the filter banner.
    guestFilter
      ? db.guest.findUnique({
          where: { id: guestFilter },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve(null),
    // v1.52.0 (backlog #7): the nav tag whose `route` matches this
    // page surfaces tasks linked to it as a strip below the header.
    db.navTag.findFirst({
      where: { route: "/songs" },
      select: { id: true, name: true },
    }),
    // v1.71.0: users for AddTaskToggle in the strip.
    editable
      ? db.user.findMany({ orderBy: [{ isCouple: "desc" }, { name: "asc" }], select: { id: true, name: true, email: true } })
      : Promise.resolve([]),
  ]);

  // v1.52.0: tasks tagged with the page's nav tag. Cheap second query
  // — kept separate from the navTag findFirst so a missing nav tag
  // (e.g. the couple deleted it from Settings) doesn't break the page.
  const linkedTasks = navTagForPage
    ? await db.task.findMany({
        where: { navTags: { some: { id: navTagForPage.id } } },
        orderBy: [
          { status: "asc" },
          { priority: "desc" },
          { dueDate: "asc" },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          dueDate: true,
        },
      })
    : [];

  // v1.73.0: subtitle mirrors prototype — split songs into "on the
  // playlist" vs "blocked" so the do-not-play count gets its own
  // billing, and add a runtime estimate (~3.5 min/track, matches
  // the prototype's heuristic).
  const playlistSongs = playlists
    .filter((p) => !p.isBlockList)
    .reduce((n, p) => n + p.songs.length, 0);
  const blockedSongs = playlists
    .filter((p) => p.isBlockList)
    .reduce((n, p) => n + p.songs.length, 0);
  const runtimeMins = Math.round(playlistSongs * 3.5);
  const runtimeLabel = `~${Math.floor(runtimeMins / 60)}h ${runtimeMins % 60}m runtime`;
  const subtitleBits = [`${playlistSongs} on the playlist`];
  if (blockedSongs > 0) subtitleBits.push(`${blockedSongs} blocked`);
  if (playlistSongs > 0) subtitleBits.push(runtimeLabel);
  if (guestRequests.length > 0) {
    subtitleBits.push(`${guestRequests.length} guest request${guestRequests.length === 1 ? "" : "s"}`);
  }

  return (
    <>
      <PageHeader
        title="Songs"
        subtitle={subtitleBits.join(" · ")}
        actions={
          <>
            {/* Spotify status chip — links to Settings → Spotify integration
                section so the user has a fast path to debug or set up. */}
            <Link
              href="/settings#spotify-integration"
              className={[
                "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border transition-colors",
                spotifyEnabled
                  ? "text-moss-700 bg-moss-50 border-moss-100 hover:border-moss-300"
                  : "text-marigold-700 bg-marigold-100 border-marigold-700/30 hover:bg-marigold-100/80",
              ].join(" ")}
              title={
                spotifyEnabled
                  ? "Spotify is configured — open Settings for the setup reference"
                  : "Spotify isn't configured — open Settings to see how to enable it"
              }
            >
              <span aria-hidden>🎵</span>
              Spotify {spotifyEnabled ? "✓" : "off"}
            </Link>
            {editable && <AddPlaylistToggle />}
          </>
        }
      />
      {filteredGuest && (
        <div className="bg-moss-50 border-b border-moss-300 px-4 sm:px-6 py-2 flex items-center gap-3 text-xs">
          <span className="text-ink-secondary">
            Showing requests by:{" "}
            <strong className="text-ink-primary">
              {filteredGuest.firstName} {filteredGuest.lastName}
            </strong>
          </span>
          <Link href="/songs" className="text-info hover:underline ml-auto">
            Clear ×
          </Link>
        </div>
      )}
      {navTagForPage && (
        <PageLinkedTasksStrip
          tasks={linkedTasks}
          navTagName={navTagForPage.name}
          navTagId={navTagForPage.id}
          canEdit={editable}
          users={taskUsers}
        />
      )}
      {/* v1.73.0: prototype-aligned summary grid + Spotify banner. */}
      <SongsSummaryCards
        playlists={playlists.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description,
          isBlockList: p.isBlockList,
          songCount: p.songs.length,
        }))}
      />
      <SpotifyConnectionBanner
        spotifyEnabled={spotifyEnabled}
        playlists={playlists.map((p) => ({
          id: p.id,
          name: p.name,
          songCount: p.songs.length,
          spotifyId: p.spotifyId,
          lastSyncedAt: p.lastSyncedAt,
        }))}
      />
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 space-y-4">
          {guestRequests.length > 0 && (
            <GuestRequestsSection requests={guestRequests} />
          )}
          {playlists.length === 0 ? (
            <p className="text-sm text-ink-tertiary text-center py-12">
              No playlists yet. {editable && "Create one above."}
            </p>
          ) : (
            playlists.map((p) => (
              <PlaylistCard
                key={p.id}
                playlist={p}
                canEdit={editable}
                spotifyEnabled={spotifyEnabled}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
