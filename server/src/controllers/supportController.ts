import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import emailService from '../services/emailService';

/**
 * Create a support ticket (query/complaint).
 * - If authenticated: body { subject, message } → ticket linked to user.
 * - If guest: body { name, email, subject, message } → ticket with submitter_name, submitter_email.
 */
export const createTicket = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user;
        const body = req.body as {
            name?: string;
            email?: string;
            subject?: string;
            message?: string;
        };

        const subject = (body.subject ?? '').trim();
        const message = (body.message ?? '').trim();
        if (!subject || !message) {
            return res.status(400).json({ error: 'Subject and message are required.' });
        }

        let user_id: string | null = null;
        let submitter_name: string | null = null;
        let submitter_email: string | null = null;

        if (user) {
            user_id = user.id;
            const dbUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: {
                    email: true,
                    student_profile: { select: { username: true } },
                    tutor_profile: { select: { username: true } },
                    role: true,
                },
            });
            if (!dbUser) return res.status(401).json({ error: 'User not found' });
            submitter_name =
                dbUser.role === 'STUDENT'
                    ? (dbUser.student_profile?.username ?? 'Student')
                    : (dbUser.tutor_profile?.username ?? 'Mentor');
            submitter_email = dbUser.email;
        } else {
            const name = (body.name ?? '').trim();
            const email = (body.email ?? '').trim();
            if (!name || !email) {
                return res.status(400).json({ error: 'Name and email are required for guest submissions.' });
            }
            submitter_name = name;
            submitter_email = email;
        }

        const ticket = await prisma.supportTicket.create({
            data: {
                user_id,
                submitter_name,
                submitter_email,
                subject,
                message,
            },
        });

        const adminEmail =
            process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
        if (adminEmail) {
            try {
                await emailService.sendNewSupportTicketNotification({
                    adminEmail,
                    submitterName: submitter_name,
                    submitterEmail: submitter_email!,
                    subject,
                    message,
                    source: user ? (user.role === 'STUDENT' ? 'Student dashboard' : 'Mentor dashboard') : 'Contact us (website)',
                });
            } catch (e) {
                console.error('Failed to send new-ticket email to admin:', e);
            }
        }

        return res.status(201).json({ id: ticket.id, message: 'Your message has been sent. We will get back to you soon.' });
    } catch (error) {
        console.error('createTicket error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};
