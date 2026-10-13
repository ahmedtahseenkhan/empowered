// URL helpers for rendering user-supplied links safely.

export const API_BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Origin of the API server (uploads and private files are served from there, not the admin host).
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');

/** Absolute http(s) URL, or null for anything else (javascript:, data:, vbscript:, relative...). */
export const safeHttpUrl = (value?: string | null): string | null => {
    if (!value || typeof value !== 'string') return null;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
        return null;
    }
};

/**
 * Resolve a stored file URL for opening: absolute http(s) URLs pass through, and API-relative
 * paths (/api/files/..., /api/uploads/..., /uploads/...) are resolved against the API origin.
 * Everything else returns null.
 */
export const resolveApiFileUrl = (value?: string | null): string | null => {
    if (!value || typeof value !== 'string') return null;
    const v = value.trim();
    if (/^\/(api|uploads)\//.test(v) && !v.startsWith('//')) return `${API_ORIGIN}${v}`;
    if (/^(api|uploads)\//.test(v)) return `${API_ORIGIN}/${v}`;
    return safeHttpUrl(v);
};

/** Open a URL in a new tab without giving it a handle on this window. */
export const openExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
};
