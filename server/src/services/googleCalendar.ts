import { google, calendar_v3 } from 'googleapis';
import prisma from '../config/db';
import { decryptString, encryptString } from '../utils/crypto';

/**
 * Google integration.
 *
 * Two kinds of Google access live here:
 *
 * 1. PLATFORM account (emplearnings@gmail.com, `GOOGLE_DEMO_REFRESH_TOKEN`): owns EVERY
 *    Google Meet link the platform hands out — demo calls and mentoring sessions alike.
 *    Session meetings are created through the Google Meet REST API with access type
 *    OPEN, so mentors and students join straight away: nobody has to knock and no host
 *    has to be in the room (the platform account never joins). A Calendar event is also
 *    written to the platform calendar for admin visibility and rescheduling.
 *
 * 2. MENTOR calendar connections (`GoogleCalendarConnection`): optional, used only to read
 *    free/busy so booked-elsewhere time is masked out of a mentor's availability.
 */

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

// ---------------------------------------------------------------------------
// Platform Google account (emplearnings@gmail.com)
// ---------------------------------------------------------------------------

/**
 * Scopes the platform refresh token must carry. The Meet scopes are what allow
 * session meetings to be created with OPEN access (join without knocking).
 * Regenerate GOOGLE_DEMO_REFRESH_TOKEN via /api/demo/oauth-start after changing this list.
 */
const PLATFORM_OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/meetings.space.created',
    'https://www.googleapis.com/auth/meetings.space.settings',
];

const MEET_SCOPES = PLATFORM_OAUTH_SCOPES.filter(s => s.includes('/meetings.'));

