-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('STRIPE', 'ZELLE', 'BANK_TRANSFER');

-- AlterTable
ALTER TABLE "MentorPayout" ADD COLUMN     "method" "PayoutMethod",
ADD COLUMN     "proof_url" TEXT;

-- AlterTable
ALTER TABLE "TutorProfile" ADD COLUMN     "payout_bank_account_name" TEXT,
ADD COLUMN     "payout_bank_account_number" TEXT,
ADD COLUMN     "payout_bank_name" TEXT,
ADD COLUMN     "payout_bank_notes" TEXT,
ADD COLUMN     "payout_bank_routing" TEXT,
ADD COLUMN     "payout_method" "PayoutMethod",
ADD COLUMN     "payout_zelle_contact" TEXT;

