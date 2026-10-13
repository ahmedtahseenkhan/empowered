const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000/api';

/** Origin of the API server (e.g. "https://emplearnings.com"), without the /api suffix. */
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

/** True only for absolute http(s) URLs. Blocks javascript:, data:, vbscript: and friends. */
export const isHttpUrl = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    const v = value.trim();
    if (!v) return false;
    try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

/** Relative paths served by our API for user content (public uploads and private files). */
export const isApiFilePath = (value: unknown): boolean =>
    typeof value === 'string' && /^\/(api\/(uploads|files)|uploads)\//.test(value.trim()) && !/[\\\s]|\.\.\//.test(value.trim());

/**
 * Turns a user-supplied or stored URL into something safe for href/src/window.open:
 * http(s) URLs pass through, our /uploads/ and /api/files/ paths are made absolute against the API,
 * anything else (javascript:, data:, protocol-relative, ...) returns undefined.
 */
export const safeExternalUrl = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const v = value.trim();
    if (isHttpUrl(v)) return v;
    if (isApiFilePath(v)) return resolveFileUrl(v);
    return undefined;
};

/**
 * Makes an API file path absolute. `/uploads/x` and `/api/uploads/x` are public uploads;
 * `/api/files/x` are private files that the browser fetches with the session cookie.
 */
export const resolveFileUrl = (path: string): string => {
    if (isHttpUrl(path)) return path;
    return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
};

/** window.open for user-supplied URLs: only http(s)/API file URLs, always without opener access. */
export const openExternal = (value: unknown): void => {
    const url = safeExternalUrl(value);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
};
