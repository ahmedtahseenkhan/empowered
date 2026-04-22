-- Add thumbnail_url and category fields to Course model
ALTER TABLE "Course" ADD COLUMN "thumbnail_url" TEXT;
ALTER TABLE "Course" ADD COLUMN "category" TEXT;
