-- CreateEnum
CREATE TYPE "BetaApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "BetaApplication" ADD COLUMN "status" "BetaApplicationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "actioned_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BetaApplication_status_idx" ON "BetaApplication"("status");
