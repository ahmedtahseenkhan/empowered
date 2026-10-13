import 'dotenv/config';

// Browser origins allowed to call the API with credentials (CORS, CSRF origin check, socket.io).
// Production falls back to the known site hosts so a missing env var never opens the API to every origin.
const PRODUCTION_DEFAULT_ORIGINS = [
    'https://emplearnings.com',
    'https://www.emplearnings.com',
    'https://admin.emplearnings.com',
];

const normalize = (o: string) => o.trim().replace(/\/+$/, '').toLowerCase();

const configured = (process.env.CORS_ORIGINS || [process.env.CLIENT_URL, process.env.CLIENT_BASE_URL, process.env.ADMIN_URL].filter(Boolean).join(','))
    .split(',')
    .map(normalize)
    .filter(Boolean);

export const isProduction = process.env.NODE_ENV === 'production';

export const allowedOrigins: string[] = configured.length > 0
    ? configured
    : isProduction ? PRODUCTION_DEFAULT_ORIGINS : [];

/** In development with no list configured, any origin is accepted (localhost ports vary). */
export const isOriginAllowed = (origin: string | undefined | null): boolean => {
    if (!origin) return true;
    if (origin === 'null') return false;
    if (allowedOrigins.length === 0) return !isProduction;
    return allowedOrigins.includes(normalize(origin));
};
