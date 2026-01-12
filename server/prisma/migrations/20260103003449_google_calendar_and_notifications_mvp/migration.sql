/*
  Warnings:

  - A unique constraint covering the columns `[google_calendar_event_id]` on the table `Lesson` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "google_calendar_event_id" TEXT,
ADD COLUMN     "google_calendar_html_link" TEXT;

-- CreateTable
CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "access_token_enc" TEXT,
    "refresh_token_enc" TEXT,
    "scope" TEXT,
    "token_type" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "state" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("state")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_retry_at" TIMESTAMP(3),
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarConnection_tutor_id_key" ON "GoogleCalendarConnection"("tutor_id");

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_idempotency_key_key" ON "EmailOutbox"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_google_calendar_event_id_key" ON "Lesson"("google_calendar_event_id");

-- AddForeignKey
ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
