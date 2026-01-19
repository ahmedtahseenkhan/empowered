-- CreateEnum
CREATE TYPE "MarketingVideoSubmissionStatus" AS ENUM ('DRAFT', 'LINK_SUBMITTED', 'EMAIL_REQUESTED');

-- CreateTable
CREATE TABLE "TutorMarketingVideoSubmission" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "video_url" TEXT,
    "instructions" TEXT,
    "status" "MarketingVideoSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "link_submitted_at" TIMESTAMP(3),
    "email_requested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorMarketingVideoSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TutorMarketingVideoSubmission_tutor_id_key" ON "TutorMarketingVideoSubmission"("tutor_id");

-- AddForeignKey
ALTER TABLE "TutorMarketingVideoSubmission" ADD CONSTRAINT "TutorMarketingVideoSubmission_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
