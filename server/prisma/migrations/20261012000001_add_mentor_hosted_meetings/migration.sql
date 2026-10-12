-- AlterTable
ALTER TABLE "GoogleCalendarConnection" ADD COLUMN     "google_email" TEXT,
ADD COLUMN     "needs_reconnect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_error" TEXT;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "meeting_host" TEXT;
