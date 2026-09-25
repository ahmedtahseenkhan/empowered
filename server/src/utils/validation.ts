import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const PasswordSchema = z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);

export const RegisterSchema = z.object({
    email: z.string().email(),
    password: PasswordSchema,
    role: z.enum(['STUDENT', 'TUTOR'] as const).default('STUDENT'),
    username: z.string().min(2),
    tier: z.enum(['STANDARD', 'PRO', 'PREMIUM'] as const).optional(),
});

export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});
