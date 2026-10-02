-- Down migration for 0001 (user.camera).
ALTER TABLE "user" DROP COLUMN IF EXISTS "camera";
