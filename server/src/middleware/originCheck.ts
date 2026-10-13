import { Request, Response, NextFunction } from 'express';
import { isOriginAllowed } from '../config/origins';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated requests: state-changing requests sent by a browser
 * must come from an allowed origin (or this API's own origin). Works alongside SameSite=Lax.
 */
export const requireTrustedOrigin = (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.headers.origin;
    if (!origin) return next(); // non-browser clients; browsers always send Origin on cross-site POSTs

    if (isOriginAllowed(origin)) return next();

    try {
        const host = req.get('host');
        if (host && new URL(origin).host === host) return next();
    } catch {
        // malformed Origin header falls through to the rejection
    }
    return res.status(403).json({ error: 'Request origin not allowed' });
};
