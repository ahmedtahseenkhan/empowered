import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
    cancelCustomSessionHandler,
    createCustomSessionOffer,
    getCustomSessionRules,
    getMyStudentsForScheduling,
    respondToCustomSessionOffer,
    withdrawCustomSessionOffer,
} from '../controllers/customSessionController';

const router = Router();

router.use(authenticateToken);

router.get('/rules', getCustomSessionRules);
router.get('/students', getMyStudentsForScheduling);
router.post('/', createCustomSessionOffer);
router.post('/:lessonId/respond', respondToCustomSessionOffer);
router.post('/:lessonId/withdraw', withdrawCustomSessionOffer);
router.post('/:lessonId/cancel', cancelCustomSessionHandler);

export default router;
