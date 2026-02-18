-- AlterEnum: add FREE_INTRO to LessonBillingType
ALTER TYPE "LessonBillingType" ADD VALUE 'FREE_INTRO';

-- AlterTable: add free_session_enabled to TutorProfile
ALTER TABLE "TutorProfile" ADD COLUMN "free_session_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: FreeSessionAvailability
CREATE TABLE "FreeSessionAvailability" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,

    CONSTRAINT "FreeSessionAvailability_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FreeSessionAvailability" ADD CONSTRAINT "FreeSessionAvailability_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
