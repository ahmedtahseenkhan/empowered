-- CreateTable
CREATE TABLE "BetaApplication" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "service_description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "category_other" TEXT,
    "session_management" TEXT[],
    "has_active_clients" BOOLEAN NOT NULL,
    "biggest_challenge" TEXT NOT NULL,
    "profile_link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BetaApplication_email_idx" ON "BetaApplication"("email");
