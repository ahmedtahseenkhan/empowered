-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "stripe_checkout_session_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_stripe_checkout_session_id_key" ON "Booking"("stripe_checkout_session_id");
