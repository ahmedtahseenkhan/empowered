import { Request, Response } from 'express';
import prisma from '../config/db';
import emailService from '../services/emailService';

export const submitBetaApplication = async (req: Request, res: Response) => {
    try {
        const body = req.body as {
            full_name?: string;
            email?: string;
            phone_number?: string;
            service_description?: string;
            category?: string;
            category_other?: string;
            session_management?: string[];
            has_active_clients?: boolean;
            biggest_challenge?: string;
            profile_link?: string;
            referral_source?: string;
        };

        const full_name = (body.full_name ?? '').trim();
        const email = (body.email ?? '').trim().toLowerCase();
        const phone_number = (body.phone_number ?? '').trim();
        const service_description = (body.service_description ?? '').trim();
        const category = (body.category ?? '').trim();
        const session_management = Array.isArray(body.session_management)
            ? body.session_management.map((s: string) => s.trim()).filter(Boolean)
            : [];
        const biggest_challenge = (body.biggest_challenge ?? '').trim();
        const referral_source = (body.referral_source ?? '').trim();

        if (!full_name || !email || !phone_number || !service_description || !category || !biggest_challenge || !referral_source) {
            return res.status(400).json({ error: 'Please fill in all required fields.' });
        }

        if (session_management.length === 0) {
            return res.status(400).json({ error: 'Please select at least one session management method.' });
        }

        if (typeof body.has_active_clients !== 'boolean') {
            return res.status(400).json({ error: 'Please indicate whether you have active clients.' });
        }

        const application = await prisma.betaApplication.create({
            data: {
                full_name,
                email,
                phone_number,
                service_description,
                category,
                category_other: body.category_other?.trim() || null,
                session_management,
                has_active_clients: body.has_active_clients,
                biggest_challenge,
                profile_link: body.profile_link?.trim() || null,
                referral_source,
            },
        });

        // Notify admin
        const adminEmail =
            process.env.ADMIN_EMAIL ||
            process.env.SUPPORT_EMAIL ||
            process.env.SMTP_FROM_EMAIL ||
            process.env.SMTP_USER;

        if (adminEmail) {
            try {
                await emailService.sendBetaApplicationNotification({
                    adminEmail,
                    full_name,
                    email,
                    phone_number,
                    service_description,
                    category: body.category_other ? `${category} — ${body.category_other}` : category,
                    session_management,
                    has_active_clients: body.has_active_clients,
                    biggest_challenge,
                    profile_link: body.profile_link?.trim() || null,
                    referral_source,
                });
            } catch (e) {
                console.error('Failed to send beta application notification email:', e);
            }
        }

        // Confirmation email to applicant
        try {
            await emailService.sendBetaApplicationConfirmation({
                full_name,
                email,
            });
        } catch (e) {
            console.error('Failed to send beta application confirmation email:', e);
        }

        return res.status(201).json({ message: 'Application submitted successfully.', id: application.id });
    } catch (error) {
        console.error('Beta application error:', error);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};
