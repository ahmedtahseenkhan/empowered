import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { buildGoogleAuthUrl, exchangeCodeForTokens, getFreeBusy } from '../services/googleCalendar';
import { encryptString } from '../utils/crypto';

const createState = () => crypto.randomBytes(32).toString('hex');

export const startConnectGoogleCalendar = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can connect Google Calendar' });

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const state = createState();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await prisma.oAuthState.create({
            data: {
                state,
                tutor_id: tutor.id,
                expires_at: expiresAt,
            }
        });

        const authUrl = await buildGoogleAuthUrl(state);
        return res.json({ authUrl });
    } catch (e) {
        console.error('startConnectGoogleCalendar error:', e);
        return res.status(500).json({ error: 'Failed to start Google Calendar connection' });
    }
};

export const googleCalendarOAuthCallback = async (req: Request, res: Response) => {
    try {
        const code = (req.query.code as string | undefined)?.trim();
        const state = (req.query.state as string | undefined)?.trim();

        if (!code) return res.status(400).send('Missing code');
        if (!state) return res.status(400).send('Missing state');

        const record = await prisma.oAuthState.findUnique({ where: { state } });
        if (!record) return res.status(400).send('Invalid state');
        if (record.expires_at.getTime() < Date.now()) {
            await prisma.oAuthState.delete({ where: { state } });
            return res.status(400).send('State expired');
        }

        const tokens = await exchangeCodeForTokens(code);

        await prisma.googleCalendarConnection.upsert({
            where: { tutor_id: record.tutor_id },
            create: {
                tutor_id: record.tutor_id,
                calendar_id: 'primary',
                timezone: 'UTC',
                sync_enabled: true,
                access_token_enc: tokens.access_token ? encryptString(tokens.access_token) : null,
                refresh_token_enc: tokens.refresh_token ? encryptString(tokens.refresh_token) : null,
                scope: typeof tokens.scope === 'string' ? tokens.scope : null,
                token_type: tokens.token_type || null,
                expires_at: typeof tokens.expiry_date === 'number' ? new Date(tokens.expiry_date) : null,
            },
            update: {
                access_token_enc: tokens.access_token ? encryptString(tokens.access_token) : undefined,
                refresh_token_enc: tokens.refresh_token ? encryptString(tokens.refresh_token) : undefined,
                scope: typeof tokens.scope === 'string' ? tokens.scope : undefined,
                token_type: tokens.token_type || undefined,
                expires_at: typeof tokens.expiry_date === 'number' ? new Date(tokens.expiry_date) : undefined,
                sync_enabled: true,
            }
        });

        await prisma.oAuthState.delete({ where: { state } });

        const appBase = process.env.CLIENT_BASE_URL || 'http://localhost:5173';
        return res.redirect(`${appBase}/dashboard?googleCalendar=connected`);
    } catch (e) {
        console.error('googleCalendarOAuthCallback error:', e);
        return res.status(500).send('Failed to connect Google Calendar');
    }
};

export const disconnectGoogleCalendar = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can disconnect Google Calendar' });

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        await prisma.googleCalendarConnection.deleteMany({ where: { tutor_id: tutor.id } });

        return res.json({ success: true });
    } catch (e) {
        console.error('disconnectGoogleCalendar error:', e);
        return res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
    }
};

export const getTutorFreeBusy = async (req: Request, res: Response) => {
    try {
        const tutorId = (req.params.tutorId as string | undefined)?.trim();
        const timeMin = (req.query.timeMin as string | undefined)?.trim();
        const timeMax = (req.query.timeMax as string | undefined)?.trim();

        if (!tutorId) return res.status(400).json({ error: 'tutorId is required' });
        if (!timeMin) return res.status(400).json({ error: 'timeMin is required' });
        if (!timeMax) return res.status(400).json({ error: 'timeMax is required' });

        const busy = await getFreeBusy(tutorId, timeMin, timeMax);
        if (!busy) return res.json({ connected: false, busy: [] });

        return res.json({ connected: true, busy });
    } catch (e) {
        console.error('getTutorFreeBusy error:', e);
        return res.status(500).json({ error: 'Failed to fetch free/busy' });
    }
};
