-- AlterTable: add meeting_link (required for all demo bookings)
ALTER TABLE "DemoBooking" ADD COLUMN IF NOT EXISTS "meeting_link" TEXT;

-- Backfill any existing rows so we can set NOT NULL (new flow always creates link first)
UPDATE "DemoBooking" SET "meeting_link" = '' WHERE "meeting_link" IS NULL;

-- Make meeting_link required
ALTER TABLE "DemoBooking" ALTER COLUMN "meeting_link" SET NOT NULL;
