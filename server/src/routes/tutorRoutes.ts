import express from 'express';
import {
    getProfile,
    listPublicTutors,
    getPublicTutorById,
    getMyStudents,
    updateBio,
    updateEducation,
    updateServices,
    updateStudentLevels,
    updatePricing,
    getCategories,
    updateExternalReviews,
    getMarketingVideoSubmission,
    upsertMarketingVideoSubmission
} from '../controllers/tutorController';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware'; // Assuming mock or real middleware

const router = express.Router();

// Public
router.get('/categories', getCategories);
router.get('/public', listPublicTutors);
// optionalAuth: public viewers get the visibility gate; the profile owner and admins
// (identified from their token when present) can always view their own/any profile.
router.get('/public/:id', optionalAuth, getPublicTutorById);

// Protected (Tutor)
router.get('/me', authenticateToken, getProfile);
router.get('/me/students', authenticateToken, getMyStudents);
router.put('/me/bio', authenticateToken, updateBio);
router.put('/me/education', authenticateToken, updateEducation);
router.put('/me/services', authenticateToken, updateServices);
router.put('/me/student-levels', authenticateToken, updateStudentLevels);
router.put('/me/pricing', authenticateToken, updatePricing);
// NOTE: `PUT /me/tier` was removed — it let any logged-in mentor set their own tier
// (PRO/PREMIUM) for free. Tier is now set only by the Stripe webhook (after payment)
// or by activateMentorTrial (approved beta users).
router.put('/me/external-reviews', authenticateToken, updateExternalReviews);
router.get('/me/marketing-video', authenticateToken, getMarketingVideoSubmission);
router.put('/me/marketing-video', authenticateToken, upsertMarketingVideoSubmission);

export default router;
