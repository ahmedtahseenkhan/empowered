import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
    getMyScheduling,
    setMyTimezone,
    setFreeSessionEnabled,
    replaceFreeSessionAvailability,
    replaceMyWeeklyAvailability,
    createMyTimeBlock,
    updateMyTimeBlock,
    deleteMyTimeBlock,
    listMyTimeBlocks,
} from '../controllers/schedulingController';

const router = Router();

router.get('/me', authenticateToken, getMyScheduling);
router.put('/me/timezone', authenticateToken, setMyTimezone);
router.put('/me/free-session-enabled', authenticateToken, setFreeSessionEnabled);
router.put('/me/free-session-availability', authenticateToken, replaceFreeSessionAvailability);
router.put('/me/availability', authenticateToken, replaceMyWeeklyAvailability);

router.get('/me/blocks', authenticateToken, listMyTimeBlocks);
router.post('/me/blocks', authenticateToken, createMyTimeBlock);
router.put('/me/blocks/:id', authenticateToken, updateMyTimeBlock);
router.delete('/me/blocks/:id', authenticateToken, deleteMyTimeBlock);

export default router;
