Now we move to mentor dashboard
we need to implement Calendar & Notification System Flow





Step 1: Google OAuth Setup
typescript
// Google API Configuration
const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/meetings.space.created'
  ]
};

// Required Google APIs:
// 1. Google Calendar API - for calendar events
// 2. Google Meet API - for creating meeting links
// 3. Google OAuth 2.0 - for authentication
Step 2: Mentor Calendar Connection Flow
text
1. Mentor clicks "Connect Google Calendar" in dashboard
2. Redirect to Google OAuth consent screen
3. Mentor grants permissions
4. Redirect back to platform with auth code
5. Exchange code for access/refresh tokens
6. Store encrypted tokens in database
7. Fetch mentor's existing busy slots from Google Calendar
8. Sync with platform's availability system



Step 3: Availability Management

// Mentor sets availability (Weekly repeating pattern)
// System combines:
// 1. Mentor's manual availability settings
// 2. Google Calendar busy slots
// 3. Already booked sessions in platform


Step 4: Booking Flow with Google Meet
text
STUDENT BOOKING JOURNEY:
1. Student selects mentor and clicks "Book Session"
2. System shows available slots (filtered by:
   - Mentor's weekly availability
   - Google Calendar busy times
   - Already booked sessions
   - Timezone conversion)
3. Student selects frequency (Once/Twice/Thrice weekly)
4. Student selects specific time slots for each weekly session
5. System validates all slots are available for next 4 weeks
6. Student proceeds to payment (if not free trial)

SYSTEM CREATES:
1. Stripe subscription for weekly payments
2. Google Meet links for each session (unique per session)
3. Google Calendar events for each session
4. Platform booking records
Step 5: Google Meet Link Generation


Part 2: Complete Notification System
Email Types Required:
text
1. Booking Confirmations (Student/Mentor/Admin)
2. 24-Hour Reminders (Student/Mentor)
3. Payment Receipts/Invoices
4. Free Trial Bookings
5. Demo Call Scheduling
6. Mentor Onboarding
7. Profile Verification Status
8. Review Requests
9. Support Ticket Updates
10. Subscription Updates
Notification Flow Diagram:
text
┌─────────────────────────────────────────────────────────┐
│                    Booking Created                       │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Student Email│   │  Mentor Email │   │   Admin Email │
│  - Confirmation│   │  - New Booking │   │  - New Booking│
│  - Meet Link   │   │  - Meet Link   │   │  - Dashboard  │
│  - Calendar ICS│   │  - Calendar ICS│   │  - Analytics  │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│              Schedule 24-Hour Reminder                  │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│Student Reminder│   │Mentor Reminder│   │Session Starting│
│- Tomorrow's    │   │- Prepare      │   │- Live in 10min│
│  session       │   │  materials    │   │- Join Link    │
└───────────────┘   └───────────────┘   └───────────────┘
Email Template System:
typescript
// Email Template Configuration
const emailTemplates = {
  STUDENT_BOOKING_CONFIRMATION: {
    subject: '✅ Your session with {mentorName} is confirmed!',
    template: 'student-booking-confirmation.html',
    variables: ['studentName', 'mentorName', 'meetLink', 'dateTime', 'subject', 'frequency'],
    attachments: ['calendar.ics']
  },
  
  MENTOR_NEW_BOOKING: {
    subject: '📅 New session booked with {studentName}',
    template: 'mentor-new-booking.html',
    variables: ['mentorName', 'studentName', 'meetLink', 'dateTime', 'subject', 'goals'],
    attachments: ['calendar.ics']
  },
  
  SESSION_REMINDER_24H: {
    subject: '⏰ Reminder: Session tomorrow with {name}',
    template: 'session-reminder.html',
    variables: ['name', 'meetLink', 'dateTime', 'preparationTips'],
    schedule: '24 hours before session'
  },
  
  PAYMENT_RECEIPT: {
    subject: '🧾 Payment receipt for your {frequency} sessions',
    template: 'payment-receipt.html',
    variables: ['amount', 'date', 'frequency', 'nextBillingDate'],
    attachments: ['invoice.pdf']
  }
};

