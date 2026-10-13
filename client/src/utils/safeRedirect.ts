/**
 * Returns `value` only when it is a same-origin path ("/foo?bar"), otherwise `fallback`.
 * Rejects protocol-relative ("//evil.com"), backslash tricks ("/\evil.com"), schemes and control chars.
 */
export const safeRedirectPath = (value: string | null | undefined, fallback = '/dashboard'): string => {
    if (typeof value !== 'string') return fallback;
    const v = value.trim();
    if (!v || v.length > 2048) return fallback;
    if (!v.startsWith('/')) return fallback;
    if (v.startsWith('//') || v.startsWith('/\\')) return fallback;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f\\]/.test(v)) return fallback;
    try {
        const resolved = new URL(v, window.location.origin);
        if (resolved.origin !== window.location.origin) return fallback;
        return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    } catch {
        return fallback;
    }
};
