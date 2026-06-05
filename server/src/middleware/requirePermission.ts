import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import prisma from '../config/db';

// Gate an admin route to admins who hold ANY of the given module permissions.
// A super admin always passes. Must run AFTER requireAdmin (role already checked).
export const requirePermission = (...keys: string[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const profile = await prisma.adminProfile.findUnique({
            where: { user_id: userId },
            select: { is_super_admin: true, permissions: true },
        });

        if (!profile) return res.status(403).json({ error: 'Admin access required' });
        if (profile.is_super_admin) return next();

        const allowed = keys.some((k) => profile.permissions.includes(k));
        if (!allowed) return res.status(403).json({ error: 'You do not have permission to access this resource' });

        return next();
    };
};

// Gate a route to super admins only (e.g. managing sub-admins).
export const requireSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const profile = await prisma.adminProfile.findUnique({
        where: { user_id: userId },
        select: { is_super_admin: true },
    });

    if (!profile?.is_super_admin) return res.status(403).json({ error: 'Super admin access required' });
    return next();
};
