-- AlterTable
ALTER TABLE "AdminProfile" ADD COLUMN "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: existing admins keep full access by becoming super admins
UPDATE "AdminProfile" SET "is_super_admin" = true;
