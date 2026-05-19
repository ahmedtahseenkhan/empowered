import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config();

// Fail fast if demo booking (Google Meet) is not configured
function assertDemoMeetEnv(): void {
    const token = process.env.GOOGLE_DEMO_REFRESH_TOKEN;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!token) {
        console.error('[Startup] GOOGLE_DEMO_REFRESH_TOKEN is required for demo bookings. Add it to .env and restart.');
        process.exit(1);
    }
    if (!clientId || !clientSecret) {
        console.error('[Startup] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for demo Meet creation. Add them to .env and restart.');
        process.exit(1);
    }
}
assertDemoMeetEnv();

const app = express();
const PORT = process.env.PORT || 3000;

import authRoutes from './routes/authRoutes';
import tutorRoutes from './routes/tutorRoutes';
import courseRoutes from './routes/courseRoutes';
import bookingRoutes from './routes/bookingRoutes';
import googleCalendarRoutes from './routes/googleCalendarRoutes';
import availabilityRoutes from './routes/availabilityRoutes';
import lessonRoutes from './routes/lessonRoutes';
import schedulingRoutes from './routes/schedulingRoutes';
import studentRoutes from './routes/studentRoutes';
import reviewRoutes from './routes/reviewRoutes';
import progressRoutes from './routes/progressRoutes';

import uploadRoutes from './routes/uploadRoutes';
import adminRoutes from './routes/adminRoutes';
import demoRoutes from './routes/demoRoutes';
import paymentRoutes from './routes/paymentRoutes';
import webhookRoutes from './routes/webhookRoutes';
import supportRoutes from './routes/supportRoutes';
import betaRoutes from './routes/betaRoutes';
import aiRoutes from './routes/aiRoutes';
import whiteboardRoutes from './routes/whiteboardRoutes';
import { startEmailOutboxProcessor } from './services/emailOutboxProcessor';
import { startEmailScheduler } from './services/emailScheduler';

// Middleware
app.use(cors());

// Webhooks must be mounted BEFORE express.json() to consume raw body
app.use('/api/stripe', webhookRoutes);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/google-calendar', googleCalendarRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/progress', progressRoutes);

app.use('/api/uploads', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/beta', betaRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/whiteboards', whiteboardRoutes);

// Health Check
app.get('/', (req, res) => {
    res.send('Empowered Learnings API v2 is running');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startEmailOutboxProcessor();
    startEmailScheduler();
});
