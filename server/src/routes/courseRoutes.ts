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
    purchaseCourse
} from '../controllers/courseController';

const router = Router();

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

// Public routes
router.get('/:id', getCourseById);

export default router;
