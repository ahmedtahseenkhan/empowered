-- Track how many times a lesson has been rescheduled (student-initiated reschedule policy)
ALTER TABLE "Lesson" ADD COLUMN "reschedule_count" INTEGER NOT NULL DEFAULT 0;
