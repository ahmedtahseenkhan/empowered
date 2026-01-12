-- CreateEnum
CREATE TYPE "TutorTier" AS ENUM ('STANDARD', 'PRO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "BookingFrequency" AS ENUM ('ONCE', 'WEEKLY', 'TWICE_WEEKLY', 'THRICE_WEEKLY');

-- AlterEnum
ALTER TYPE "LessonStatus" ADD VALUE 'MISSED';

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "booking_id" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "date_of_birth" TIMESTAMP(3),
ADD COLUMN     "grade_level" TEXT,
ADD COLUMN     "preferences" JSONB;

-- AlterTable
ALTER TABLE "TutorCertification" ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TutorProfile" ADD COLUMN     "tier" "TutorTier" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "frequency" "BookingFrequency" NOT NULL DEFAULT 'ONCE',
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSchedule" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "stripe_pi_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
