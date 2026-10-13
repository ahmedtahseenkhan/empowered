import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../config/db';
import { EmailSchema, firstIssue } from '../utils/validation';
import { escapeHtml } from '../utils/html';
import { createDemoMeetEvent, getDemoOAuthAuthUrl, exchangeDemoOAuthCode } from '../services/googleCalendar';
import {
    ADMIN_TIMEZONE,
    SLOT_DURATION_MINUTES,
    getAvailableDemoSlots,
    isValidTimezone,
    formatDemoSlot,
} from '../services/demoAvailability';

const MAX_SLOT_RANGE_MS = 62 * 24 * 60 * 60 * 1000;

const optionalShortText = (max: number) =>
    z.union([z.string(), z.number(), z.null(), z.undefined()])
        .transform((v) => (v === null || v === undefined ? '' : String(v).replace(/[\r\n]+/g, ' ').trim()))
        .refine((v) => v.length <= max, { message: `must be at most ${max} characters` });

const DemoBookingSchema = z.object({
    full_name: z.string().trim().min(1, 'Full name is required').max(120).transform((s) => s.replace(/[\r\n]+/g, ' ')),
    email: EmailSchema,
    phone: optionalShortText(40),
    category_alignment: optionalShortText(200),
    experience_years: optionalShortText(100),
    income_status: optionalShortText(100),
    looking_for: z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
    slot_start_time: z.iso.datetime({ offset: true }),
    timezone: z.string().max(100).optional(),
});

export async function getDemoSlots(req: Request, res: Response) {
    try {
        const fromStr = typeof req.query.from === 'string' ? req.query.from.trim() : '';
        const toStr = typeof req.query.to === 'string' ? req.query.to.trim() : '';
        if (!fromStr || !toStr) {
            return res.status(400).json({ error: 'from and to (ISO date) are required' });
        }
        const from = new Date(fromStr);
        const to = new Date(toStr);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            return res.status(400).json({ error: 'Invalid from or to date' });
        }
        if (to < from || to.getTime() - from.getTime() > MAX_SLOT_RANGE_MS) {
            return res.status(400).json({ error: 'Date range is too large' });
        }

        const slots = await getAvailableDemoSlots(from, to);
        return res.json({ slots });
    } catch (e) {
        console.error('getDemoSlots error:', e);
        return res.status(500).json({ error: 'Failed to fetch demo slots' });
    }
}

