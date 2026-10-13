import { Request, Response } from 'express';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth';
import { isProduction } from '../config/origins';

/**
 * Auth tokens live only in HttpOnly cookies so page scripts (and any XSS) can't read them.
 * The admin panel keeps its own cookie so signing in there doesn't sign you in on the main
 * site (and vice versa); it identifies itself with the X-App-Client header.
 */
export type AppClient = 'app' | 'admin';

// __Host- cookies must be Secure, Path=/ and have no Domain, so sibling subdomains can't set them.
const COOKIE_NAMES: Record<AppClient, string> = isProduction
    ? { app: '__Host-el_session', admin: '__Host-el_admin_session' }
    : { app: 'el_session', admin: 'el_admin_session' };

export const getAppClient = (req: Request): AppClient =>
    String(req.headers['x-app-client'] || '').toLowerCase() === 'admin' ? 'admin' : 'app';

export const parseCookies = (header: string | undefined): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!header) return out;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx < 0) continue;
        const name = part.slice(0, idx).trim();
        if (!name || name in out) continue;
        try {
            out[name] = decodeURIComponent(part.slice(idx + 1).trim());
        } catch {
            out[name] = part.slice(idx + 1).trim();
        }
    }
    return out;
};

/** Token for the calling client's cookie (admin panel → admin cookie, otherwise the main site's). */
export const getTokenFromRequest = (req: Request): string | null => {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[COOKIE_NAMES[getAppClient(req)]] || null;
};

/** Every session token on the request, admin cookie first; for plain browser navigations (file downloads). */
export const getAllTokensFromCookieHeader = (cookieHeader: string | undefined): string[] => {
    const cookies = parseCookies(cookieHeader);
    return [cookies[COOKIE_NAMES.admin], cookies[COOKIE_NAMES.app]].filter((t): t is string => !!t);
};

const cookieOptions = () => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
});

export const setAuthCookie = (res: Response, client: AppClient, token: string): void => {
    res.cookie(COOKIE_NAMES[client], token, { ...cookieOptions(), maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000 });
};

export const clearAuthCookie = (res: Response, client: AppClient): void => {
    res.clearCookie(COOKIE_NAMES[client], cookieOptions());
};
