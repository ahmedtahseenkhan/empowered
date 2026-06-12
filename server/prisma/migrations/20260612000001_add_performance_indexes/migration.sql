-- Add indexes on foreign keys and hot query paths.
-- PostgreSQL does not auto-index foreign keys, so these speed up joins,
-- relation lookups, and the scheduler/webhook/outbox queries.
-- IF NOT EXISTS keeps this safe to re-run.

-- TutorTimeBlock
CREATE INDEX IF NOT EXISTS "TutorTimeBlock_tutor_id_idx" ON "TutorTimeBlock"("tutor_id");
CREATE INDEX IF NOT EXISTS "TutorTimeBlock_tutor_id_start_time_idx" ON "TutorTimeBlock"("tutor_id", "start_time");

-- User
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- StudentProfile
CREATE INDEX IF NOT EXISTS "StudentProfile_stripe_customer_id_idx" ON "StudentProfile"("stripe_customer_id");

-- TutorProfile
CREATE INDEX IF NOT EXISTS "TutorProfile_stripe_subscription_id_idx" ON "TutorProfile"("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "TutorProfile_stripe_customer_id_idx" ON "TutorProfile"("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "TutorProfile_stripe_account_id_idx" ON "TutorProfile"("stripe_account_id");
CREATE INDEX IF NOT EXISTS "TutorProfile_is_verified_idx" ON "TutorProfile"("is_verified");

-- Whiteboard
CREATE INDEX IF NOT EXISTS "Whiteboard_tutor_id_idx" ON "Whiteboard"("tutor_id");

-- OAuthState
CREATE INDEX IF NOT EXISTS "OAuthState_tutor_id_idx" ON "OAuthState"("tutor_id");
CREATE INDEX IF NOT EXISTS "OAuthState_expires_at_idx" ON "OAuthState"("expires_at");

-- EmailOutbox (polled by the outbox processor)
CREATE INDEX IF NOT EXISTS "EmailOutbox_status_next_retry_at_idx" ON "EmailOutbox"("status", "next_retry_at");
CREATE INDEX IF NOT EXISTS "EmailOutbox_status_created_at_idx" ON "EmailOutbox"("status", "created_at");

-- TutorExternalReview
CREATE INDEX IF NOT EXISTS "TutorExternalReview_tutor_id_idx" ON "TutorExternalReview"("tutor_id");
CREATE INDEX IF NOT EXISTS "TutorExternalReview_verification_status_idx" ON "TutorExternalReview"("verification_status");

-- TutorEducation
CREATE INDEX IF NOT EXISTS "TutorEducation_tutor_id_idx" ON "TutorEducation"("tutor_id");

-- TutorExperience
CREATE INDEX IF NOT EXISTS "TutorExperience_tutor_id_idx" ON "TutorExperience"("tutor_id");

-- TutorCertification
CREATE INDEX IF NOT EXISTS "TutorCertification_tutor_id_idx" ON "TutorCertification"("tutor_id");
CREATE INDEX IF NOT EXISTS "TutorCertification_verification_status_idx" ON "TutorCertification"("verification_status");

-- TutorLanguage
CREATE INDEX IF NOT EXISTS "TutorLanguage_tutor_id_idx" ON "TutorLanguage"("tutor_id");

-- Category
CREATE INDEX IF NOT EXISTS "Category_parent_id_idx" ON "Category"("parent_id");

-- TutorCategory
CREATE INDEX IF NOT EXISTS "TutorCategory_category_id_idx" ON "TutorCategory"("category_id");

-- Booking
CREATE INDEX IF NOT EXISTS "Booking_student_id_idx" ON "Booking"("student_id");
CREATE INDEX IF NOT EXISTS "Booking_tutor_id_idx" ON "Booking"("tutor_id");
CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status");

-- Lesson
CREATE INDEX IF NOT EXISTS "Lesson_tutor_id_idx" ON "Lesson"("tutor_id");
CREATE INDEX IF NOT EXISTS "Lesson_student_id_idx" ON "Lesson"("student_id");
CREATE INDEX IF NOT EXISTS "Lesson_booking_id_idx" ON "Lesson"("booking_id");
CREATE INDEX IF NOT EXISTS "Lesson_start_time_idx" ON "Lesson"("start_time");
CREATE INDEX IF NOT EXISTS "Lesson_status_start_time_idx" ON "Lesson"("status", "start_time");

-- PaymentSchedule
CREATE INDEX IF NOT EXISTS "PaymentSchedule_booking_id_idx" ON "PaymentSchedule"("booking_id");
CREATE INDEX IF NOT EXISTS "PaymentSchedule_stripe_pi_id_idx" ON "PaymentSchedule"("stripe_pi_id");
CREATE INDEX IF NOT EXISTS "PaymentSchedule_status_due_date_idx" ON "PaymentSchedule"("status", "due_date");

-- Availability
CREATE INDEX IF NOT EXISTS "Availability_tutor_id_idx" ON "Availability"("tutor_id");

-- FreeSessionAvailability
CREATE INDEX IF NOT EXISTS "FreeSessionAvailability_tutor_id_idx" ON "FreeSessionAvailability"("tutor_id");

-- Course
CREATE INDEX IF NOT EXISTS "Course_tutor_id_idx" ON "Course"("tutor_id");
CREATE INDEX IF NOT EXISTS "Course_status_idx" ON "Course"("status");

-- CoursePurchase
CREATE INDEX IF NOT EXISTS "CoursePurchase_student_id_idx" ON "CoursePurchase"("student_id");

-- Review
CREATE INDEX IF NOT EXISTS "Review_tutor_id_idx" ON "Review"("tutor_id");
CREATE INDEX IF NOT EXISTS "Review_student_id_idx" ON "Review"("student_id");

-- Subscription
CREATE INDEX IF NOT EXISTS "Subscription_student_id_idx" ON "Subscription"("student_id");
CREATE INDEX IF NOT EXISTS "Subscription_tutor_id_idx" ON "Subscription"("tutor_id");
CREATE INDEX IF NOT EXISTS "Subscription_stripe_sub_id_idx" ON "Subscription"("stripe_sub_id");

-- StudentTutorStatus
CREATE INDEX IF NOT EXISTS "StudentTutorStatus_tutor_id_idx" ON "StudentTutorStatus"("tutor_id");

-- ProgressNote
CREATE INDEX IF NOT EXISTS "ProgressNote_lesson_id_idx" ON "ProgressNote"("lesson_id");

-- SupportTicket
CREATE INDEX IF NOT EXISTS "SupportTicket_user_id_idx" ON "SupportTicket"("user_id");
CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket"("status");

-- AdminReply
CREATE INDEX IF NOT EXISTS "AdminReply_ticket_id_idx" ON "AdminReply"("ticket_id");
