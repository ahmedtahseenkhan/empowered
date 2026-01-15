import { z } from 'zod';

export const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['STUDENT', 'TUTOR']).default('STUDENT'),
    username: z.string().min(2),
    tier: z.enum(['STANDARD', 'PRO', 'PREMIUM']).optional(),
});

export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});
