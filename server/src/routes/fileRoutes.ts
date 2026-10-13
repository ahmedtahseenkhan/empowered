import { Router } from 'express';
import { authenticateAnySession } from '../middleware/authMiddleware';
import { servePrivateFile } from '../controllers/uploadController';
import { rateLimit, byUser } from '../middleware/rateLimiter';

const router = Router();

const downloadLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 300, keyGenerator: byUser });

// Private uploads (session-note documents, payout proofs). Opened by plain browser
// navigation, so either the main-site or the admin session cookie is accepted.
router.get('/:name', authenticateAnySession, downloadLimiter, servePrivateFile);

export default router;
