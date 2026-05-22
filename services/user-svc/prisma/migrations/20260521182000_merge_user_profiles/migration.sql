-- DropForeignKey
ALTER TABLE "caregiver_profiles" DROP CONSTRAINT "caregiver_profiles_userId_fkey";

-- DropForeignKey
ALTER TABLE "ngo_profiles" DROP CONSTRAINT "ngo_profiles_userId_fkey";

-- DropForeignKey
ALTER TABLE "pwd_profiles" DROP CONSTRAINT "pwd_profiles_userId_fkey";

-- DropForeignKey
ALTER TABLE "therapist_profiles" DROP CONSTRAINT "therapist_profiles_userId_fkey";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('pwd', 'caregiver', 'therapist', 'ngo', 'volunteer', 'student');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role" "Role";

-- DropTable
DROP TABLE "caregiver_profiles";

-- DropTable
DROP TABLE "ngo_profiles";

-- DropTable
DROP TABLE "pwd_profiles";

-- DropTable
DROP TABLE "therapist_profiles";

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "fullName" TEXT,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "city" TEXT,
    "state" TEXT,
    "disabilityType" TEXT,
    "disabilitySince" INTEGER,
    "supportNeeded" TEXT,
    "carePersonName" TEXT,
    "careRelation" TEXT,
    "careDob" TIMESTAMP(3),
    "careDisabilityType" TEXT,
    "speciality" TEXT,
    "organization" TEXT,
    "yearsOfExperience" INTEGER,
    "ngoName" TEXT,
    "ngoRole" TEXT,
    "district" TEXT,
    "verificationStatus" TEXT DEFAULT 'pending',
    "verificationDoc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_username_key" ON "user_profiles"("username");

-- CreateIndex
CREATE INDEX "user_profiles_userId_idx" ON "user_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_profiles_username_idx" ON "user_profiles"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
