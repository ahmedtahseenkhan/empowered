-- AlterTable: add required referral_source. Backfill existing rows with '' via a
-- temporary default, then drop the default to match the Prisma schema (no default).
ALTER TABLE "BetaApplication" ADD COLUMN "referral_source" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BetaApplication" ALTER COLUMN "referral_source" DROP DEFAULT;