// ICS Calendar File Generator
function generateICSFile(booking) {
  return `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EmpowerEd Learnings//Tutoring Platform//EN
BEGIN:VEVENT
UID:${booking.id}@empoweredlearnings.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${formatDateForICS(booking.startTime)}
DTEND:${formatDateForICS(booking.endTime)}
SUMMARY:Tutoring Session with ${booking.mentorName}
DESCRIPTION:Subject: ${booking.subject}\\nMeeting Link: ${booking.meetLink}
LOCATION:${booking.meetLink}
ORGANIZER;CN=${booking.mentorName}:mailto:${booking.mentorEmail}
ATTENDEE;CN=${booking.studentName};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${booking.studentEmail}
END:VEVENT
END:VCALENDAR
  `.trim();
}
Part 3: Database Schema for Calendar & Notifications
prisma
// Prisma Schema Extensions
model MentorCalendar {
  id              String    @id @default(cuid())
  mentorId        String    @unique
  mentor          Mentor    @relation(fields: [mentorId], references: [id])
  
  // Google Integration
  googleCalendarId String?
  googleAccessToken String? @encrypted
  googleRefreshToken String? @encrypted
  tokenExpiry      DateTime?
  
  // Availability Settings
  weeklySchedule   Json      // Stored as JSON array
  timezone         String    @default("UTC")
  bufferMinutes    Int       @default(15)
  
  // Sync Status
  lastSynced       DateTime?
  syncEnabled      Boolean   @default(true)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Booking {
  id              String    @id @default(cuid())
  
  // Relationships
  studentId       String
  student         Student   @relation(fields: [studentId], references: [id])
  mentorId        String
  mentor          Mentor    @relation(fields: [mentorId], references: [id])
  
  // Session Details
  type            BookingType @default(REGULAR) // REGULAR, TRIAL
  frequency       Frequency @default(ONCE_WEEKLY) // ONCE_WEEKLY, TWICE_WEEKLY, THRICE_WEEKLY
  subject         String
  goals           String[]   // Array of goals
  
  // Recurring Pattern
  isRecurring     Boolean   @default(true)
  recurrenceRule  String?   // RRULE string for complex recurrence
  startDate       DateTime
  endDate         DateTime? // Null for ongoing
  
  // Google Integration
  googleEventId   String?   @unique
  googleMeetLink  String?
  calendarLink    String?
  
  // Status & Tracking
  status          BookingStatus @default(CONFIRMED)
  paymentStatus   PaymentStatus @default(PENDING)
  
  // Individual Sessions (for recurring bookings)
  sessions        Session[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Session {
  id              String    @id @default(cuid())
  bookingId       String
  booking         Booking   @relation(fields: [bookingId], references: [id])
  
  // Session Timing
  scheduledStart  DateTime
  scheduledEnd    DateTime
  actualStart     DateTime?
  actualEnd       DateTime?
  
  // Meeting Details
  meetLink        String
  recordingLink   String?   // If recorded with consent
  
  // Status
  status          SessionStatus @default(SCHEDULED)
  attended        Boolean   @default(false)
  
  // Notifications
  reminderSent24h Boolean   @default(false)
  reminderSent1h  Boolean   @default(false)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([scheduledStart])
  @@index([bookingId, status])
}

model EmailNotification {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  
  type            EmailType
  template        String
  variables       Json      // Stored as JSON object
  
  // Status
  status          EmailStatus @default(PENDING)
  sentAt          DateTime?
  openedAt        DateTime?
  clickedAt       DateTime?
  
  // Content
  subject         String
  bodyHtml        String?
  bodyText        String?
  
  // Attachments
  icsFile         String?   // Path to ICS file
  pdfInvoice      String?   // Path to invoice
  
  errorMessage    String?
  retryCount      Int       @default(0)
  
  scheduledFor    DateTime? // For future emails
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([status, scheduledFor])
  @@index([userId, type])
}
Part 4: Cron Jobs & Scheduled Tasks