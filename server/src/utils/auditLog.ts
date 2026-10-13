import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';

/**
 * Record an admin action (who, what, when). Never throws: a logging failure must not
 * undo or block the action itself.
 */
export const logAdminAction = async (
    req: AuthRequest,
    action: string,
    target?: { type: string; id?: string | null },
    details?: Record<string, unknown>,
): Promise<void> => {
    const actorId = req.user?.id;
    if (!actorId) return;
    try {
        await prisma.adminAuditLog.create({
            data: {
                actor_user_id: actorId,
                action,
                target_type: target?.type ?? null,
                target_id: target?.id ?? null,
                details: (details ?? undefined) as Prisma.InputJsonValue | undefined,
                ip: req.ip ?? null,
            },
        });
    } catch (err) {
        console.error('[audit] Failed to record admin action', action, (err as Error).message);
    }
};
