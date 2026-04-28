# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project Overview
Project: Empowered Learnings V2 - A tutoring/mentoring marketplace platform where students find and book tutors, tutors manage sessions and courses, and admins oversee the platform.
Stack: React + Vite + TypeScript (client), Express + Prisma + TypeScript + PostgreSQL (server), Stripe (payments), Google Calendar (integration), Nodemailer (emails)
Platform: Web application
Status: Active development

# Commands
Dev server:    cd client && npm run dev (client), cd server && npm run dev (server)
Tests:         No test scripts configured
Build:         cd client && npm run build, cd server && npm run build
Lint:          cd client && npm run lint
DB migrate:    cd server && npx prisma migrate dev --name <migration_name>
DB seed:       cd server && npm run seed:categories
Deploy:        Not specified

# Architecture
/client/src
  /api          → Axios configuration and API calls
  /components   → Reusable UI components (common, home, how-it-works, reviews, sessions, student, tutor, tutor-profile, ui)
  /constants    → Constants like mentor search filters
  /context      → AuthContext for authentication state management
  /hooks        → Custom React hooks (useImageOptimization)
  /layouts      → Layout components (DashboardLayout, PageLayout)
  /pages        → Page components for routing (AccountSettingsPage, AnalyticsPage, BetaPage, BookDemoPage, etc.)
  /utils        → Utility functions (cn.ts for class merging)

/server/src
  /controllers  → Route controllers (authController, bookingController, etc.)
  /middleware   → Authentication middleware (authMiddleware)
  /routes       → API route definitions (authRoutes, bookingRoutes, etc.)
  /services     → Business logic services (emailService, paymentService, etc.)
  /templates    → Email templates (Handlebars)
  /types        → TypeScript type definitions
  /utils        → Utility functions

/prisma         → Database schema and migrations
/uploads        → Static file uploads served at /uploads

# Key patterns
- Auth via AuthContext (client) and authenticateToken middleware (server)
- DB access only through Prisma ORM (never direct SQL)
- API responses via controller pattern (routes → controllers)
- Email handling through EmailService and EmailOutbox queue
- Role-based access control (STUDENT, TUTOR, ADMIN)
- JWT authentication with suspension checks
- Stripe webhooks require raw body parsing before JSON middleware
- Google Calendar integration for demo bookings
- Static file serving for uploads

# Code style
Language:   TypeScript
Naming:     camelCase vars/functions, PascalCase components
Functions:  Not specified (varies)
Imports:    Relative imports from file locations
Exports:    Mixed (default and named exports)
Comments:   Minimal, JSDoc on complex functions
Error handling: try/catch blocks, proper error responses

# Known issues / warnings
- Stripe webhooks MUST be mounted before express.json() (raw body required)
- Google Calendar integration requires GOOGLE_DEMO_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- JWT validation includes DB lookup to check user suspension
- Email sending goes through EmailOutbox — never call transporter.sendMail directly
- Static uploads served from /uploads directory
- Role-based routing with ProtectedRoute and DashboardRouter
- Dual page sets for tutor-facing (TutorXxx) and student-facing (StudentXxx) flows

# Testing
Framework: Not configured
Coverage:  Not specified
Test files: None present
Mocking:   Not specified
Run before PR: cd client && npm run lint

# Claude behavior
- Be concise. Skip preamble like "Sure!" or "Great question!"
- Write complete code. No placeholders like "// rest of code here"
- Don't repeat code I already showed you in this session
- No explanations unless I ask "explain this"
- When fixing a bug, show only the changed function, not the whole file
- If you're unsure, say so. Don't guess silently.
- Ask ONE clarifying question max if something is ambiguous

# Current task
Working on: Session management UI improvements and error handling
Status: Implemented modal error popups and JOIN button logic for completed sessions
Next step: Further UI/UX refinements and feature additions
Blocked by: None

# Recent decisions
- Split project into separate client/ and server/ workspaces
- Use React Router v7 for client-side routing
- AuthContext for centralized authentication state
- Prisma ORM with PostgreSQL for database
- Stripe integration for payment processing
- Google Calendar API for demo booking integration
- Email outbox system for reliable email delivery
- Tailwind CSS with tailwind-merge and clsx for styling
- Framer Motion for animations
- Modal component for error popups instead of inline alerts
