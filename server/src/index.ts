import express from 'express';
import http from 'http';
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
import walletRoutes from './routes/walletRoutes';
import { startEmailOutboxProcessor } from './services/emailOutboxProcessor';
import { startEmailScheduler } from './services/emailScheduler';
import { startWalletScheduler } from './services/walletScheduler';
import { initWhiteboardSocket } from './services/whiteboardSocket';

// Middleware
app.use(cors());

// Webhooks must be mounted BEFORE express.json() to consume raw body
app.use('/api/stripe', webhookRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve user uploads defensively: force download instead of inline rendering,
// block MIME sniffing, and neutralize any script if a file is ever opened.
// This protects against malicious content (HTML/SVG/JS) slipping into /uploads.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('Content-Security-Policy', "default-src 'none'");
    },
}));

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
// Also serve uploaded files under the /api prefix so they're reachable through the
// same proxy path as the API (a bare /uploads path is often not proxied to the
// backend). The router above only handles POST routes; GETs fall through to here.
// Images are served inline (validated by magic bytes on upload) so <img> renders.
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads'), {
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Content-Security-Policy', "default-src 'none'");
    },
}));
app.use('/api/admin', adminRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/beta', betaRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/whiteboards', whiteboardRoutes);
app.use('/api/wallet', walletRoutes);

// Health Check
app.get('/', (req, res) => {
    res.send('Empowered Learnings API v2 is running');
});

// Start Server
const httpServer = http.createServer(app);
initWhiteboardSocket(httpServer);

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startEmailOutboxProcessor();
    startEmailScheduler();
    startWalletScheduler();
});
