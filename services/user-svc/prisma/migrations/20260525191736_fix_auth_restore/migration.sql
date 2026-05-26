/*
  Warnings:

  - You are about to drop the column `dob` on the `users` table. All the data in the column will be lost.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `email_verification_otps` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('pwd', 'caregiver', 'therapist', 'ngo', 'volunteer', 'student');

-- DropForeignKey
ALTER TABLE "email_verification_otps" DROP CONSTRAINT "email_verification_otps_userId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "dob",
DROP COLUMN "role",
ADD COLUMN     "role" "Role";

-- DropTable
DROP TABLE "email_verification_otps";

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_user_stats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forum_user_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");

-- CreateIndex
CREATE INDEX "email_verification_tokens_token_idx" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "forum_user_stats_userId_key" ON "forum_user_stats"("userId");

-- CreateIndex
CREATE INDEX "forum_user_stats_userId_idx" ON "forum_user_stats"("userId");

-- CreateIndex
CREATE INDEX "forum_bookmarks_userId_idx" ON "forum_bookmarks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "forum_bookmarks_userId_questionId_key" ON "forum_bookmarks"("userId", "questionId");

-- CreateIndex
CREATE INDEX "forum_notifications_userId_idx" ON "forum_notifications"("userId");

-- CreateIndex
CREATE INDEX "forum_notifications_createdAt_idx" ON "forum_notifications"("createdAt");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_user_stats" ADD CONSTRAINT "forum_user_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_bookmarks" ADD CONSTRAINT "forum_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_notifications" ADD CONSTRAINT "forum_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
