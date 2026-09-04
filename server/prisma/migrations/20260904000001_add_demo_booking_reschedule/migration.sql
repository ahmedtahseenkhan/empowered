-- Store the Google Calendar event id so an admin reschedule can move the existing
-- event (keeping the mentor's Meet link) instead of creating a new one.
ALTER TABLE "DemoBooking" ADD COLUMN "google_event_id" TEXT;
ALTER TABLE "DemoBooking" ADD COLUMN "rescheduled_at" TIMESTAMP(3);
