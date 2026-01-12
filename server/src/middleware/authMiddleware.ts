import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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
        req.user = decoded;
        next();
    } catch (error) {
        console.error('JWT Verification Error:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};
