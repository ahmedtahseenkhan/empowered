-- SupportTicket: allow guest submissions (contact form) with optional user_id and submitter name/email
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "submitter_name" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "submitter_email" TEXT;
ALTER TABLE "SupportTicket" ALTER COLUMN "user_id" DROP NOT NULL;
