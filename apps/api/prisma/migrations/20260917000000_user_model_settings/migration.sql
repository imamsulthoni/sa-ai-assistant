-- Per-user AI routing config: provider default is now OpenRouter, the default
-- model column becomes optional so it can fall back to the server env, and
-- each difficulty level gets its own optional model override.
ALTER TABLE "UserSetting" ALTER COLUMN "aiProvider" SET DEFAULT 'openrouter';
ALTER TABLE "UserSetting" ALTER COLUMN "aiModel" DROP NOT NULL;
ALTER TABLE "UserSetting" ALTER COLUMN "aiModel" DROP DEFAULT;
ALTER TABLE "UserSetting" ADD COLUMN "easyModel" TEXT;
ALTER TABLE "UserSetting" ADD COLUMN "mediumModel" TEXT;
ALTER TABLE "UserSetting" ADD COLUMN "hardModel" TEXT;

-- Nilai lama hanya berasal dari default kolom (belum pernah bisa diubah user);
-- dikosongkan agar mengikuti default env server.
UPDATE "UserSetting" SET "aiProvider" = 'openrouter' WHERE "aiProvider" = 'openai';
UPDATE "UserSetting" SET "aiModel" = NULL WHERE "aiModel" = 'gpt-4o-mini';
