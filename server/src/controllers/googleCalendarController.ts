import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import {
    buildGoogleAuthUrl,
    exchangeCodeForTokens,
    getFreeBusy,
    getGoogleAccountEmail,
    MENTOR_REQUIRED_SCOPE,
    moveUpcomingLessonsToMentor,
    revokeMentorToken,
} from '../services/googleCalendar';
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

const appBaseUrl = () => (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').trim().replace(/\/+$/, '');
const backToDashboard = (res: Response, result: 'connected' | 'error', reason?: string) =>
    res.redirect(`${appBaseUrl()}/dashboard?googleCalendar=${result}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`);

export const googleCalendarOAuthCallback = async (req: Request, res: Response) => {
    try {
        const code = (req.query.code as string | undefined)?.trim();
        const state = (req.query.state as string | undefined)?.trim();
        const googleError = (req.query.error as string | undefined)?.trim();

        if (googleError) return backToDashboard(res, 'error', googleError === 'access_denied' ? 'denied' : googleError);
        if (!code || !state) return backToDashboard(res, 'error', 'missing_code');

        const record = await prisma.oAuthState.findUnique({ where: { state } });
        if (!record) return backToDashboard(res, 'error', 'invalid_state');
        if (record.expires_at.getTime() < Date.now()) {
            await prisma.oAuthState.delete({ where: { state } });
            return backToDashboard(res, 'error', 'expired');
        }
        await prisma.oAuthState.delete({ where: { state } });

        const tokens = await exchangeCodeForTokens(code);
        const scope = typeof tokens.scope === 'string' ? tokens.scope : '';
        if (scope && !scope.includes(MENTOR_REQUIRED_SCOPE)) {
            // The mentor unticked the calendar permission on Google's consent screen.
            return backToDashboard(res, 'error', 'missing_permission');
        }

        const existing = await prisma.googleCalendarConnection.findUnique({
            where: { tutor_id: record.tutor_id },
            select: { refresh_token_enc: true },
        });
        if (!tokens.refresh_token && !existing?.refresh_token_enc) return backToDashboard(res, 'error', 'no_refresh_token');

        const googleEmail = await getGoogleAccountEmail(tokens.access_token);

        await prisma.googleCalendarConnection.upsert({
            where: { tutor_id: record.tutor_id },
            create: {
                tutor_id: record.tutor_id,
                calendar_id: 'primary',
                timezone: 'UTC',
                sync_enabled: true,
                access_token_enc: tokens.access_token ? encryptString(tokens.access_token) : null,
                refresh_token_enc: tokens.refresh_token ? encryptString(tokens.refresh_token) : null,
                scope: scope || null,
                token_type: tokens.token_type || null,
                expires_at: typeof tokens.expiry_date === 'number' ? new Date(tokens.expiry_date) : null,
                google_email: googleEmail,
                needs_reconnect: false,
                last_error: null,
            },
            update: {
                access_token_enc: tokens.access_token ? encryptString(tokens.access_token) : undefined,
                refresh_token_enc: tokens.refresh_token ? encryptString(tokens.refresh_token) : undefined,
                scope: scope || undefined,
                token_type: tokens.token_type || undefined,
                expires_at: typeof tokens.expiry_date === 'number' ? new Date(tokens.expiry_date) : undefined,
                google_email: googleEmail || undefined,
                sync_enabled: true,
                needs_reconnect: false,
                last_error: null,
            }
        });

        // Move this mentor's upcoming platform-hosted sessions onto their Google (background).
        void moveUpcomingLessonsToMentor(record.tutor_id).catch((e) =>
            console.error('[GoogleCalendar] Moving upcoming sessions to the mentor failed:', e));

        return backToDashboard(res, 'connected');
    } catch (e) {
        console.error('googleCalendarOAuthCallback error:', e);
        return backToDashboard(res, 'error', 'server_error');
    }
};

/** GET /api/google-calendar/status — the mentor's own connection state for the dashboard. */
export const getGoogleCalendarStatus = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (req.user?.role !== 'TUTOR') return res.status(403).json({ error: 'Only mentors have a Google connection' });

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId }, select: { id: true } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const conn = await prisma.googleCalendarConnection.findUnique({
            where: { tutor_id: tutor.id },
            select: { refresh_token_enc: true, google_email: true, needs_reconnect: true, last_error: true, scope: true, created_at: true, updated_at: true },
        });
        const upcoming = { tutor_id: tutor.id, status: 'BOOKED' as const, end_time: { gte: new Date() } };
        const [mentorHosted, platformHosted] = await Promise.all([
            prisma.lesson.count({ where: { ...upcoming, meeting_host: 'MENTOR' } }),
            prisma.lesson.count({ where: { ...upcoming, OR: [{ meeting_host: null }, { meeting_host: 'PLATFORM' }] } }),
        ]);

        const connected = !!conn?.refresh_token_enc && !conn.needs_reconnect
            && (!conn.scope || conn.scope.includes(MENTOR_REQUIRED_SCOPE));
        return res.json({
            connected,
            needs_reconnect: !!conn && !connected,
            google_email: conn?.google_email || null,
            last_error: conn?.needs_reconnect ? conn.last_error : null,
            connected_at: conn?.created_at || null,
            upcoming_sessions: { on_your_google: mentorHosted, on_platform_link: platformHosted },
        });
    } catch (e) {
        console.error('getGoogleCalendarStatus error:', e);
        return res.status(500).json({ error: 'Failed to load Google connection status' });
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

        const conn = await prisma.googleCalendarConnection.findUnique({ where: { tutor_id: tutor.id }, select: { refresh_token_enc: true } });
        await prisma.googleCalendarConnection.deleteMany({ where: { tutor_id: tutor.id } });
        await revokeMentorToken(conn?.refresh_token_enc);

        // Sessions already on the mentor's Google keep their links (the events stay on their calendar).
        return res.json({ success: true });
    } catch (e) {
        console.error('disconnectGoogleCalendar error:', e);
        return res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
    }
};

const FREEBUSY_MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000;

export const getTutorFreeBusy = async (req: Request, res: Response) => {
    try {
        const tutorId = (req.params.tutorId as string | undefined)?.trim();
        const timeMin = (req.query.timeMin as string | undefined)?.trim();
        const timeMax = (req.query.timeMax as string | undefined)?.trim();

        if (!tutorId) return res.status(400).json({ error: 'tutorId is required' });
        if (!timeMin) return res.status(400).json({ error: 'timeMin is required' });
        if (!timeMax) return res.status(400).json({ error: 'timeMax is required' });

        const min = new Date(timeMin);
        const max = new Date(timeMax);
        if (Number.isNaN(min.getTime()) || Number.isNaN(max.getTime())) {
            return res.status(400).json({ error: 'timeMin and timeMax must be valid ISO dates' });
        }
        if (min >= max) return res.status(400).json({ error: 'timeMin must be before timeMax' });
        if (max.getTime() - min.getTime() > FREEBUSY_MAX_RANGE_MS) {
            return res.status(400).json({ error: 'Date range cannot exceed 62 days' });
        }

        const busy = await getFreeBusy(tutorId, min.toISOString(), max.toISOString());
        if (!busy) return res.json({ connected: false, busy: [] });

        return res.json({ connected: true, busy });
    } catch (e) {
        console.error('getTutorFreeBusy error:', e);
        return res.status(500).json({ error: 'Failed to fetch free/busy' });
    }
};
