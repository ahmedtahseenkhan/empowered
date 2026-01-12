-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'TUTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('PENDING', 'BOOKED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "profile_photo" TEXT,
    "learning_goals" TEXT,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorProfile" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "tagline" TEXT,
    "about" TEXT,
    "hourly_rate" INTEGER NOT NULL DEFAULT 0,
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "video_url" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "total_students" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TutorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorEducation" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "field_of_study" TEXT NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "TutorEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorExperience" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "start_year" INTEGER NOT NULL,
    "end_year" INTEGER,
    "description" TEXT,

    CONSTRAINT "TutorExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorCertification" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "image_url" TEXT,

    CONSTRAINT "TutorCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorLanguage" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "proficiency" TEXT NOT NULL,

    CONSTRAINT "TutorLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorCategory" (
    "tutor_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,

    CONSTRAINT "TutorCategory_pkey" PRIMARY KEY ("tutor_id","category_id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'PENDING',
    "meeting_link" TEXT,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "total_hours" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "student_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("student_id","course_id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "lesson_id" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "stripe_sub_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lessons_per_week" INTEGER NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentTutorStatus" (
    "student_id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "has_taken_trial" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,

    CONSTRAINT "StudentTutorStatus_pkey" PRIMARY KEY ("student_id","tutor_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_user_id_key" ON "StudentProfile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "TutorProfile_user_id_key" ON "TutorProfile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Review_lesson_id_key" ON "Review"("lesson_id");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorProfile" ADD CONSTRAINT "TutorProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorEducation" ADD CONSTRAINT "TutorEducation_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorExperience" ADD CONSTRAINT "TutorExperience_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorCertification" ADD CONSTRAINT "TutorCertification_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorLanguage" ADD CONSTRAINT "TutorLanguage_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorCategory" ADD CONSTRAINT "TutorCategory_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorCategory" ADD CONSTRAINT "TutorCategory_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTutorStatus" ADD CONSTRAINT "StudentTutorStatus_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTutorStatus" ADD CONSTRAINT "StudentTutorStatus_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "TutorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
