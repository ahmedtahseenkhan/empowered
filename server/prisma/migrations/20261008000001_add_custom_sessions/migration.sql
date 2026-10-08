-- AlterEnum
ALTER TYPE "LessonBillingType" ADD VALUE 'CUSTOM_FREE';

-- CreateEnum
CREATE TYPE "LessonOrigin" AS ENUM ('BOOKING', 'MENTOR_OFFER');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "origin" "LessonOrigin" NOT NULL DEFAULT 'BOOKING',
ADD COLUMN     "custom_kind" TEXT,
ADD COLUMN     "makeup_for_lesson_id" TEXT,
ADD COLUMN     "offer_message" TEXT,
ADD COLUMN     "offer_expires_at" TIMESTAMP(3),
ADD COLUMN     "offer_responded_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lesson_origin_status_idx" ON "Lesson"("origin", "status");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_makeup_for_lesson_id_fkey" FOREIGN KEY ("makeup_for_lesson_id") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
