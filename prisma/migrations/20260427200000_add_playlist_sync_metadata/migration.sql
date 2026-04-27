-- Spotify sync metadata on Playlist: when a sync last ran, last error, and
-- how many songs landed on that run. All nullable so existing rows are valid.
ALTER TABLE "Playlist" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "Playlist" ADD COLUMN "lastSyncError" TEXT;
ALTER TABLE "Playlist" ADD COLUMN "lastSyncedSongs" INTEGER;
