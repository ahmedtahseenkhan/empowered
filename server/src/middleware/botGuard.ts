import { Request, Response, NextFunction } from 'express';

/**
 * Spam-bot defences for public forms (contact, signup, password reset, demo, beta):
 *  - honeypot: a hidden `company_website` field real users never fill in
 *  - random-string detection: bots fill text fields with strings like "MzdcxDSaOXCSmjVWJbx"
 *  - Cloudflare Turnstile: enforced when TURNSTILE_SECRET_KEY is set (client sends `turnstileToken`)
 * Honeypot hits get a fake success so the bot doesn't adapt; random-string hits and a failed
 * Turnstile check get a real error because they can also happen to people.
 */

const HONEYPOT_FIELD = 'company_website';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** One word of 12+ letters that switches from lower to upper case 3+ times, e.g. "WJycdkYhKTlCxkBJRqrOrKB". */
export const looksLikeRandomString = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    const s = value.trim();
    if (s.length < 12 || !/^[A-Za-z]+$/.test(s)) return false;
    let switches = 0;
    for (let i = 1; i < s.length; i++) {
        const prevLower = s[i - 1] >= 'a' && s[i - 1] <= 'z';
        const currUpper = s[i] >= 'A' && s[i] <= 'Z';
        if (prevLower && currUpper) switches++;
    }
    return switches >= 3;
};

const verifyTurnstile = async (token: unknown, ip: string | undefined): Promise<boolean> => {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) return true;
    if (typeof token !== 'string' || !token || token.length > 2048) return false;
    try {
        const body = new URLSearchParams({ secret, response: token });
        if (ip) body.set('remoteip', ip);
        const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
        const data = (await res.json()) as { success?: boolean };
        return data.success === true;
    } catch (err) {
        console.error('[botGuard] Turnstile verification failed:', (err as Error).message);
        return false;
    }
};

interface BotGuardOptions {
    /** Body fields checked for random-string spam */
    textFields?: string[];
    /** Response sent to detected bots so they believe the submission worked */
    fakeSuccess: { status?: number; body: Record<string, unknown> };
}

export const botGuard = ({ textFields = [], fakeSuccess }: BotGuardOptions) =>
    async (req: Request, res: Response, next: NextFunction) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const filledHoneypot = typeof body[HONEYPOT_FIELD] === 'string' && (body[HONEYPOT_FIELD] as string).trim() !== '';
        const randomText = textFields.some((f) => looksLikeRandomString(body[f]));

        if (filledHoneypot) {
            console.warn(`[botGuard] Dropped bot submission to ${req.originalUrl} (honeypot)`);
            return res.status(fakeSuccess.status ?? 200).json(fakeSuccess.body);
        }
        // A real error, not a fake success: an unusual real name (e.g. "MacKenzieMcDonald") can trip this,
        // and that person needs to know the submission didn't go through.
        if (randomText) {
            console.warn(`[botGuard] Rejected random-text submission to ${req.originalUrl}`);
            return res.status(400).json({ error: 'Some fields look invalid. Please use real words (with spaces) and try again.', code: 'INVALID_TEXT' });
        }

        // Signed-in users already passed the check at signup.
        const signedIn = !!(req as Request & { user?: unknown }).user;
        if (!signedIn && !(await verifyTurnstile(body.turnstileToken, req.ip))) {
            return res.status(400).json({ error: 'Please complete the verification check and try again.', code: 'CAPTCHA_FAILED' });
        }
        return next();
    };