export async function createDemoBooking(req: Request, res: Response) {
    try {
        if (!req.body?.slot_start_time) {
            return res.status(400).json({ error: 'Please select a demo slot' });
        }
        const parsed = DemoBookingSchema.safeParse(req.body);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            const field = String(issue?.path?.[0] ?? '');
            const error = field === 'email' ? 'Please enter a valid email address.'
                : field === 'full_name' ? 'Please enter your full name (up to 120 characters).'
                : field === 'slot_start_time' ? 'Invalid slot time'
                : firstIssue(parsed.error);
            return res.status(400).json({ error });
        }
        const body = parsed.data;
        const { full_name, email } = body;

        const start = new Date(body.slot_start_time);
        const end = new Date(start.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);

        // Only accept a time the public slots endpoint would actually offer (same availability rules).
        const dayMs = 24 * 60 * 60 * 1000;
        const offered = await getAvailableDemoSlots(new Date(start.getTime() - dayMs), new Date(start.getTime() + dayMs));
        if (!offered.some((slot) => new Date(slot.start).getTime() === start.getTime())) {
            return res.status(409).json({ error: 'This time is no longer available. Please choose another slot.' });
        }

        // The prospect's own timezone (from their browser). Every email they receive is
        // formatted in it; the admin still sees Dallas time.
        const prospectTimezone = isValidTimezone(body.timezone) ? body.timezone.trim() : ADMIN_TIMEZONE;

        const existing = await prisma.demoBooking.findFirst({
            where: {
                slot_start_time: start,
            },
        });
        if (existing) {
            return res.status(409).json({ error: 'This slot was just booked. Please choose another time.' });
        }

        const lookingFor = body.looking_for;
        const looking_for_str = lookingFor.length ? JSON.stringify(lookingFor) : '[]';

        // Create Google Meet link first so every demo booking always has a meeting link
        let meetResult: { meetLink: string; htmlLink: string | null; eventId: string | null; accessType: string | null };
        try {
            meetResult = await createDemoMeetEvent({
                prospectEmail: email,
                prospectName: full_name,
                start,
                end,
            });
        } catch (e) {
            console.error('Demo Meet creation failed:', e);
            return res.status(503).json({
                error: 'Demo scheduling is temporarily unavailable. Please try again later or contact support.',
            });
        }

        const booking = await prisma.demoBooking.create({
            data: {
                full_name,
                email,
                phone: body.phone || null,
                category_alignment: body.category_alignment || 'All of the above',
                experience_years: body.experience_years,
                income_status: body.income_status,
                looking_for: looking_for_str,
                slot_start_time: start,
                slot_end_time: end,
                timezone: prospectTimezone,
                meeting_link: meetResult.meetLink,
                meeting_access_type: meetResult.accessType,
                google_event_id: meetResult.eventId,
            },
        });

        const prospectSlot = formatDemoSlot(booking.slot_start_time, prospectTimezone);
        const adminSlot = formatDemoSlot(booking.slot_start_time, ADMIN_TIMEZONE);
        const lookingForDisplay = lookingFor.length > 0 ? lookingFor.join(', ') : '—';

        const formatForGoogleCalendar = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const addToCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=EmpowerEd+Demo&dates=${formatForGoogleCalendar(booking.slot_start_time)}/${formatForGoogleCalendar(booking.slot_end_time)}`;

        await prisma.emailOutbox.create({
            data: {
                type: 'DEMO_BOOKING_CONFIRMATION',
                to_email: email,
                payload: {
                    fullName: full_name,
                    email,
                    callDate: prospectSlot.date,
                    callTime: prospectSlot.time,
                    timezoneLabel: prospectSlot.timezoneLabel,
                    meetingLink: meetResult.meetLink,
                    addToCalendarUrl,
                },
                status: 'PENDING',
            },
        });

        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
        if (adminEmail) {
            await prisma.emailOutbox.create({
                data: {
                    type: 'DEMO_BOOKING_ADMIN',
                    to_email: adminEmail,
                    payload: {
                        adminEmail,
                        fullName: full_name,
                        email,
                        phone: body.phone || '—',
                        categoryAlignment: body.category_alignment || 'All of the above',
                        experienceYears: body.experience_years || '—',
                        incomeStatus: body.income_status || '—',
                        lookingFor: lookingForDisplay,
                        callDate: adminSlot.date,
                        callTime: adminSlot.time,
                        prospectTimezone: prospectTimezone,
                        prospectCallDate: prospectSlot.date,
                        prospectCallTime: prospectSlot.time,
                        meetingLink: meetResult.meetLink,
                    },
                    status: 'PENDING',
                },
            });
        }

        return res.status(201).json({
            booking: {
                id: booking.id,
                slot_start_time: booking.slot_start_time.toISOString(),
                slot_end_time: booking.slot_end_time.toISOString(),
                meeting_link: booking.meeting_link,
            },
        });
    } catch (e) {
        console.error('createDemoBooking error:', e);
        return res.status(500).json({ error: 'Failed to create demo booking' });
    }
}

// ─── One-time admin tool: obtain the platform Google refresh token ─────────
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const demoOAuthStates = new Map<string, number>();

const issueOAuthState = (): string => {
    const now = Date.now();
    for (const [key, expiresAt] of demoOAuthStates) {
        if (expiresAt <= now) demoOAuthStates.delete(key);
    }
    const state = crypto.randomBytes(32).toString('hex');
    demoOAuthStates.set(state, now + OAUTH_STATE_TTL_MS);
    return state;
};

/** Single use: a state is removed the first time it is checked. */
const consumeOAuthState = (state: unknown): boolean => {
    if (typeof state !== 'string' || !/^[0-9a-f]{64}$/.test(state)) return false;
    const expiresAt = demoOAuthStates.get(state);
    demoOAuthStates.delete(state);
    return expiresAt !== undefined && expiresAt > Date.now();
};

/**
 * Redirect URI for demo OAuth. Comes only from configuration (never from request headers,
 * which a caller controls) and must match Google Console exactly.
 */
function getDemoOAuthRedirectUri(): string | null {
    const fromEnv = process.env.GOOGLE_DEMO_REDIRECT_URI?.trim();
    if (fromEnv) return fromEnv;
    const calendarRedirect = process.env.GOOGLE_REDIRECT_URI?.trim();
    if (calendarRedirect) {
        try {
            return `${new URL(calendarRedirect).origin}/api/demo/oauth-callback`;
        } catch {
            return null;
        }
    }
    if (process.env.NODE_ENV !== 'production') return `http://localhost:${process.env.PORT || 3000}/api/demo/oauth-callback`;
    return null;
}

