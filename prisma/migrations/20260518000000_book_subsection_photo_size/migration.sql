-- v1.96.4: per-card photo gallery size. 'sm' / 'md' / 'lg' control
-- the <ImageGallery> grid + thumbnail dimensions. String column (not
-- enum) so future sizes are migration-free. Default 'md' matches the
-- v1.63.0 baseline so unmigrated cards render identically.
ALTER TABLE "BookSubsection" ADD COLUMN "photoSize" TEXT NOT NULL DEFAULT 'md';
