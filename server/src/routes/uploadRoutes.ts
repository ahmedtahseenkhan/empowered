import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { uploadBase64File } from '../controllers/uploadController';

const router = Router();

router.post('/base64', authenticateToken, uploadBase64File);

export default router;
