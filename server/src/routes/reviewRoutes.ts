import express from 'express';
import { createReview, getReviewsByTutorId } from '../controllers/reviewController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/', authenticateToken, createReview);
router.get('/tutor/:tutorId', getReviewsByTutorId);

export default router;
