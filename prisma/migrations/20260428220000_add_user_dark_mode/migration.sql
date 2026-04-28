-- B11 (v1.12.0): per-account dark-mode preference. Nullable so existing
-- rows aren't forced to commit to a value; the client first-paint script
-- will populate it from localStorage on next sign-in.
ALTER TABLE "User" ADD COLUMN "darkMode" BOOLEAN;
