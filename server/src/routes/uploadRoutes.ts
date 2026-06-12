import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { uploadBase64File, uploadBase64Image } from '../controllers/uploadController';

const router = Router();

router.post('/base64', authenticateToken, uploadBase64File);
router.post('/image', authenticateToken, uploadBase64Image);

export default router;
