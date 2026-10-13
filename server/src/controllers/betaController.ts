import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { EmailSchema, isSafeHttpUrl } from '../utils/validation';
import { maskEmail } from '../services/emailService';

export const BETA_SUBMITTED_MESSAGE = 'Application submitted successfully.';

const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ');
const required = (max: number) => z.string().trim().min(1).max(max);

const BetaApplicationSchema = z.object({
    full_name: required(120).transform(oneLine),
    email: EmailSchema,
    phone_number: required(40).transform(oneLine),
    service_description: required(5000),
    category: required(100).transform(oneLine),
    category_other: z.string().trim().max(200).transform(oneLine).optional(),
    session_management: z.array(z.string().trim().max(100)).max(10)
        .transform((items) => items.filter(Boolean)),
    has_active_clients: z.boolean(),
    biggest_challenge: required(5000),
    // Bare domains ("linkedin.com/in/me") get https://; anything that isn't http(s) is rejected.
    profile_link: z.string().trim().max(500).optional()
        .transform((v) => (v ? (/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`) : null))
        .refine((v) => v === null || isSafeHttpUrl(v)),
    referral_source: required(1000),
});

const errorFor = (field: string): string => {
    switch (field) {
        case 'email': return 'Please enter a valid email address.';
        case 'session_management': return 'Please select at least one session management method.';
        case 'has_active_clients': return 'Please indicate whether you have active clients.';
        case 'profile_link': return 'Profile link must be a valid http(s) URL.';
        default: return 'Please fill in all required fields (check the length of long answers).';
    }
};

export const submitBetaApplication = async (req: Request, res: Response) => {
    try {
        const parsed = BetaApplicationSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: errorFor(String(parsed.error.issues[0]?.path?.[0] ?? '')) });
        }
        const data = parsed.data;
        if (data.session_management.length === 0) {
            return res.status(400).json({ error: errorFor('session_management') });
        }

        // Same response whether or not the email already has an account or an open application,
        // so the form can't be used to discover who is registered.
        const [existingUser, existingApplication] = await Promise.all([
            prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }),
            prisma.betaApplication.findFirst({
                where: { email: data.email, status: { in: ['PENDING', 'APPROVED'] } },
                select: { id: true },
            }),
        ]);
        if (existingUser || existingApplication) {
            console.log(`[Beta] Skipped duplicate application for ${maskEmail(data.email)} (${existingUser ? 'existing account' : 'open application'})`);
            return res.status(201).json({ message: BETA_SUBMITTED_MESSAGE });
        }

        const category_other = data.category_other || null;

        await prisma.betaApplication.create({
            data: {
                full_name: data.full_name,
                email: data.email,
                phone_number: data.phone_number,
                service_description: data.service_description,
                category: data.category,
                category_other,
                session_management: data.session_management,
                has_active_clients: data.has_active_clients,
                biggest_challenge: data.biggest_challenge,
                profile_link: data.profile_link,
                referral_source: data.referral_source,
            },
        });

        const adminEmail =
            process.env.ADMIN_EMAIL ||
            process.env.SUPPORT_EMAIL ||
            process.env.SMTP_FROM_EMAIL ||
            process.env.SMTP_USER;

        // Delivered (with retries) by the email outbox processor.
        try {
            await prisma.emailOutbox.createMany({
                data: [
                    ...(adminEmail
                        ? [{
                            type: 'BETA_APPLICATION_ADMIN',
                            to_email: adminEmail,
                            payload: {
                                full_name: data.full_name,
                                email: data.email,
                                phone_number: data.phone_number,
                                service_description: data.service_description,
                                category: category_other ? `${data.category} — ${category_other}` : data.category,
                                session_management: data.session_management,
                                has_active_clients: data.has_active_clients,
                                biggest_challenge: data.biggest_challenge,
                                profile_link: data.profile_link,
                                referral_source: data.referral_source,
                            },
                            status: 'PENDING',
                        }]
                        : []),
                    {
                        type: 'BETA_APPLICATION_CONFIRMATION',
                        to_email: data.email,
                        payload: { full_name: data.full_name },
                        status: 'PENDING',
                    },
                ],
            });
        } catch (e) {
            console.error('Failed to queue beta application emails:', e);
        }

        return res.status(201).json({ message: BETA_SUBMITTED_MESSAGE });
    } catch (error) {
        console.error('Beta application error:', error);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};
