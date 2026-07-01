-- Add optional social link columns to the mentor profile.
ALTER TABLE "TutorProfile" ADD COLUMN "facebook_url" TEXT;
ALTER TABLE "TutorProfile" ADD COLUMN "instagram_url" TEXT;
ALTER TABLE "TutorProfile" ADD COLUMN "linkedin_url" TEXT;
ALTER TABLE "TutorProfile" ADD COLUMN "twitter_url" TEXT;
ALTER TABLE "TutorProfile" ADD COLUMN "youtube_url" TEXT;
ALTER TABLE "TutorProfile" ADD COLUMN "tiktok_url" TEXT;
ALTER TABLE "TutorProfile" ADD COLUMN "website_url" TEXT;
