import { Request, Response, NextFunction } from 'express';

/**
 * Lightweight in-memory rate limiter (no external dependency).
 *
 * Fixed-window counter keyed by client IP by default, or by any key (e.g. the target email
 * address) via `keyGenerator`. State is per-process and resets on restart — adequate for a
 * single-server setup. For multi-instance deployments, back this with a shared store (Redis).
 */

interface WindowEntry {
    count: number;
    resetAt: number;
}

interface RateLimitOptions {
    windowMs: number;
    max: number;
    message?: string;
    /** Return null to skip limiting for this request (e.g. no email in the body). */
    keyGenerator?: (req: Request) => string | null;
}

const clientIp = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown';

export function rateLimit(options: RateLimitOptions) {
    const { windowMs, max, message = 'Too many requests. Please try again later.', keyGenerator } = options;
    const hits = new Map<string, WindowEntry>();

    // Periodically drop expired entries so the map doesn't grow unbounded.
    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }, windowMs);
    cleanup.unref?.();

    return (req: Request, res: Response, next: NextFunction) => {
        // req.ip honours `trust proxy` (set in index.ts); a raw X-Forwarded-For
        // header is client-controlled and would let callers bypass the limit.
        const key = keyGenerator ? keyGenerator(req) : clientIp(req);
        if (key === null) return next();

        const now = Date.now();
        const entry = hits.get(key);

        if (!entry || entry.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        entry.count += 1;
        if (entry.count > max) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({ error: message });
        }

        return next();
    };
}

/** Key a limiter by the email address in the request body (normalised), so one inbox can't be flooded from many IPs. */
export const byBodyEmail = (req: Request): string | null => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === 'string' && email.trim() ? `email:${email.trim().toLowerCase()}` : null;
};

/** Key a limiter by the signed-in user (falls back to IP). Use after authenticateToken. */
export const byUser = (req: Request): string => {
    const id = (req as Request & { user?: { id: string } }).user?.id;
    return id ? `user:${id}` : `ip:${clientIp(req)}`;
};
