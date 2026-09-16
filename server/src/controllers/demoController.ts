import { Request, Response } from 'express';
import prisma from '../config/db';
import { createDemoMeetEvent, getDemoOAuthAuthUrl, exchangeDemoOAuthCode } from '../services/googleCalendar';
import {
    ADMIN_TIMEZONE,
    SLOT_DURATION_MINUTES,
    getAvailableDemoSlots,
    isValidTimezone,
    formatDemoSlot,
} from '../services/demoAvailability';

export async function getDemoSlots(req: Request, res: Response) {
    try {
        const fromStr = (req.query.from as string)?.trim();
        const toStr = (req.query.to as string)?.trim();
        if (!fromStr || !toStr) {
            return res.status(400).json({ error: 'from and to (ISO date) are required' });
        }
        const from = new Date(fromStr);
        const to = new Date(toStr);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            return res.status(400).json({ error: 'Invalid from or to date' });
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
        const body = req.body as {
            full_name?: string;
            email?: string;
            phone?: string;
            category_alignment?: string;
            experience_years?: string;
            income_status?: string;
            looking_for?: string[];
            slot_start_time?: string;
            timezone?: string;
        };

        const full_name = (body.full_name ?? '').trim();
        const email = (body.email ?? '').trim();
        const slot_start_time = body.slot_start_time;

        if (!full_name || !email) {
            return res.status(400).json({ error: 'Full name and email are required' });
        }
        if (!slot_start_time) {
            return res.status(400).json({ error: 'Please select a demo slot' });
        }

        const start = new Date(slot_start_time);
        if (Number.isNaN(start.getTime())) {
            return res.status(400).json({ error: 'Invalid slot time' });
        }
        const end = new Date(start.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);

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

        const lookingFor = Array.isArray(body.looking_for) ? body.looking_for : [];
        const looking_for_str = lookingFor.length ? JSON.stringify(lookingFor) : '[]';

        // Create Google Meet link first so every demo booking always has a meeting link
        let meetResult: { meetLink: string; htmlLink: string | null; eventId: string | null };
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
                phone: (body.phone ?? '').trim() || null,
                category_alignment: (body.category_alignment ?? 'All of the above').trim(),
                experience_years: (body.experience_years ?? '').trim(),
                income_status: (body.income_status ?? '').trim(),
                looking_for: looking_for_str,
                slot_start_time: start,
                slot_end_time: end,
                timezone: prospectTimezone,
                meeting_link: meetResult.meetLink,
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
                        phone: (body.phone ?? '').trim() || '—',
                        categoryAlignment: (body.category_alignment ?? 'All of the above').trim() || '—',
                        experienceYears: (body.experience_years ?? '').trim() || '—',
                        incomeStatus: (body.income_status ?? '').trim() || '—',
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

/** Build redirect URI for demo OAuth. Use env for exact match with Google Console (avoids redirect_uri_mismatch). */
function getDemoOAuthRedirectUri(req: Request): string {
    const fromEnv = process.env.GOOGLE_DEMO_REDIRECT_URI?.trim();
    if (fromEnv) return fromEnv;
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('x-forwarded-host') || req.get('host') || '';
    return `${proto}://${host}/api/demo/oauth-callback`;
}

/**
 * GET /api/demo/oauth-start
 * Redirects to Google OAuth to obtain a new demo refresh token.
 * Add the redirect URI (e.g. https://admin.emplearnings.com/api/demo/oauth-callback) to Google Console.
 */
export async function demoOAuthStart(req: Request, res: Response) {
    try {
        const redirectUri = getDemoOAuthRedirectUri(req);
        const authUrl = getDemoOAuthAuthUrl(redirectUri);
        res.redirect(authUrl);
    } catch (e) {
        console.error('Demo OAuth start error:', e);
        res.status(500).send(
            'Could not start OAuth. Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in .env.'
        );
    }
}

/**
 * GET /api/demo/oauth-callback
 * Google redirects here after user authorizes. Exchanges code for tokens and shows the refresh token.
 */
export async function demoOAuthCallback(req: Request, res: Response) {
    const code = req.query.code as string;
    const error = req.query.error as string;
    if (error) {
        res.status(400).send(
            `<p>Google returned an error: ${error}</p><p><a href="/api/demo/oauth-start">Try again</a></p>`
        );
        return;
    }
    if (!code) {
        res.status(400).send(
            '<p>Missing authorization code.</p><p><a href="/api/demo/oauth-start">Start over</a></p>'
        );
        return;
    }
    try {
        const redirectUri = getDemoOAuthRedirectUri(req);
        const { refresh_token, missing_meet_scopes } = await exchangeDemoOAuthCode(code, redirectUri);
        const scopeNotice = missing_meet_scopes.length > 0
            ? `<p style="color:#b45309;background:#fef3c7;padding:12px;border-radius:6px;"><strong>Google Meet permission was not granted</strong> (${missing_meet_scopes.join(', ')}). Session links will still be created, but participants may have to knock. Make sure the <em>Google Meet REST API</em> is enabled in the Cloud project and tick every permission on the consent screen, then <a href="/api/demo/oauth-start">try again</a>.</p>`
            : `<p style="color:#166534;background:#dcfce7;padding:12px;border-radius:6px;">Google Meet permission granted — session links will let everyone join without knocking.</p>`;
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Platform Google refresh token</title></head>
<body style="font-family: sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem;">
  <h2>Platform Google refresh token</h2>
  <p>This token is used for demo calls <strong>and</strong> for every session's Google Meet link.</p>
  <p>Add it to your server <code>.env</code> as <code>GOOGLE_DEMO_REFRESH_TOKEN</code>, then restart the server.</p>
  ${scopeNotice}
  <textarea readonly style="width:100%; height:120px; font-family:monospace; font-size:12px;">${refresh_token}</textarea>
  <p><strong>Keep this token private.</strong> Do not commit it to git.</p>
  <p><a href="/api/demo/oauth-start">Get a new token</a></p>
</body>
</html>`;
        res.send(html);
    } catch (e) {
        console.error('Demo OAuth callback error:', e);
        res.status(500).send(
            `<p>Failed to exchange code: ${(e as Error).message}</p><p><a href="/api/demo/oauth-start">Try again</a></p>`
        );
    }
}
