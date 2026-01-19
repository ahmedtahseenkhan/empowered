import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config();

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

// Middleware
app.use(cors());
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

// Health Check
app.get('/', (req, res) => {
    res.send('Empowered Learnings API v2 is running');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
