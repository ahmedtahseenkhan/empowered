-- AlterTable
ALTER TABLE "TutorProfile" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "TutorTimeBlock" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorTimeBlock_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TutorTimeBlock" ADD CONSTRAINT "TutorTimeBlock_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
