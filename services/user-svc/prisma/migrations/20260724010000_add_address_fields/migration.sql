-- Personal address fields collected during onboarding but previously never
-- persisted (no columns existed). locationDistrict is the personal-address
-- district, kept separate from the existing NGO-scoped `district` column.
-- IF NOT EXISTS keeps this safe on databases that already got the columns via
-- `prisma db push`.
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "addressLine1" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "streetArea" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "pincode" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "locationDistrict" TEXT;
