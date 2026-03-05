import { Router } from 'express';
import { createTicket } from '../controllers/supportController';
import { optionalAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/', optionalAuth, createTicket);

export default router;
