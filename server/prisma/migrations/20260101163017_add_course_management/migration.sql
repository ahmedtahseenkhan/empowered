/*
  Warnings:

  - You are about to drop the column `total_hours` on the `Course` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `Course` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to drop the `Enrollment` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `course_url` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_course_id_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_student_id_fkey";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "total_hours",
ADD COLUMN     "course_url" TEXT NOT NULL,
ADD COLUMN     "duration" TEXT,
ADD COLUMN     "learning_objectives" TEXT,
ADD COLUMN     "preview_url" TEXT,
ADD COLUMN     "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "target_audience" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2);

-- DropTable
DROP TABLE "Enrollment";

-- CreateTable
CREATE TABLE "TutorExternalReview" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "reviewer" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "date" TIMESTAMP(3),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TutorExternalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePurchase" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL,
    "stripe_payment_id" TEXT,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "access_granted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CoursePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoursePurchase_course_id_student_id_key" ON "CoursePurchase"("course_id", "student_id");

-- AddForeignKey
ALTER TABLE "TutorExternalReview" ADD CONSTRAINT "TutorExternalReview_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePurchase" ADD CONSTRAINT "CoursePurchase_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePurchase" ADD CONSTRAINT "CoursePurchase_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