const getPlatformOAuthClient = () => {
    const refreshToken = process.env.GOOGLE_DEMO_REFRESH_TOKEN;
    if (!refreshToken) {
        throw new Error('GOOGLE_DEMO_REFRESH_TOKEN is required for Google Meet links (demo calls and sessions). Set it in .env — see server/docs/DEMO_GOOGLE_SETUP.md.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for Google Meet links.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, process.env.GOOGLE_REDIRECT_URI);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
};

const getPlatformCalendarId = () => process.env.GOOGLE_DEMO_CALENDAR_ID || 'primary';

type GoogleApiError = {
    code?: number | string;
    message?: string;
    response?: { status?: number; data?: { error?: string | { message?: string; status?: string }; error_description?: string } };
};

/** One-line, actionable description of a Google API failure for logs. */
const describeGoogleError = (e: unknown): string => {
    const err = (e || {}) as GoogleApiError;
    const status = err.response?.status ?? (typeof err.code === 'number' ? err.code : undefined);
    const data = err.response?.data;
    const oauthCode = typeof data?.error === 'string' ? data.error : undefined;
    const apiMessage = typeof data?.error === 'object' ? data.error?.message : undefined;
    const message = apiMessage || data?.error_description || err.message || String(e);

    if (oauthCode === 'invalid_grant' || /invalid_grant/i.test(message)) {
        return `invalid_grant — GOOGLE_DEMO_REFRESH_TOKEN is invalid, expired or revoked. Regenerate it via /api/demo/oauth-start (${message})`;
    }
    if (/has not been used in project|is disabled|SERVICE_DISABLED|Meet API has not been enabled/i.test(message)) {
        return `Google Meet REST API is not enabled for this Google Cloud project — enable it in the Cloud Console (${message})`;
    }
    if (/insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT|Request had insufficient authentication/i.test(message)) {
        return `refresh token lacks the Google Meet scopes — regenerate GOOGLE_DEMO_REFRESH_TOKEN via /api/demo/oauth-start (${message})`;
    }
    return status ? `HTTP ${status}: ${message}` : message;
};

type MeetSpace = {
    name: string | null;
    meetingUri: string;
    meetingCode: string | null;
    accessType: string | null;
};

/**
 * Create a Google Meet space owned by the platform account with OPEN access:
 * anyone with the link joins immediately, without knocking and without a host present.
 */
const createOpenMeetSpace = async (auth: InstanceType<typeof google.auth.OAuth2>): Promise<MeetSpace> => {
    const meet = google.meet({ version: 'v2', auth });
    const resp = await meet.spaces.create({
        requestBody: {
            config: { accessType: 'OPEN', entryPointAccess: 'ALL' },
        },
    });

    const meetingUri = resp.data.meetingUri;
    if (!meetingUri) throw new Error('Google Meet API returned a space without a meetingUri');

    const accessType = resp.data.config?.accessType || null;
    if (accessType !== 'OPEN') {
        console.warn(`[GoogleMeet] Space ${resp.data.name} was created with accessType=${accessType} although OPEN was requested; participants may have to knock.`);
    }

    return {
        name: resp.data.name || null,
        meetingUri,
        meetingCode: resp.data.meetingCode || null,
        accessType,
    };
};

type LessonMeetArgs = {
    lessonId: string;
    title: string;
    description?: string;
    start: Date;
    end: Date;
    attendeesEmails: string[];
};

type LessonMeetResult = {
    eventId: string | null;
    htmlLink: string | null;
    meetLink: string | null;
    /** Meet access type actually applied (OPEN = join without knocking); null when the Calendar fallback was used. */
    accessType: string | null;
};

/**
 * Create the Meet link + platform calendar event for a session.
 *
 * Preferred path: OPEN-access Meet space (Meet REST API) attached to a Calendar event.
 * Fallback path (Meet API unavailable — not enabled, scopes missing): a Calendar-generated
 * Meet link. That link still works, but uninvited participants must knock, so the fallback
 * is logged loudly.
 */
const createPlatformMeetEventForLesson = async (args: LessonMeetArgs): Promise<LessonMeetResult> => {
    const auth = getPlatformOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = getPlatformCalendarId();

    let space: MeetSpace | null = null;
    try {
        space = await createOpenMeetSpace(auth);
    } catch (e) {
        console.error(`[GoogleMeet] Open-access space creation failed for lesson ${args.lessonId}: ${describeGoogleError(e)}. Falling back to a Calendar-generated Meet link (participants may have to knock).`);
    }

    const baseEvent: calendar_v3.Schema$Event = {
        summary: args.title,
        description: args.description,
        start: { dateTime: args.start.toISOString() },
        end: { dateTime: args.end.toISOString() },
        attendees: args.attendeesEmails.map(email => ({ email })),
    };

    if (space) {
        const description = `${args.description || ''}\n\nGoogle Meet: ${space.meetingUri}`.trim();

        // Attach the existing space to the event so it shows as a proper Meet conference.
        try {
            const resp = await calendar.events.insert({
                calendarId,
                conferenceDataVersion: 1,
                requestBody: {
                    ...baseEvent,
                    description,
                    location: space.meetingUri,
                    conferenceData: {
                        conferenceId: space.meetingCode || undefined,
                        conferenceSolution: { key: { type: 'hangoutsMeet' }, name: 'Google Meet' },
                        entryPoints: [{
                            entryPointType: 'video',
                            uri: space.meetingUri,
                            label: space.meetingUri.replace(/^https?:\/\//, ''),
                        }],
                    },
                },
            });
            return {
                eventId: resp.data.id || null,
                htmlLink: resp.data.htmlLink || null,
                meetLink: space.meetingUri,
                accessType: space.accessType,
            };
        } catch (e) {
            console.warn(`[GoogleCalendar] Event insert with attached Meet space failed for lesson ${args.lessonId} (${describeGoogleError(e)}); retrying without conferenceData.`);
        }

        try {
            const resp = await calendar.events.insert({
                calendarId,
                requestBody: { ...baseEvent, description, location: space.meetingUri },
            });
            return {
                eventId: resp.data.id || null,
                htmlLink: resp.data.htmlLink || null,
                meetLink: space.meetingUri,
                accessType: space.accessType,
            };
        } catch (e) {
            console.error(`[GoogleCalendar] Calendar event creation failed for lesson ${args.lessonId} (${describeGoogleError(e)}); keeping the Meet link without a calendar event.`);
            return { eventId: null, htmlLink: null, meetLink: space.meetingUri, accessType: space.accessType };
        }
    }

    const resp = await calendar.events.insert({
        calendarId,
        conferenceDataVersion: 1,
        requestBody: {
            ...baseEvent,
            conferenceData: {
                createRequest: {
                    requestId: `lesson-${args.lessonId}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            },
        },
    });

    return {
        eventId: resp.data.id || null,
        htmlLink: resp.data.htmlLink || null,
        meetLink: resp.data.hangoutLink || null,
        accessType: null,
    };
};

/**
 * THE single entry point for session meeting links. Creates the Meet link (and platform
 * calendar event) for a lesson if it does not have one yet, stores it on the lesson and
 * returns it. Safe to call repeatedly from booking, webhooks, the wallet flow, the
 * scheduler backfill, join and "send link" — returns the link or null (never throws).
 */
export const ensureMeetLinkForLesson = async (lessonId: string): Promise<string | null> => {
    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
            tutor: { select: { id: true, username: true, user: { select: { email: true } } } },
            student: { select: { user: { select: { email: true } } } },
        },
    });
    if (!lesson) return null;
    if (lesson.meeting_link) return lesson.meeting_link;
    if (lesson.status === 'CANCELLED' || lesson.status === 'MISSED') return null;

    const attendees = [lesson.student?.user?.email, lesson.tutor?.user?.email].filter(Boolean) as string[];
    const mentorName = lesson.tutor?.username || 'your mentor';
    const isIntro = lesson.billing_type === 'FREE_INTRO';

    let event: LessonMeetResult;
    try {
        event = await createPlatformMeetEventForLesson({
            lessonId: lesson.id,
            title: isIntro ? `Free intro session with ${mentorName}` : `Mentoring Session with ${mentorName}`,
            description: isIntro
                ? `Free ${lesson.duration}-minute introductory session via Empowered Learnings`
                : 'Scheduled via Empowered Learnings',
            start: lesson.start_time,
            end: lesson.end_time,
            attendeesEmails: attendees,
        });
    } catch (e) {
        console.error(`[GoogleMeet] Could not create a meeting link for lesson ${lesson.id}: ${describeGoogleError(e)}`);
        return null;
    }

    if (!event.meetLink && !event.eventId && !event.htmlLink) return null;

    await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
            meeting_link: event.meetLink || undefined,
            google_calendar_event_id: event.eventId || undefined,
            google_calendar_html_link: event.htmlLink || undefined,
        },
    });

    console.log(`[GoogleMeet] Lesson ${lesson.id}: meeting link ready (access=${event.accessType || 'calendar-fallback'})`);
    return event.meetLink || null;
};

/**
 * Move a session's platform calendar event to a new time (student reschedule).
 * The Meet link is preserved. Returns null if the event no longer exists (non-fatal).
 */
export const updateMeetEventForLesson = async (args: {
    eventId: string;
    start: Date;
    end: Date;
}) => {
    const auth = getPlatformOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    try {
        const resp = await calendar.events.patch({
            calendarId: getPlatformCalendarId(),
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
    } catch (e: unknown) {
        const status = (e as GoogleApiError).response?.status;
        // 404 (gone) / 410 (cancelled): the event was removed from the calendar.
        if (status === 404 || status === 410) return null;
        throw e;
    }
};

/**
 * Health check for the platform Google account, logged once at startup so an operator
 * sees immediately whether session Meet links will be OPEN-access (no knocking) or not.
 * Never throws.
 */
export const logPlatformGoogleStatus = async (): Promise<void> => {
    if (!process.env.GOOGLE_DEMO_REFRESH_TOKEN) {
        console.warn('[GoogleMeet] GOOGLE_DEMO_REFRESH_TOKEN is not set — demo calls and session meeting links will fail. See server/docs/DEMO_GOOGLE_SETUP.md.');
        return;
    }
    try {
        const auth = getPlatformOAuthClient();
        const { token } = await auth.getAccessToken();
        if (!token) throw new Error('No access token returned');

        const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`)
            .then(r => r.json() as Promise<{ scope?: string; email?: string }>);
        const granted = new Set((info.scope || '').split(/\s+/).filter(Boolean));
        const missing = MEET_SCOPES.filter(s => !granted.has(s));

        if (missing.length === 0) {
            console.log(`[GoogleMeet] Platform Google token OK${info.email ? ` (${info.email})` : ''}; session Meet links will use OPEN access (no knocking).`);
        } else {
            console.warn(`[GoogleMeet] Platform Google token is missing the Meet scopes (${missing.join(', ')}). Session links will fall back to Calendar-generated Meet links where uninvited participants must knock. Regenerate GOOGLE_DEMO_REFRESH_TOKEN via /api/demo/oauth-start.`);
        }
    } catch (e) {
        console.warn(`[GoogleMeet] Platform Google token check failed: ${describeGoogleError(e)}`);
    }
};

// ---------------------------------------------------------------------------
// Demo calls (EmpowerEd team with a prospect) — same platform account
// ---------------------------------------------------------------------------

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
    const oauth2Client = getPlatformOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = getPlatformCalendarId();

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
    const oauth2Client = getPlatformOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = getPlatformCalendarId();

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

/**
 * Build the Google OAuth URL for obtaining the platform refresh token
 * (GOOGLE_DEMO_REFRESH_TOKEN — used for demo calls AND session Meet links).
 * Use redirectUri = your server's demo callback URL (e.g. https://emplearnings.com/api/demo/oauth-callback).
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
        scope: PLATFORM_OAUTH_SCOPES,
    });
}

/**
 * Exchange the authorization code for tokens and return the refresh token.
 * redirectUri must match the one used in getDemoOAuthAuthUrl.
 */
export async function exchangeDemoOAuthCode(
    code: string,
    redirectUri: string
): Promise<{ refresh_token: string; granted_scopes: string[]; missing_meet_scopes: string[] }> {
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
    const grantedScopes = typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/).filter(Boolean) : [];
    const missingMeetScopes = grantedScopes.length > 0 ? MEET_SCOPES.filter(s => !grantedScopes.includes(s)) : [];
    return { refresh_token: tokens.refresh_token, granted_scopes: grantedScopes, missing_meet_scopes: missingMeetScopes };
}
