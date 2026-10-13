-- CreateTable
CREATE TABLE "RevokedSession" (
    "sid" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevokedSession_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE INDEX "RevokedSession_expires_at_idx" ON "RevokedSession"("expires_at");
