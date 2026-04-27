import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddPlaylistToggle } from "./AddPlaylistToggle";
import { PlaylistCard } from "./PlaylistCard";
import { GuestRequestsSection } from "./GuestRequestsSection";

export default async function SongsPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "songs");

  const [playlists, guestRequests] = await Promise.all([
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
  ]);

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
        actions={editable ? <AddPlaylistToggle /> : undefined}
      />
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
            playlists.map((p) => <PlaylistCard key={p.id} playlist={p} canEdit={editable} />)
          )}
        </div>
      </div>
    </>
  );
}
