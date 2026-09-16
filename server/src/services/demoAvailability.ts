import prisma from '../config/db';

export const ADMIN_TIMEZONE = 'America/Chicago';
export const SLOT_DURATION_MINUTES = 20;

/** True when `tz` is an IANA timezone the runtime can format with (e.g. "Asia/Muscat"). */
export function isValidTimezone(tz: unknown): tz is string {
    if (typeof tz !== 'string' || !tz.trim()) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

/** Resolve the timezone a prospect booked in, falling back to the admin's zone for legacy rows. */
export function resolveDemoTimezone(tz: string | null | undefined): string {
    return isValidTimezone(tz) ? tz : ADMIN_TIMEZONE;
}

/** Human label for a timezone, e.g. "Muscat (GMT+4)" or "Chicago (CDT)". */
export function formatTimezoneLabel(timeZone: string): string {
    try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(new Date());
        const abbr = parts.find((p) => p.type === 'timeZoneName')?.value;
        const city = timeZone.split('/').pop()?.replace(/_/g, ' ') || timeZone;
        return abbr ? `${city} (${abbr})` : city;
    } catch {
        return timeZone;
    }
}

/**
 * Date + time strings for a demo slot in the given timezone. The time carries the zone
 * abbreviation ("10:00 AM GMT+4") so an email never reads as ambiguous.
 */
export function formatDemoSlot(d: Date, timeZone: string): { date: string; time: string; timezoneLabel: string } {
    const tz = resolveDemoTimezone(timeZone);
    return {
        date: d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        time: d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }),
        timezoneLabel: formatTimezoneLabel(tz),
    };
}

const ADMIN_START_HOUR = 9;

function secondSundayMarch(year: number): Date {
    const march1 = new Date(Date.UTC(year, 2, 1));
    const day = march1.getUTCDay();
    const firstSunday = 1 + (7 - day) % 7;
    const secondSunday = firstSunday + 7;
    return new Date(Date.UTC(year, 2, secondSunday, 10, 0, 0));
}

function firstSundayNovember(year: number): Date {
    const nov1 = new Date(Date.UTC(year, 10, 1));
    const day = nov1.getUTCDay();
    const firstSunday = 1 + (7 - day) % 7;
    return new Date(Date.UTC(year, 10, firstSunday, 9, 0, 0));
}

function isDSTChicago(year: number, month: number, day: number): boolean {
    const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
    return d >= secondSundayMarch(year) && d < firstSundayNovember(year);
}

function getChicagoStartUTC(date: Date): Date {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    const dst = isDSTChicago(y, m, d);
    const utcHour = ADMIN_START_HOUR + (dst ? 5 : 6);
    return new Date(Date.UTC(y, m, d, utcHour, 0, 0));
}

/** Convert Chicago local time (HH:MM) on the given UTC date to a UTC Date. */
export function chicagoTimeToUTC(cursor: Date, timeStr: string): Date {
    const [h, m] = timeStr.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return new Date(0);
    const nineAmUTC = getChicagoStartUTC(new Date(cursor));
    const minutesFromMidnight = h * 60 + m;
    const minutesFromNine = minutesFromMidnight - ADMIN_START_HOUR * 60;
    return new Date(nineAmUTC.getTime() + minutesFromNine * 60 * 1000);
}

export function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
    return aStart < bEnd && bStart < aEnd;
}

export type DemoSlot = { start: string; end: string };

/**
 * Open demo slots between `from` and `to`, derived from admin availability windows
 * minus admin time blocks and slots already taken by a demo booking.
 *
 * `excludeBookingId` keeps a booking's own slot in the list — used when rescheduling,
 * so the admin can see (and re-pick) the time the booking currently occupies.
 */
export async function getAvailableDemoSlots(
    from: Date,
    to: Date,
    excludeBookingId?: string
): Promise<DemoSlot[]> {
    const now = new Date();
    const toEnd = new Date(to.getTime() + 24 * 60 * 60 * 1000);

    const [availabilityRules, blocks, booked] = await Promise.all([
        prisma.adminDemoAvailability.findMany({ orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }] }),
        prisma.adminDemoTimeBlock.findMany({
            where: { start_time: { lt: toEnd }, end_time: { gt: from } },
            select: { start_time: true, end_time: true },
        }),
        prisma.demoBooking.findMany({
            where: {
                slot_start_time: { gte: from },
                slot_end_time: { lte: toEnd },
                ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
            },
            select: { slot_start_time: true, slot_end_time: true },
        }),
    ]);

    const slots: DemoSlot[] = [];
    const cursor = new Date(from);
    cursor.setUTCHours(0, 0, 0, 0);

    while (cursor <= to) {
        const dayOfWeek = cursor.getUTCDay();
        const windows = availabilityRules.filter((r) => r.day_of_week === dayOfWeek);

        for (const w of windows) {
            const windowStart = chicagoTimeToUTC(cursor, w.start_time);
            const windowEnd = chicagoTimeToUTC(cursor, w.end_time);
            if (windowStart >= windowEnd) continue;

            let slotStart = new Date(windowStart);
            while (slotStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000 <= windowEnd.getTime()) {
                const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
                const isPast = slotEnd.getTime() <= now.getTime();
                const inRange = slotStart >= from && slotEnd <= toEnd;
                if (!isPast && inRange) {
                    const blocked = blocks.some((b) => overlap(slotStart, slotEnd, b.start_time, b.end_time));
                    const alreadyBooked = booked.some((b) =>
                        overlap(slotStart, slotEnd, b.slot_start_time, b.slot_end_time)
                    );
                    if (!blocked && !alreadyBooked) {
                        slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
                    }
                }
                slotStart = slotEnd;
            }
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return slots;
}

export type SlotCheckResult = { ok: true } | { ok: false; error: string };

/**
 * Validate a slot an admin picked when rescheduling.
 * Always rejects past times, admin time blocks and clashes with other demo bookings.
 * With `allowOutsideHours`, the slot may sit outside the configured availability windows
 * (for when a mentor asks for a time the public booking page does not offer).
 */
export async function checkDemoSlotAvailable(args: {
    start: Date;
    end: Date;
    excludeBookingId?: string;
    allowOutsideHours?: boolean;
}): Promise<SlotCheckResult> {
    const { start, end, excludeBookingId, allowOutsideHours } = args;

    if (start.getTime() <= Date.now()) {
        return { ok: false, error: 'Pick a time in the future.' };
    }

    const [block, clash] = await Promise.all([
        prisma.adminDemoTimeBlock.findFirst({
            where: { start_time: { lt: end }, end_time: { gt: start } },
            select: { id: true },
        }),
        prisma.demoBooking.findFirst({
            where: {
                slot_start_time: { lt: end },
                slot_end_time: { gt: start },
                ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
            },
            select: { id: true },
        }),
    ]);

    if (block) return { ok: false, error: 'That time falls inside a blocked period in Demo Availability.' };
    if (clash) return { ok: false, error: 'Another demo call is already booked at that time.' };

    if (allowOutsideHours) return { ok: true };

    const dayStart = new Date(start);
    dayStart.setUTCHours(0, 0, 0, 0);
    const slots = await getAvailableDemoSlots(dayStart, dayStart, excludeBookingId);
    const isOpenSlot = slots.some((s) => new Date(s.start).getTime() === start.getTime());
    if (!isOpenSlot) {
        return {
            ok: false,
            error: 'That time is outside your demo availability hours. Tick "Allow a time outside availability hours" to book it anyway.',
        };
    }

    return { ok: true };
}
