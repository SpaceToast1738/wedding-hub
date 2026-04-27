import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { canEdit } from "@/lib/permissions";
import { requireUser } from "@/lib/actions";
import { AddPlaylistToggle } from "./AddPlaylistToggle";
import { PlaylistCard } from "./PlaylistCard";

export default async function SongsPage() {
  const user = await requireUser();
  const editable = await canEdit(user, "songs");
  const playlists = await db.playlist.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { songs: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });

  const totalSongs = playlists.reduce((n, p) => n + p.songs.length, 0);

  return (
    <>
      <PageHeader
        title="Songs"
        subtitle={`${playlists.length} playlists · ${totalSongs} songs`}
        actions={editable ? <AddPlaylistToggle /> : undefined}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
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
