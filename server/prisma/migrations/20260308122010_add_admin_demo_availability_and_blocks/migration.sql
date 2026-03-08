-- CreateTable
CREATE TABLE "AdminDemoAvailability" (
    "id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,

    CONSTRAINT "AdminDemoAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminDemoTimeBlock" (
    "id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminDemoTimeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminDemoTimeBlock_start_time_end_time_idx" ON "AdminDemoTimeBlock"("start_time", "end_time");
