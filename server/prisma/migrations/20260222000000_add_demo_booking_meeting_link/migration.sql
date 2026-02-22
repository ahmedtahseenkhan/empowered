-- AlterTable: add meeting_link for demo Google Meet (optional so admin list works with existing rows)
ALTER TABLE "DemoBooking" ADD COLUMN IF NOT EXISTS "meeting_link" TEXT;
