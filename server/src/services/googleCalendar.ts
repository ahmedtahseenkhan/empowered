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
 * Create a Google Meet link for a demo call (EmpowerEd team with prospect).
 * Uses optional env: GOOGLE_DEMO_REFRESH_TOKEN, GOOGLE_DEMO_CALENDAR_ID (default 'primary').
 * Same GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are used.
 */
export const createDemoMeetEvent = async (args: {
    demoBookingId: string;
    prospectEmail: string;
    prospectName: string;
    start: Date;
    end: Date;
}): Promise<{ meetLink: string | null; htmlLink: string | null } | null> => {
    const refreshToken = process.env.GOOGLE_DEMO_REFRESH_TOKEN;
    if (!refreshToken) {
        console.warn('[GoogleCalendar] GOOGLE_DEMO_REFRESH_TOKEN not set; skipping demo Meet creation.');
        return null;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        console.warn('[GoogleCalendar] GOOGLE_CLIENT_ID/SECRET not set; skipping demo Meet creation.');
        return null;
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, process.env.GOOGLE_REDIRECT_URI);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = process.env.GOOGLE_DEMO_CALENDAR_ID || 'primary';

    const requestId = `demo-${args.demoBookingId}`;
    try {
        const resp = await calendar.events.insert({
            calendarId,
            conferenceDataVersion: 1,
            requestBody: {
                summary: `EmpowerEd Demo – ${args.prospectName}`,
                description: `Demo call with ${args.prospectName} (${args.prospectEmail})`,
                start: { dateTime: args.start.toISOString() },
                end: { dateTime: args.end.toISOString() },
                attendees: [{ email: args.prospectEmail }],
                conferenceData: {
                    createRequest: {
                        requestId,
                        conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                },
            },
        });

        return {
            meetLink: resp.data.hangoutLink || null,
            htmlLink: resp.data.htmlLink || null,
        };
    } catch (e) {
        console.error('[GoogleCalendar] Demo Meet creation failed:', e);
        return null;
    }
};
