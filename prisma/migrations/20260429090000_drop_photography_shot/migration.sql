-- v1.30.5: drop legacy PhotographyShot table. Data was migrated to BookShot
-- under a SHOT_LIST card on the Photography section in v1.27.6; the legacy
-- table was retained one release as a recoverability buffer. Buffer
-- elapsed.

DROP TABLE "PhotographyShot";
