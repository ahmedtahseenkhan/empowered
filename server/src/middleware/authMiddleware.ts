import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { generateToken, verifyAccessToken, AccessTokenPayload, SESSION_ABSOLUTE_TTL_SECONDS, TOKEN_RENEW_AFTER_SECONDS } from '../utils/auth';
import { getAppClient, getTokenFromRequest, getAllTokensFromCookieHeader, setAuthCookie, clearAuthCookie } from '../utils/authCookie';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
    };
}

type SessionUser = { id: string; role: string };

/**
 * Validate a token against the database: the user must exist, not be suspended, the session must
 * not have been logged out, and the token must carry the current token_version (bumped on
 * password changes and suspensions to end every session).
 */
const resolveSession = async (decoded: AccessTokenPayload): Promise<{ user: SessionUser | null; suspended: boolean; tokenVersion: number }> => {
    const [user, revoked] = await Promise.all([
        prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, role: true, is_suspended: true, token_version: true },
        }),
        prisma.revokedSession.findUnique({ where: { sid: decoded.sid }, select: { sid: true } }),
    ]);
    if (!user || revoked || user.token_version !== decoded.tv) return { user: null, suspended: false, tokenVersion: 0 };
    if (user.is_suspended) return { user: null, suspended: true, tokenVersion: user.token_version };
    return { user: { id: user.id, role: user.role }, suspended: false, tokenVersion: user.token_version };
};

/** Sliding session: re-issue the cookie for active users until the absolute session limit. */
const maybeRenew = (req: Request, res: Response, decoded: AccessTokenPayload, user: SessionUser, tokenVersion: number) => {
    const now = Math.floor(Date.now() / 1000);
    if (now - decoded.iat < TOKEN_RENEW_AFTER_SECONDS) return;
    if (now - decoded.auth_time > SESSION_ABSOLUTE_TTL_SECONDS) return;
    setAuthCookie(res, getAppClient(req), generateToken(user.id, user.role, tokenVersion, { authTime: decoded.auth_time, sid: decoded.sid }));
};

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: 'Access token required' });

    const decoded = verifyAccessToken(token);
    if (!decoded) {
        clearAuthCookie(res, getAppClient(req));
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    resolveSession(decoded)
        .then(({ user, suspended, tokenVersion }) => {
            if (suspended) return res.status(403).json({ error: 'Account is suspended' });
            if (!user) {
                clearAuthCookie(res, getAppClient(req));
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
            req.user = user;
            maybeRenew(req, res, decoded, user, tokenVersion);
            return next();
        })
        .catch((err) => {
            console.error('Auth DB Lookup Error:', err);
            return res.status(500).json({ error: 'Server error' });
        });
};

/**
 * For plain browser navigations (e.g. opening a private file in a new tab) where the
 * X-App-Client header can't be sent: accept a valid session from either cookie.
 */
export const authenticateAnySession = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        for (const token of getAllTokensFromCookieHeader(req.headers.cookie)) {
            const decoded = verifyAccessToken(token);
            if (!decoded) continue;
            const { user } = await resolveSession(decoded);
            if (user) {
                req.user = user;
                return next();
            }
        }
        return res.status(401).json({ error: 'Access token required' });
    } catch (err) {
        console.error('Auth DB Lookup Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Restrict a route to the given roles. Use after authenticateToken; returns 403
 * (not 404) when a signed-in user of another role calls it.
 */
export const requireRole = (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have access to this resource' });
    return next();
};

/** Same as authenticateToken but does not 401 when no token; req.user is set only when valid token present. */
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = getTokenFromRequest(req);
    if (!token) return next();

    const decoded = verifyAccessToken(token);
    if (!decoded) return next();

    resolveSession(decoded)
        .then(({ user }) => {
            if (user) req.user = user;
            next();
        })
        .catch(() => next());
};
