-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'TRANSFERRED', 'PAID', 'FAILED', 'MANUAL');

-- AlterTable
ALTER TABLE "CreditLedger" ADD COLUMN     "stripe_checkout_session_id" TEXT,
ADD COLUMN     "stripe_payment_intent_id" TEXT;

-- AlterTable
ALTER TABLE "MentorEarning" ADD COLUMN     "payout_id" TEXT;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "wallet_freeze_reason" TEXT,
ADD COLUMN     "wallet_frozen_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MentorPayout" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "earnings_count" INTEGER NOT NULL DEFAULT 0,
    "stripe_transfer_id" TEXT,
    "failure_reason" TEXT,
    "note" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "MentorPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSettlementRun" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "ran_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggered_by" TEXT,
    "payouts_created" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "skipped_mentors" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "WalletSettlementRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentorPayout_tutor_id_idx" ON "MentorPayout"("tutor_id");

-- CreateIndex
CREATE INDEX "MentorPayout_period_idx" ON "MentorPayout"("period");

-- CreateIndex
CREATE INDEX "MentorPayout_status_idx" ON "MentorPayout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSettlementRun_period_key" ON "WalletSettlementRun"("period");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_stripe_payment_intent_id_key" ON "CreditLedger"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_stripe_checkout_session_id_key" ON "CreditLedger"("stripe_checkout_session_id");

-- AddForeignKey
ALTER TABLE "MentorEarning" ADD CONSTRAINT "MentorEarning_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "MentorPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorPayout" ADD CONSTRAINT "MentorPayout_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

