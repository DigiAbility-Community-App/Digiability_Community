-- Skill Trainer role fields (frontend role "skill_trainer" → DB role "volunteer").
-- teachingMode holds "physical" | "online" | "both"; trainingLocation and
-- trainingAddress are only collected when the mode is physical or both.
-- IF NOT EXISTS keeps this safe on databases that already got the columns via
-- `prisma db push` during local development.
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "skillsTaught" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "teachingMode" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "trainingLocation" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "trainingAddress" TEXT;
