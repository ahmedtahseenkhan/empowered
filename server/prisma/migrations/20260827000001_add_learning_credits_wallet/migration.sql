-- CreateEnum
CREATE TYPE "BookingFunding" AS ENUM ('CARD', 'CREDITS', 'FREE');

-- CreateEnum
CREATE TYPE "CreditSource" AS ENUM ('PURCHASED', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'RELEASED', 'RETURNED');

-- CreateEnum
CREATE TYPE "MentorEarningStatus" AS ENUM ('PENDING', 'ON_HOLD', 'AVAILABLE', 'TRANSFERRED', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED_REFUNDED', 'RESOLVED_RELEASED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CreditTransactionType" ADD VALUE 'PROMO_GRANT';
ALTER TYPE "CreditTransactionType" ADD VALUE 'RESERVE';
ALTER TYPE "CreditTransactionType" ADD VALUE 'UNRESERVE';
ALTER TYPE "CreditTransactionType" ADD VALUE 'RELEASE';
ALTER TYPE "CreditTransactionType" ADD VALUE 'REVERSAL';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "funding" "BookingFunding" NOT NULL DEFAULT 'CARD';

-- AlterTable
ALTER TABLE "CreditLedger" ADD COLUMN     "balance_after" INTEGER,
ADD COLUMN     "booking_id" TEXT,
ADD COLUMN     "created_by_user_id" TEXT,
ADD COLUMN     "lesson_id" TEXT,
ADD COLUMN     "reservation_id" TEXT,
ADD COLUMN     "source" "CreditSource";

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "completed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "promo_credits_balance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reserved_credits" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SessionReservation" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "promo_credits" INTEGER NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "return_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),

    CONSTRAINT "SessionReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorEarning" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "reservation_id" TEXT,
    "gross_cents" INTEGER NOT NULL,
    "fee_cents" INTEGER NOT NULL,
    "net_cents" INTEGER NOT NULL,
    "fee_percent" DOUBLE PRECISION NOT NULL,
    "promo_cents" INTEGER NOT NULL DEFAULT 0,
    "status" "MentorEarningStatus" NOT NULL DEFAULT 'PENDING',
    "available_at" TIMESTAMP(3) NOT NULL,
    "settled_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "reversed_at" TIMESTAMP(3),
    "stripe_transfer_id" TEXT,
    "stripe_payout_id" TEXT,
    "payout_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionDispute" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_note" TEXT,
    "resolved_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "SessionDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionReservation_lesson_id_key" ON "SessionReservation"("lesson_id");

-- CreateIndex
CREATE INDEX "SessionReservation_student_id_idx" ON "SessionReservation"("student_id");

-- CreateIndex
CREATE INDEX "SessionReservation_booking_id_idx" ON "SessionReservation"("booking_id");

-- CreateIndex
CREATE INDEX "SessionReservation_status_idx" ON "SessionReservation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MentorEarning_lesson_id_key" ON "MentorEarning"("lesson_id");

-- CreateIndex
CREATE INDEX "MentorEarning_tutor_id_idx" ON "MentorEarning"("tutor_id");

-- CreateIndex
CREATE INDEX "MentorEarning_tutor_id_status_idx" ON "MentorEarning"("tutor_id", "status");

-- CreateIndex
CREATE INDEX "MentorEarning_student_id_idx" ON "MentorEarning"("student_id");

-- CreateIndex
CREATE INDEX "MentorEarning_status_available_at_idx" ON "MentorEarning"("status", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "SessionDispute_lesson_id_key" ON "SessionDispute"("lesson_id");

-- CreateIndex
CREATE INDEX "SessionDispute_status_idx" ON "SessionDispute"("status");

-- CreateIndex
CREATE INDEX "SessionDispute_student_id_idx" ON "SessionDispute"("student_id");

-- CreateIndex
CREATE INDEX "SessionDispute_tutor_id_idx" ON "SessionDispute"("tutor_id");

-- CreateIndex
CREATE INDEX "CreditLedger_student_id_created_at_idx" ON "CreditLedger"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "CreditLedger_lesson_id_idx" ON "CreditLedger"("lesson_id");

-- AddForeignKey
ALTER TABLE "SessionReservation" ADD CONSTRAINT "SessionReservation_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionReservation" ADD CONSTRAINT "SessionReservation_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionReservation" ADD CONSTRAINT "SessionReservation_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorEarning" ADD CONSTRAINT "MentorEarning_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorEarning" ADD CONSTRAINT "MentorEarning_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorEarning" ADD CONSTRAINT "MentorEarning_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorEarning" ADD CONSTRAINT "MentorEarning_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionDispute" ADD CONSTRAINT "SessionDispute_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionDispute" ADD CONSTRAINT "SessionDispute_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionDispute" ADD CONSTRAINT "SessionDispute_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

