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

export default async function SongsPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "songs");
  const spotifyEnabled = isSpotifyConfigured();

  const [playlists, guestRequests, navTagForPage] = await Promise.all([
    db.playlist.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: { songs: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
    }),
    // Imported / guest-submitted requests, only the unassigned ones (those
    // already attached to a playlist render via PlaylistCard above).
    db.songRequest.findMany({
      where: { playlistId: null },
      orderBy: { createdAt: "asc" },
      include: {
        guest: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    // v1.52.0 (backlog #7): the nav tag whose `route` matches this
    // page surfaces tasks linked to it as a strip below the header.
    db.navTag.findFirst({
      where: { route: "/songs" },
      select: { id: true, name: true },
    }),
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

  const totalSongs = playlists.reduce((n, p) => n + p.songs.length, 0);
  const subtitleBits = [`${playlists.length} playlists`, `${totalSongs} curated songs`];
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
      {navTagForPage && (
        <PageLinkedTasksStrip
          tasks={linkedTasks}
          navTagName={navTagForPage.name}
        />
      )}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
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
