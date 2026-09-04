import { google } from 'googleapis';
import prisma from '../config/db';
import { decryptString, encryptString } from '../utils/crypto';

const getOAuthClient = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI env vars');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

export const buildGoogleAuthUrl = async (state: string) => {
    const oauth2Client = getOAuthClient();

    const scopes = [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
    ];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
        state,
        include_granted_scopes: true,
    });
};

export const exchangeCodeForTokens = async (code: string) => {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
};

const getAuthorizedCalendarClient = async (tutorId: string) => {
    const conn = await prisma.googleCalendarConnection.findUnique({ where: { tutor_id: tutorId } });
    if (!conn?.refresh_token_enc) return null;

    const oauth2Client = getOAuthClient();

    oauth2Client.setCredentials({
        refresh_token: decryptString(conn.refresh_token_enc),
        access_token: conn.access_token_enc ? decryptString(conn.access_token_enc) : undefined,
        expiry_date: conn.expires_at ? conn.expires_at.getTime() : undefined,
        scope: conn.scope || undefined,
        token_type: conn.token_type || undefined,
    });

    // Keep DB access token reasonably fresh for later calls.
    oauth2Client.on('tokens', async (t: any) => {
        try {
            const data: any = {};
            if (t.access_token) data.access_token_enc = encryptString(t.access_token);
            if (typeof t.expiry_date === 'number') data.expires_at = new Date(t.expiry_date);
            if (t.scope) data.scope = t.scope;
            if (t.token_type) data.token_type = t.token_type;

            if (Object.keys(data).length > 0) {
                await prisma.googleCalendarConnection.update({
                    where: { tutor_id: tutorId },
                    data: {
                        ...(data.access_token_enc ? { access_token_enc: data.access_token_enc } : {}),
                        ...(data.expires_at ? { expires_at: data.expires_at } : {}),
                        ...(data.scope ? { scope: data.scope } : {}),
                        ...(data.token_type ? { token_type: data.token_type } : {}),
                        updated_at: new Date(),
                    }
                });
            }
        } catch (e) {
            // Do not crash request on refresh persistence failures.
            console.error('Failed to persist refreshed Google tokens:', e);
        }
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    return { calendar, conn };
};

export const getFreeBusy = async (tutorId: string, timeMin: string, timeMax: string) => {
    const client = await getAuthorizedCalendarClient(tutorId);
    if (!client) return null;

    const { calendar, conn } = client;

    const resp = await calendar.freebusy.query({
        requestBody: {
            timeMin,
            timeMax,
            items: [{ id: conn.calendar_id || 'primary' }],
        }
    });

    const calendars = resp.data.calendars || {};
    const busy = calendars[conn.calendar_id || 'primary']?.busy || [];
    return busy;
};

export const createMeetEventForLesson = async (args: {
    tutorId: string;
    lessonId: string;
    title: string;
    description?: string;
    start: Date;
    end: Date;
    attendeesEmails: string[];
}) => {
    const client = await getAuthorizedCalendarClient(args.tutorId);
    if (!client) return null;

    const { calendar, conn } = client;

    const requestId = `lesson-${args.lessonId}`;

    const resp = await calendar.events.insert({
        calendarId: conn.calendar_id || 'primary',
        conferenceDataVersion: 1,
        requestBody: {
            summary: args.title,
            description: args.description,
            start: { dateTime: args.start.toISOString() },
            end: { dateTime: args.end.toISOString() },
            attendees: args.attendeesEmails.map(email => ({ email })),
            conferenceData: {
                createRequest: {
                    requestId,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                }
            }
        }
    });

    return {
        eventId: resp.data.id || null,
        htmlLink: resp.data.htmlLink || null,
        meetLink: resp.data.hangoutLink || null,
    };
};

/**
 * Move an existing lesson's calendar event to a new time (used when a student reschedules).
 * Patches start/end on the stored event id; the Meet link and attendees are preserved.
 * Returns null if the tutor has no connected calendar or the patch fails (non-fatal).
 */
export const updateMeetEventForLesson = async (args: {
    tutorId: string;
    eventId: string;
    start: Date;
    end: Date;
}) => {
    const client = await getAuthorizedCalendarClient(args.tutorId);
    if (!client) return null;

    const { calendar, conn } = client;

    const resp = await calendar.events.patch({
        calendarId: conn.calendar_id || 'primary',
        eventId: args.eventId,
        requestBody: {
            start: { dateTime: args.start.toISOString() },
            end: { dateTime: args.end.toISOString() },
        },
    });

    return {
        eventId: resp.data.id || null,
        htmlLink: resp.data.htmlLink || null,
        meetLink: resp.data.hangoutLink || null,
    };
};

/**
 * Create a Google Meet link for a demo call (EmpowerEd team with prospect).
 * Required env: GOOGLE_DEMO_REFRESH_TOKEN; optional: GOOGLE_DEMO_CALENDAR_ID (default 'primary').
 * Same GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are used.
 * Call this before creating the DemoBooking so the meeting link is always present.
 */
export const createDemoMeetEvent = async (args: {
    prospectEmail: string;
    prospectName: string;
    start: Date;
    end: Date;
}): Promise<{ meetLink: string; htmlLink: string | null; eventId: string | null }> => {
    const refreshToken = process.env.GOOGLE_DEMO_REFRESH_TOKEN;
    if (!refreshToken) {
        throw new Error('GOOGLE_DEMO_REFRESH_TOKEN is required for demo bookings. Set it in .env to enable demo scheduling.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for demo Meet creation.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, process.env.GOOGLE_REDIRECT_URI);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = process.env.GOOGLE_DEMO_CALENDAR_ID || 'primary';

    const requestId = `demo-${args.start.getTime()}-${args.prospectEmail}`;
    try {
        // Do not add prospect as attendee — we send one confirmation email ourselves.
        // Adding them would trigger a separate Google Calendar invite ("unknown sender").
        const resp = await calendar.events.insert({
            calendarId,
            conferenceDataVersion: 1,
            requestBody: {
                summary: `EmpowerEd Demo – ${args.prospectName}`,
                description: `Demo call with ${args.prospectName} (${args.prospectEmail})`,
                start: { dateTime: args.start.toISOString() },
                end: { dateTime: args.end.toISOString() },
                conferenceData: {
                    createRequest: {
                        requestId,
                        conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                },
            },
        });

        const meetLink = resp.data.hangoutLink;
        if (!meetLink) {
            throw new Error('Google Calendar did not return a Meet link for the demo event.');
        }

        return {
            meetLink,
            htmlLink: resp.data.htmlLink || null,
            eventId: resp.data.id || null,
        };
    } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string }; status?: number }; message?: string };
        const code = err.response?.data?.error;
        const status = err.response?.status;

        if (status === 400 && code === 'invalid_grant') {
            const msg =
                'GOOGLE_DEMO_REFRESH_TOKEN is invalid or expired. ' +
                'Generate a new refresh token using the same GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see server/docs/DEMO_GOOGLE_SETUP.md).';
            console.error('[GoogleCalendar]', msg);
            throw new Error(msg);
        }

        if (status === 401 || code === 'invalid_grant') {
            const msg =
                'Google demo calendar auth failed (invalid_grant or 401). ' +
                'Check that GOOGLE_DEMO_REFRESH_TOKEN was obtained with this app’s GOOGLE_CLIENT_ID/SECRET and re-generate if needed.';
            console.error('[GoogleCalendar]', msg);
            throw new Error(msg);
        }

        throw e;
    }
};

/**
 * Move an existing demo call's calendar event to a new time (admin reschedule).
 * The Meet link is preserved, so the mentor's original link keeps working.
 * Returns null if the event no longer exists (deleted from the calendar) — the caller
 * should then create a fresh event instead.
 */
export const updateDemoMeetEvent = async (args: {
    eventId: string;
    prospectName: string;
    start: Date;
    end: Date;
}): Promise<{ meetLink: string | null; htmlLink: string | null; eventId: string | null } | null> => {
    const refreshToken = process.env.GOOGLE_DEMO_REFRESH_TOKEN;
    if (!refreshToken) {
        throw new Error('GOOGLE_DEMO_REFRESH_TOKEN is required for demo bookings. Set it in .env to enable demo scheduling.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for demo Meet updates.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, process.env.GOOGLE_REDIRECT_URI);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = process.env.GOOGLE_DEMO_CALENDAR_ID || 'primary';

    try {
        const resp = await calendar.events.patch({
            calendarId,
            eventId: args.eventId,
            requestBody: {
                summary: `EmpowerEd Demo – ${args.prospectName}`,
                start: { dateTime: args.start.toISOString() },
                end: { dateTime: args.end.toISOString() },
            },
        });

        return {
            meetLink: resp.data.hangoutLink || null,
            htmlLink: resp.data.htmlLink || null,
            eventId: resp.data.id || null,
        };
    } catch (e: unknown) {
        const err = e as { response?: { status?: number } };
        // 404 (gone) / 410 (cancelled): the event was removed from the calendar.
        if (err.response?.status === 404 || err.response?.status === 410) return null;
        throw e;
    }
};

const DEMO_OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar',
];

/**
 * Build the Google OAuth URL for obtaining a demo refresh token.
 * Use redirectUri = your server's demo callback URL (e.g. https://admin.emplearnings.com/api/demo/oauth-callback).
 */
export function getDemoOAuthAuthUrl(redirectUri: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.');
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: DEMO_OAUTH_SCOPES,
    });
}

/**
 * Exchange the authorization code for tokens and return the refresh token.
 * redirectUri must match the one used in getDemoOAuthAuthUrl.
 */
export async function exchangeDemoOAuthCode(
    code: string,
    redirectUri: string
): Promise<{ refresh_token: string }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.');
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
        throw new Error('Google did not return a refresh token. Try again with prompt=consent (use the oauth-start URL).');
    }
    return { refresh_token: tokens.refresh_token };
}
