import { Router } from 'express';
import { submitBetaApplication } from '../controllers/betaController';

const router = Router();

router.post('/', submitBetaApplication);

export default router;
