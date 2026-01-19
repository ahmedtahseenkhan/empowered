import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
    studentCreateNote,
    studentGetTutorTimeline,
    studentSubmitHomework,
    tutorCreateNote,
    tutorCreateTask,
    tutorGetActivityFeed,
    tutorGetStudentTimeline,
    tutorUpdateTaskStatus,
} from '../controllers/progressController';

const router = Router();

router.get('/tutor/activity', authenticateToken, tutorGetActivityFeed);
router.get('/tutor/students/:studentId/timeline', authenticateToken, tutorGetStudentTimeline);
router.post('/tutor/students/:studentId/notes', authenticateToken, tutorCreateNote);
router.post('/tutor/students/:studentId/tasks', authenticateToken, tutorCreateTask);
router.patch('/tutor/tasks/:taskId/status', authenticateToken, tutorUpdateTaskStatus);

router.get('/student/tutors/:tutorId/timeline', authenticateToken, studentGetTutorTimeline);
router.post('/student/tutors/:tutorId/notes', authenticateToken, studentCreateNote);
router.post('/student/tasks/:taskId/submissions', authenticateToken, studentSubmitHomework);

export default router;
