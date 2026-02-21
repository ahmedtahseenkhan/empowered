-- CreateTable
CREATE TABLE "DemoBooking" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "category_alignment" TEXT NOT NULL,
    "experience_years" TEXT NOT NULL,
    "income_status" TEXT NOT NULL,
    "looking_for" TEXT NOT NULL,
    "slot_start_time" TIMESTAMP(3) NOT NULL,
    "slot_end_time" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemoBooking_slot_start_time_idx" ON "DemoBooking"("slot_start_time");
