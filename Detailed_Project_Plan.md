# Empowered Learning System - Project Plan

**Status**: Draft
**Version**: 1.0
**Date**: 2025-12-25

## Executive Summary
This document outlines the development roadmap for the **Empowered Learning System**, a tutoring and course marketplace. The plan is based on the client's requirements and adapts to the existing PERN stack (PostgreSQL, Express, React, Node.js) codebase. The goal is to deliver a scalable, secure, and feature-rich platform.

## Technology Stack
- **Frontend**: React (Vite), TailwindCSS, Framer Motion, Lucide Icons.
- **Backend**: Node.js, Express, TypeScript.
- **Database**: PostgreSQL with Prisma ORM.
- **Authentication**: JWT (Access/Refresh Tokens), Zod Validation, Bcrypt.
- **Payments**: Stripe Connect.
- **Storage**: AWS S3 (implied for images/video) or similar.

---

## Phased Development API

### Phase 1: Foundation & Authentication (Current Focus)
**Goal**: Secure user access and complete profile management.
- [ ] **Database Schema Finalization (Urgent)**:
    - [ ] Extend User model (Roles).
    - [ ] Create/Update `MentorProfile` (Subscription tiers).
    - [ ] Update `StudentProfile` (Learning preferences).
    - [ ] Create `Booking` model (Recurring patterns).
    - [ ] Create `PaymentSchedule` (Weekly billing).
    - [ ] Verify Category/Subcategory taxonomy.
    - [ ] Review system updates.
- [x] **Database Schema**: Core models (User, Profile, Course, Lesson) are defined in Prisma.
- [x] **Basic Auth**: Login/Register endpoints and pages.
- [ ] **Advanced Auth**:
    - [ ] Implement Refresh Token rotation.
    - [ ] Email Verification Flow (Backend + Frontend UI).
    - [ ] Password Reset Flow.
- [ ] **Profile Wizards**:
    - [ ] **Student Onboarding**: Goals, Preferences.
    - [ ] **Tutor Registration Flow (5 Steps)**:
        - [ ] Step 1: Basic Info (Name, Email, Password).
        - [ ] Step 2: Email Verification.
        - [ ] Step 3: Terms & Conditions.
        - [ ] Step 4: Subscription Plan Selection.
        - [ ] Step 5: Stripe Payment Setup.
    - [ ] **Tutor Profile Creation (3 Sections)**:
        - [ ] **Category Selection**: Main (Academic/Skill/Life), Subcategories, Expertise Areas.
        - [ ] **Professional Details**: Education, Certifications (with upload), Experience, Teaching Philosophy, Video Intro.
        - [ ] **Service Configuration**: Hourly Rates, Free Trials, Session Types (1:1/Group/Course), Availability Calendar, Booking Rules.
    - [ ] File Uploads (Profile Photos, Certifications, Video).

### Phase 2: Marketplace Discovery (Read-Heavy)
**Goal**: Allow students to find tutors and courses.
- [ ] **Landing Page & Matching**:
    - [ ] **Smart Questionnaire**:
        - [ ] Goal Selection (Academic/Skill/Personal Growth).
        - [ ] Assessment Logic (Dynamic questions based on goal).
        - [ ] Data Capture: Age, Grade, Frequency Order, Budget.
    - [ ] **Mentor Matching Algorithm**:
        - [ ] Filtering: Category, Expertise, Availability, Timezone.
        - [ ] Check filtering logic (Rating, Verification).
        - [ ] "Featured" Mentors display.
        - [ ] Free Trial Availability indicator.
- [ ] **Public Profiles**:
    - [ ] Tutor Profile Page (Bio, Rates, Video Intro, Reviews).
    - [ ] Course Landing Pages (Curriculum, Preview).
- [ ] **Homepage**:
    - [ ] Featured Tutors/Courses.
    - [ ] "How It Works" sections (Dynamic content).

### Phase 3: Core Learning Product (Write-Heavy)
**Goal**: Enable the creation and consumption of educational content.
- [ ] **Course Management (Tutors)**:
    - [ ] Course Creation Wizard.
    - [ ] Video Upload & Transcoding (Integration service needed).
    - [ ] Curriculum Builder (Sections/Lessons).
- [ ] **Student Dashboard**:
    - [ ] "My Mentors" section with progress tracking.
    - [ ] Calendar view of scheduled sessions.
    - [ ] Payment management (stop/cancel).
    - [ ] Course Library access.
    - [ ] Notes from Mentors.
    - [ ] Review submission.
- [ ] **Learning Interface**:
    - [ ] Video Player with progress tracking.
    - [ ] Note-taking system.
    - [ ] Resource downloads.

### Phase 4: Scheduling & Booking
**Goal**: Facilitate live sessions.
- [ ] **Booking System**:
    - [ ] **Free Trial Booking**:
        - [ ] Slot selection (no payment).
        - [ ] Email confirmations (Student/Mentor/Admin).
        - [ ] Calendar Integration.
    - [ ] **Regular Session Booking**:
        - [ ] Frequency Selection (1x/2x/3x weekly).
        - [ ] Recurring Time Slot selection.
        - [ ] Auto-schedule logic (1 month / 4-12 sessions).
        - [ ] Payment Summary & Checkout.
- [ ] **Scheduling & Calendar**:
    - [ ] **Calendar Management**:
        - [ ] Timezone handling.
        - [ ] Weekly recurring availability.
        - [ ] Blackout dates/times.
        - [ ] Google Calendar Sync (Optional).
    - [ ] **Session Management**:
        - [ ] Virtual Classroom Links (Zoom/Meet integration).
        - [ ] "Join Session" Button.
        - [ ] Attendance Tracking.
        - [ ] Post-session feedback prompts.

### Phase 5: Communication & Interaction
**Goal**: Build trust and community.
- [ ] **Communication System**:
    - [ ] **Internal Messaging**:
        - [ ] Student-Mentor Direct Messaging.
        - [ ] File Sharing (Assignments, Resources).
        - [ ] Message Notifications.
        - [ ] Email Fallback.
    - [ ] **Progress Tracking (Mentor Tools)**:
        - [ ] Session Notes/Feedback.
        - [ ] Progress Markers (Excellent/Good/Needs Improvement).
        - [ ] Assignment Tracking.
        - [ ] Performance Analytics.
- [ ] **Reviews & Ratings**:
    - [ ] Post-lesson/course review system.
    - [ ] Dispute/Report mechanism.

### Phase 6: Financials & Administration
**Goal**: Monetization and platform control.
- [ ] **Stripe Connect Integration**:
    - [ ] Tutor Onboarding (Split payments).
    - [ ] Checkout Sessions (One-time & Subscriptions).
    - [ ] Webhook handling for reliable payment status.
- [ ] **Admin Dashboard & Verification**:
    - [ ] **Verification System**:
        - [ ] Application Queue.
        - [ ] Certificate Review Interface.
        - [ ] Profile Approval/Rejection Workflow.
        - [ ] "Verified" Badge Assignment.
        - [ ] Email Notifications.
    - [ ] User Management.
    - [ ] Financial Reports.
    - [ ] Content Moderation.

---

## Immediate Next Steps (Action Items)
1. **Refine Auth**: Complete the Email Verification and Password Reset flows.
2. **Profile Completion**: Build the multi-step Tutor Registration Wizard (crucial for supply side).
3. **Data Seeding**: Create realistic seed data for Tutors and Courses to facilitate frontend development.
