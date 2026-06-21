import { Request, Response, NextFunction } from 'express';

/**
 * Lightweight in-memory rate limiter (no external dependency).
 *
 * Fixed-window counter keyed by client IP. Intended to throttle abuse/spam on
 * public endpoints (e.g. the contact form). Note: state is per-process and
 * resets on restart — adequate for spam protection on a single-server setup.
 * For multi-instance deployments, back this with a shared store (Redis) instead.
 */

interface WindowEntry {
    count: number;
    resetAt: number;
}

interface RateLimitOptions {
    windowMs: number;
    max: number;
    message?: string;
}

export function rateLimit(options: RateLimitOptions) {
    const { windowMs, max, message = 'Too many requests. Please try again later.' } = options;
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
        const key = (
            (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
            req.ip ||
            req.socket.remoteAddress ||
            'unknown'
        );

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