const oauthPage = (body: string) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Platform Google refresh token</title></head>
<body style="font-family: sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem;">
${body}
</body>
</html>`;

const sendOAuthPage = (res: Response, status: number, body: string) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).type('html').send(oauthPage(body));
};

/**
 * GET /api/demo/oauth-start
 * Redirects to Google OAuth to obtain a new demo refresh token.
 * Add the redirect URI (GOOGLE_DEMO_REDIRECT_URI) to Google Console.
 */
export async function demoOAuthStart(req: Request, res: Response) {
    try {
        const redirectUri = getDemoOAuthRedirectUri();
        if (!redirectUri) {
            return sendOAuthPage(res, 500, '<p>Set GOOGLE_DEMO_REDIRECT_URI in the server environment first.</p>');
        }
        const authUrl = new URL(getDemoOAuthAuthUrl(redirectUri));
        authUrl.searchParams.set('state', issueOAuthState());
        res.redirect(authUrl.toString());
    } catch (e) {
        console.error('Demo OAuth start error:', e);
        sendOAuthPage(res, 500, '<p>Could not start OAuth. Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in .env.</p>');
    }
}

/**
 * GET /api/demo/oauth-callback
 * Google redirects here after user authorizes. Exchanges code for tokens and shows the refresh token.
 */
export async function demoOAuthCallback(req: Request, res: Response) {
    const retryLink = '<p><a href="/api/demo/oauth-start">Start over</a></p>';
    if (!consumeOAuthState(req.query.state)) {
        return sendOAuthPage(res, 400, `<p>This sign-in link is invalid or has expired.</p>${retryLink}`);
    }
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const error = typeof req.query.error === 'string' ? req.query.error : '';
    if (error) {
        return sendOAuthPage(res, 400, `<p>Google returned an error: ${escapeHtml(error.slice(0, 200))}</p>${retryLink}`);
    }
    if (!code) {
        return sendOAuthPage(res, 400, `<p>Missing authorization code.</p>${retryLink}`);
    }
    try {
        const redirectUri = getDemoOAuthRedirectUri();
        if (!redirectUri) {
            return sendOAuthPage(res, 500, '<p>Set GOOGLE_DEMO_REDIRECT_URI in the server environment first.</p>');
        }
        const { refresh_token, missing_meet_scopes } = await exchangeDemoOAuthCode(code, redirectUri);
        const scopeNotice = missing_meet_scopes.length > 0
            ? `<p style="color:#b45309;background:#fef3c7;padding:12px;border-radius:6px;"><strong>Google Meet permission was not granted</strong> (${escapeHtml(missing_meet_scopes.join(', '))}). Session links will still be created, but participants may have to knock. Make sure the <em>Google Meet REST API</em> is enabled in the Cloud project and tick every permission on the consent screen, then <a href="/api/demo/oauth-start">try again</a>.</p>`
            : `<p style="color:#166534;background:#dcfce7;padding:12px;border-radius:6px;">Google Meet permission granted — session links will let everyone join without knocking.</p>`;
        sendOAuthPage(res, 200, `
  <h2>Platform Google refresh token</h2>
  <p>This token is used for demo calls <strong>and</strong> for every session's Google Meet link.</p>
  <p>Add it to your server <code>.env</code> as <code>GOOGLE_DEMO_REFRESH_TOKEN</code>, then restart the server.</p>
  ${scopeNotice}
  <textarea readonly style="width:100%; height:120px; font-family:monospace; font-size:12px;">${escapeHtml(refresh_token)}</textarea>
  <p><strong>Keep this token private.</strong> Do not commit it to git.</p>
  <p><a href="/api/demo/oauth-start">Get a new token</a></p>`);
    } catch (e) {
        console.error('Demo OAuth callback error:', e);
        sendOAuthPage(res, 500, `<p>Failed to exchange the authorization code. Check the server logs for details.</p>${retryLink}`);
    }
}
