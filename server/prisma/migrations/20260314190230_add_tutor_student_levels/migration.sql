-- AlterTable
ALTER TABLE "TutorProfile" ADD COLUMN     "student_levels" TEXT[] DEFAULT ARRAY[]::TEXT[];
