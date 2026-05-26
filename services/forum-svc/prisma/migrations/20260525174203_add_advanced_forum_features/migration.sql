/*
  Warnings:

  - You are about to drop the column `dob` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "forum_answers" DROP CONSTRAINT "forum_answers_authorId_fkey";

-- DropForeignKey
ALTER TABLE "forum_questions" DROP CONSTRAINT "forum_questions_authorId_fkey";

-- DropForeignKey
ALTER TABLE "forum_reports" DROP CONSTRAINT "forum_reports_reporterId_fkey";

-- AlterTable
ALTER TABLE "forum_answers" ADD COLUMN     "altText" TEXT,
ADD COLUMN     "audioUrl" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "forum_questions" ADD COLUMN     "altText" TEXT,
ADD COLUMN     "audioUrl" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
-- ALTER TABLE "users" DROP COLUMN "dob";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "forum_user_stats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedUntil" TIMESTAMP(3),

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
CREATE UNIQUE INDEX "forum_user_stats_userId_key" ON "forum_user_stats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "forum_bookmarks_userId_questionId_key" ON "forum_bookmarks"("userId", "questionId");

-- CreateIndex
CREATE INDEX "forum_notifications_userId_idx" ON "forum_notifications"("userId");

-- CreateIndex
CREATE INDEX "forum_notifications_createdAt_idx" ON "forum_notifications"("createdAt");

-- CreateIndex
CREATE INDEX "forum_answers_questionId_idx" ON "forum_answers"("questionId");

-- CreateIndex
CREATE INDEX "forum_answers_authorId_idx" ON "forum_answers"("authorId");

-- CreateIndex
CREATE INDEX "forum_answers_deletedAt_idx" ON "forum_answers"("deletedAt");

-- CreateIndex
CREATE INDEX "forum_questions_createdAt_idx" ON "forum_questions"("createdAt");

-- CreateIndex
CREATE INDEX "forum_questions_authorId_idx" ON "forum_questions"("authorId");

-- CreateIndex
CREATE INDEX "forum_questions_deletedAt_idx" ON "forum_questions"("deletedAt");

-- CreateIndex
CREATE INDEX "forum_votes_answerId_idx" ON "forum_votes"("answerId");

-- CreateIndex
CREATE INDEX "forum_votes_userId_idx" ON "forum_votes"("userId");

-- AddForeignKey
ALTER TABLE "forum_questions" ADD CONSTRAINT "forum_questions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_answers" ADD CONSTRAINT "forum_answers_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_user_stats" ADD CONSTRAINT "forum_user_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_bookmarks" ADD CONSTRAINT "forum_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_bookmarks" ADD CONSTRAINT "forum_bookmarks_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "forum_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_notifications" ADD CONSTRAINT "forum_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
