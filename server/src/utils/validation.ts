import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt only uses the first 72 bytes; cap well above normal passphrases but below abuse.
export const PASSWORD_MAX_LENGTH = 128;
export const PasswordSchema = z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

/** Trimmed, lower-cased email (accounts are matched case-insensitively). */
export const EmailSchema = z.string().trim().toLowerCase().max(254).email();

export const normalizeEmail = (email: unknown): string | null => {
    const parsed = EmailSchema.safeParse(email);
    return parsed.success ? parsed.data : null;
};

export const RegisterSchema = z.object({
    email: EmailSchema,
    password: PasswordSchema,
    role: z.enum(['STUDENT', 'TUTOR'] as const).default('STUDENT'),
    username: z.string().trim().min(2).max(80),
    tier: z.enum(['STANDARD', 'PRO', 'PREMIUM'] as const).optional(),
});

export const LoginSchema = z.object({
    email: EmailSchema,
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

/** True for absolute http(s) URLs only — rejects javascript:, data:, vbscript:, relative paths. */
export const isSafeHttpUrl = (value: unknown): boolean => {
    if (typeof value !== 'string' || value.length > 2048) return false;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
};

/** Optional http(s) URL field: empty string / null become null. */
export const OptionalHttpUrlSchema = z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === 'string' && v.trim() ? v.trim() : null))
    .refine((v) => v === null || isSafeHttpUrl(v), { message: 'Must be a valid http(s) URL' });

/** First validation issue as a readable message. */
export const firstIssue = (error: z.ZodError): string => {
    const issue = error.issues[0];
    if (!issue) return 'Invalid request';
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
};
