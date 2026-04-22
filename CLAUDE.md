# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Empowered Learnings V2 is a tutoring/mentoring marketplace platform. Students find and book tutors, tutors manage sessions and courses, and admins oversee the platform. The project is split into two separate workspaces: `client/` (React frontend) and `server/` (Node.js backend).

## Development Commands

### Client (React + Vite + TypeScript)
```bash
cd client
npm run dev       # Start dev server (Vite, hot reload)
npm run build     # Type-check + build for production
npm run lint      # ESLint
```

### Server (Express + Prisma + TypeScript)
```bash
cd server
npm run dev       # prisma generate + nodemon src/index.ts
npm run build     # prisma generate + tsc
npm start         # Run compiled dist/index.js
npm run stripe-listen  # Forward Stripe webhooks to localhost:3000
npm run seed:categories  # Seed category data
```

### Database (Prisma)
```bash
cd server
npx prisma migrate dev --name <migration_name>   # Create and apply a migration
npx prisma migrate deploy                         # Apply migrations in production
npx prisma studio                                 # Open Prisma GUI
npx prisma generate                               # Regenerate client after schema changes
```

## Architecture

### Client (`client/src/`)
- **React Router v7** for routing; all routes defined in [App.tsx](client/src/App.tsx)
- **AuthContext** ([context/AuthContext.tsx](client/src/context/AuthContext.tsx)) is the sole auth state manager — stores JWT + user in `localStorage`, exposes `login()`/`logout()`
- **`api/axios.ts`** is a pre-configured Axios instance that auto-injects the JWT `Authorization` header and auto-redirects to `/login` on 401
- **Role-based routing**: `ProtectedRoute` checks auth + subscription status; `DashboardRouter` routes STUDENT vs TUTOR to separate dashboard pages
- Dual page sets exist for tutor-facing (`TutorXxx`) and student-facing (`StudentXxx`) versions of the same flows (e.g. booking, mentor search)
- Styling: Tailwind CSS v3 with `tailwind-merge` + `clsx` for conditional classes
- Animations: Framer Motion

### Server (`server/src/`)
- **Express 5** REST API on port 3000 (default)
- **Prisma ORM** with PostgreSQL — schema at [server/prisma/schema.prisma](server/prisma/schema.prisma)
- Route → Controller pattern: each domain has a `routes/xRoutes.ts` and `controllers/xController.ts`
- **Auth**: JWT via `authenticateToken` middleware ([middleware/authMiddleware.ts](server/src/middleware/authMiddleware.ts)); every JWT validation also does a DB lookup to check suspension. `optionalAuth` is available for public-but-auth-aware endpoints
- **Stripe webhooks** must be mounted before `express.json()` (raw body required) — see top of [index.ts](server/src/index.ts)
- **Email**: `EmailService` ([services/emailService.ts](server/src/services/emailService.ts)) uses Nodemailer + Handlebars templates in `src/templates/`. Emails go through an outbox (`EmailOutbox` model) processed by `emailOutboxProcessor.ts` — never call `transporter.sendMail` directly outside the service
- **Background services**: `startEmailOutboxProcessor()` and `startEmailScheduler()` are started at boot in `index.ts`
- **Google Calendar** integration for demo bookings requires `GOOGLE_DEMO_REFRESH_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — server will refuse to start without them
- Static file uploads served from `uploads/` directory at `/uploads`

### Key Domain Models (Prisma)
- `User` — base auth record with `Role` (STUDENT | TUTOR | ADMIN)
- `StudentProfile` / `TutorProfile` / `AdminProfile` — extend `User` 1:1
- `TutorProfile` has `TutorTier` (STANDARD | PRO | PREMIUM) for subscription gating
- `Booking` → `Lesson` → `PaymentSchedule` — the booking/session lifecycle
- `Subscription` — student subscription records
- `CreditLedger` — credit system for student payments
- `EmailOutbox` — async email queue (all emails go here first)
- `DemoBooking` / `AdminDemoAvailability` — demo call booking system separate from tutor booking
- `BetaApplication` — beta signup flow

### Required Environment Variables (Server)
```
DATABASE_URL
JWT_SECRET
GOOGLE_DEMO_REFRESH_TOKEN
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SMTP_USER
SMTP_PASSWORD
SMTP_FROM_NAME       # optional, defaults to "Empowered Learnings"
CLIENT_URL           # frontend base URL for email links
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

### Client Environment
```
VITE_API_URL    # defaults to http://localhost:3000/api
```
