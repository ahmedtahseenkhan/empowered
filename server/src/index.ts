import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { allowedOrigins, isOriginAllowed } from './config/origins';
import { requireTrustedOrigin } from './middleware/originCheck';

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

// Production refuses to start without a JWT secret, and warns loudly about weak secrets
if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET) {
        console.error('[Startup] JWT_SECRET is required in production. Add it to .env and restart.');
        process.exit(1);
    }
    if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('dev-only')) {
        console.error('[Startup] WARNING: JWT_SECRET is weak — set 32+ random characters (openssl rand -hex 48).');
    }
    if (!process.env.TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY.startsWith('dev-only')) {
        console.error('[Startup] WARNING: TOKEN_ENCRYPTION_KEY is missing or a dev value — Google tokens and payout details cannot be stored safely.');
    }
}
if (!process.env.JWT_SECRET) {
    console.warn('[Startup] JWT_SECRET is not set — using a random per-process secret (sessions reset on restart).');
}

const app = express();
const PORT = process.env.PORT || 3000;

import authRoutes from './routes/authRoutes';
import tutorRoutes from './routes/tutorRoutes';
import courseRoutes from './routes/courseRoutes';
import bookingRoutes from './routes/bookingRoutes';
import googleCalendarRoutes from './routes/googleCalendarRoutes';
import availabilityRoutes from './routes/availabilityRoutes';
import lessonRoutes from './routes/lessonRoutes';
import customSessionRoutes from './routes/customSessionRoutes';
import schedulingRoutes from './routes/schedulingRoutes';
import studentRoutes from './routes/studentRoutes';
import reviewRoutes from './routes/reviewRoutes';
import progressRoutes from './routes/progressRoutes';

import uploadRoutes from './routes/uploadRoutes';
import fileRoutes from './routes/fileRoutes';
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
import { logPlatformGoogleStatus } from './services/googleCalendar';
import { initWhiteboardSocket } from './services/whiteboardSocket';

// Security middleware
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
    // API only serves JSON and uploads; images are embedded by the client on another origin
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

if (allowedOrigins.length === 0) {
    console.warn('[Startup] CORS_ORIGINS not set — allowing any origin (development only).');
}
app.use(cors({
    origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-App-Client'],
}));

// Webhooks must be mounted BEFORE express.json() to consume raw body
app.use('/api/stripe', webhookRoutes);

// Cookie-authenticated API: reject state-changing requests from untrusted origins (CSRF)
app.use('/api', requireTrustedOrigin);

// API responses can hold personal data: never let browsers or shared caches store them
app.use('/api', (req, res, next) => {
    if (!req.path.startsWith('/uploads/') && !req.path.startsWith('/files/')) res.setHeader('Cache-Control', 'no-store');
    next();
});

// Routes that accept base64 files (uploads, profile photo, certification proofs, whiteboard
// scenes) get a larger body limit; everything else is capped at 1mb.
const LARGE_BODY_PATHS = ['/api/uploads', '/api/tutor/me/bio', '/api/tutor/me/education', '/api/whiteboards'];
app.use(LARGE_BODY_PATHS, express.json({ limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Serve user uploads defensively: force download instead of inline rendering,
// block MIME sniffing, and neutralize any script if a file is ever opened.
// This protects against malicious content (HTML/SVG/JS) slipping into /uploads.
// Private files live outside this folder (uploads_private/) and are only served by /api/files.
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
app.use('/api/custom-sessions', customSessionRoutes);
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
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/beta', betaRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/whiteboards', whiteboardRoutes);
app.use('/api/wallet', walletRoutes);

// Unknown API routes: JSON, never Express's HTML page
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Last-resort error handler: log the details, never send stack traces or internals to clients
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status >= 500) console.error(`[Unhandled] ${req.method} ${req.originalUrl}:`, err);
    if (res.headersSent) return;
    const message = status === 413 ? 'Request body too large'
        : status === 400 ? 'Malformed request'
        : status < 500 ? 'Request could not be processed'
        : 'Server error';
    res.status(status).json({ error: message });
});

// Health Check
app.get('/', (req, res) => {
    res.send('Empowered Learnings API v2 is running');
});

// Start Server
const httpServer = http.createServer(app);
// Bound slow or stalled requests (slowloris-style abuse)
httpServer.requestTimeout = 60_000;
httpServer.headersTimeout = 20_000;
httpServer.keepAliveTimeout = 5_000;
initWhiteboardSocket(httpServer);

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startEmailOutboxProcessor();
    startEmailScheduler();
    startWalletScheduler();
    void logPlatformGoogleStatus();
});
