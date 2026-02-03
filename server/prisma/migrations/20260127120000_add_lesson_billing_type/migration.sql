-- CreateEnum
CREATE TYPE "LessonBillingType" AS ENUM ('FREE_TRIAL', 'PAID');

-- AlterTable
ALTER TABLE "Lesson"
ADD COLUMN "billing_type" "LessonBillingType" NOT NULL DEFAULT 'PAID';

