import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
    getMyCourses,
    getCourseById,
    createCourse,
    updateCourse,
    deleteCourse,
    toggleCourseStatus,
    getCourseSalesStats,
    getStudentCourses,
    purchaseCourse,
    getMarketplaceCourses,
    createCourseCheckout,
    getPublicTutorCourses,
} from '../controllers/courseController';

const router = Router();

// Public routes (no auth needed — must come before /:id to avoid conflicts)
router.get('/marketplace', getMarketplaceCourses);
router.get('/tutor/:tutorId/public', getPublicTutorCourses);

// Tutor routes (requires authentication)
router.get('/my-courses', authenticateToken, getMyCourses);
router.get('/sales-stats', authenticateToken, getCourseSalesStats);
router.post('/', authenticateToken, createCourse);
router.put('/:id', authenticateToken, updateCourse);
router.delete('/:id', authenticateToken, deleteCourse);
router.patch('/:id/status', authenticateToken, toggleCourseStatus);

// Student routes
router.get('/student/purchased', authenticateToken, getStudentCourses);
router.post('/:id/purchase', authenticateToken, purchaseCourse);
router.post('/:id/checkout', authenticateToken, createCourseCheckout);

// Public course detail (must be last to avoid catching named segments)
router.get('/:id', getCourseById);

export default router;
