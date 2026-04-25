"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load env vars
dotenv_1.default.config();
// Fail fast if demo booking (Google Meet) is not configured
function assertDemoMeetEnv() {
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
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const tutorRoutes_1 = __importDefault(require("./routes/tutorRoutes"));
const courseRoutes_1 = __importDefault(require("./routes/courseRoutes"));
const bookingRoutes_1 = __importDefault(require("./routes/bookingRoutes"));
const googleCalendarRoutes_1 = __importDefault(require("./routes/googleCalendarRoutes"));
const availabilityRoutes_1 = __importDefault(require("./routes/availabilityRoutes"));
const lessonRoutes_1 = __importDefault(require("./routes/lessonRoutes"));
const schedulingRoutes_1 = __importDefault(require("./routes/schedulingRoutes"));
const studentRoutes_1 = __importDefault(require("./routes/studentRoutes"));
const reviewRoutes_1 = __importDefault(require("./routes/reviewRoutes"));
const progressRoutes_1 = __importDefault(require("./routes/progressRoutes"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const demoRoutes_1 = __importDefault(require("./routes/demoRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const webhookRoutes_1 = __importDefault(require("./routes/webhookRoutes"));
const supportRoutes_1 = __importDefault(require("./routes/supportRoutes"));
const betaRoutes_1 = __importDefault(require("./routes/betaRoutes"));
const aiRoutes_1 = __importDefault(require("./routes/aiRoutes"));
const emailOutboxProcessor_1 = require("./services/emailOutboxProcessor");
const emailScheduler_1 = require("./services/emailScheduler");
// Middleware
app.use((0, cors_1.default)());
// Webhooks must be mounted BEFORE express.json() to consume raw body
app.use('/api/stripe', webhookRoutes_1.default);
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.use('/api/auth', authRoutes_1.default);
app.use('/api/tutor', tutorRoutes_1.default);
app.use('/api/courses', courseRoutes_1.default);
app.use('/api/bookings', bookingRoutes_1.default);
app.use('/api/google-calendar', googleCalendarRoutes_1.default);
app.use('/api/availability', availabilityRoutes_1.default);
app.use('/api/lessons', lessonRoutes_1.default);
app.use('/api/scheduling', schedulingRoutes_1.default);
app.use('/api/student', studentRoutes_1.default);
app.use('/api/reviews', reviewRoutes_1.default);
app.use('/api/progress', progressRoutes_1.default);
app.use('/api/uploads', uploadRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/demo', demoRoutes_1.default);
app.use('/api/payments', paymentRoutes_1.default);
app.use('/api/support', supportRoutes_1.default);
app.use('/api/beta', betaRoutes_1.default);
app.use('/api/ai', aiRoutes_1.default);
// Health Check
app.get('/', (req, res) => {
    res.send('Empowered Learnings API v2 is running');
});
// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    (0, emailOutboxProcessor_1.startEmailOutboxProcessor)();
    (0, emailScheduler_1.startEmailScheduler)();
});
