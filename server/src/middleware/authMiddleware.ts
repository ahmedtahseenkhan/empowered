import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.status(401).json({ error: 'Access token required' });

    try {
        const secret = process.env.JWT_SECRET || 'supersecret';
        const decoded = jwt.verify(token, secret) as { id: string, role: string };

        prisma.user
            .findUnique({ where: { id: decoded.id }, select: { id: true, role: true, is_suspended: true } })
            .then((user) => {
                if (!user) return res.status(401).json({ error: 'Unauthorized' });
                if (user.is_suspended) return res.status(403).json({ error: 'Account is suspended' });

                req.user = { id: user.id, role: user.role };
                return next();
            })
            .catch((err) => {
                console.error('Auth DB Lookup Error:', err);
                return res.status(500).json({ error: 'Server error' });
            });
    } catch (error) {
        console.error('JWT Verification Error:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};
