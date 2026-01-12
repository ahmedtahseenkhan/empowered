import express from 'express';
import {
    getProfile,
    listPublicTutors,
    getPublicTutorById,
    getMyStudents,
    updateBio,
    updateEducation,
    updateServices,
    updatePricing,
    getCategories,
    updateExternalReviews,
    updateTier
} from '../controllers/tutorController';
import { authenticateToken } from '../middleware/authMiddleware'; // Assuming mock or real middleware

const router = express.Router();

// Public
router.get('/categories', getCategories);
router.get('/public', listPublicTutors);
router.get('/public/:id', getPublicTutorById);

// Protected (Tutor)
router.get('/me', authenticateToken, getProfile);
router.get('/me/students', authenticateToken, getMyStudents);
router.put('/me/bio', authenticateToken, updateBio);
router.put('/me/education', authenticateToken, updateEducation);
router.put('/me/services', authenticateToken, updateServices);
router.put('/me/pricing', authenticateToken, updatePricing);
router.put('/me/tier', authenticateToken, updateTier);
router.put('/me/external-reviews', authenticateToken, updateExternalReviews);

export default router;
