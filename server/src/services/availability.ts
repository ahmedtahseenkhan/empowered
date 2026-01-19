import prisma from '../config/db';
import { getFreeBusy } from './googleCalendar';

export type Interval = { start: Date; end: Date };

const timeStrToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
};

const addMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60 * 1000);

const overlap = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

const isSlotFree = (slot: Interval, blocks: Interval[]) => {
    for (const b of blocks) {
        if (overlap(slot, b)) return false;
    }
    return true;
};

const getBlocks = async (tutorId: string, from: Date, to: Date): Promise<Interval[]> => {
    const blocks: Interval[] = [];

    const lessons = await prisma.lesson.findMany({
        where: {
            tutor_id: tutorId,
            start_time: { lt: to },
            end_time: { gt: from },
            status: { not: 'CANCELLED' as any },
        },
        select: { start_time: true, end_time: true },
    });

    for (const l of lessons) blocks.push({ start: l.start_time, end: l.end_time });

    const timeBlocks = await prisma.tutorTimeBlock.findMany({
        where: {
            tutor_id: tutorId,
            start_time: { lt: to },
            end_time: { gt: from },
        },
        select: { start_time: true, end_time: true },
    });

    for (const b of timeBlocks) blocks.push({ start: b.start_time, end: b.end_time });

    const busy = await getFreeBusy(tutorId, from.toISOString(), to.toISOString());
    if (busy) {
        for (const b of busy) {
            if (b.start && b.end) blocks.push({ start: new Date(b.start), end: new Date(b.end) });
        }
    }

    return blocks;
};

const weekdayToIndex = (weekday: string) => {
    const map: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
    };
    return map[weekday] ?? null;
};

const getZonedDayAndMinutes = (d: Date, timeZone: string) => {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });

    const parts = fmt.formatToParts(d);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hourStr = parts.find((p) => p.type === 'hour')?.value;
    const minuteStr = parts.find((p) => p.type === 'minute')?.value;

    if (!weekday || !hourStr || !minuteStr) return null;

    const dayOfWeek = weekdayToIndex(weekday);
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (dayOfWeek === null || Number.isNaN(hour) || Number.isNaN(minute)) return null;

    return { dayOfWeek, minutesOfDay: hour * 60 + minute };
};

export const computeTutorAvailabilitySlots = async (args: {
    tutorId: string;
    from: Date;
    to: Date;
    durationMinutes: number;
    stepMinutes: number;
}) => {
    const tutor = await prisma.tutorProfile.findUnique({ where: { id: args.tutorId }, select: { timezone: true } });
    const timeZone = tutor?.timezone || 'UTC';

    const availabilityRules = await prisma.availability.findMany({
        where: { tutor_id: args.tutorId },
        orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }]
    });

    const blocks = await getBlocks(args.tutorId, args.from, args.to);

    const slots: { start: string; end: string }[] = [];

    const cursor = new Date(args.from);
    cursor.setSeconds(0, 0);

    while (cursor < args.to) {
        const zoned = getZonedDayAndMinutes(cursor, timeZone);
        if (!zoned) {
            cursor.setTime(cursor.getTime() + args.stepMinutes * 60 * 1000);
            continue;
        }

        const dayOfWeek = zoned.dayOfWeek;
        let minutesOfDay = zoned.minutesOfDay;

        // Align to step boundary relative to midnight in tutor timezone
        const remainder = minutesOfDay % args.stepMinutes;
        if (remainder !== 0) {
            const advance = args.stepMinutes - remainder;
            cursor.setTime(cursor.getTime() + advance * 60 * 1000);
            // recompute zoned values after advancing
            const z2 = getZonedDayAndMinutes(cursor, timeZone);
            if (!z2) {
                continue;
            }
            minutesOfDay = z2.minutesOfDay;
        }

        for (const rule of availabilityRules) {
            if (rule.day_of_week !== dayOfWeek) continue;

            const startMin = timeStrToMinutes(rule.start_time);
            const endMin = timeStrToMinutes(rule.end_time);
            if (startMin === null || endMin === null) continue;

            if (minutesOfDay < startMin || minutesOfDay + args.durationMinutes > endMin) continue;

            const slot: Interval = {
                start: new Date(cursor),
                end: addMinutes(cursor, args.durationMinutes)
            };

            if (slot.end <= args.to && isSlotFree(slot, blocks)) {
                slots.push({ start: slot.start.toISOString(), end: slot.end.toISOString() });
            }
        }

        cursor.setTime(cursor.getTime() + args.stepMinutes * 60 * 1000);
    }

    return { slots };
};

export const isTutorSlotAvailable = async (args: {
    tutorId: string;
    start: Date;
    end: Date;
}) => {
    if (args.start >= args.end) return false;

    const tutor = await prisma.tutorProfile.findUnique({ where: { id: args.tutorId }, select: { timezone: true } });
    const timeZone = tutor?.timezone || 'UTC';

    const startZoned = getZonedDayAndMinutes(args.start, timeZone);
    const endZoned = getZonedDayAndMinutes(args.end, timeZone);
    if (!startZoned || !endZoned) return false;

    // Check within weekly availability window (tutor timezone)
    const dayOfWeek = startZoned.dayOfWeek;
    const startMinutes = startZoned.minutesOfDay;
    const endMinutes = endZoned.minutesOfDay;

    const rules = await prisma.availability.findMany({
        where: { tutor_id: args.tutorId, day_of_week: dayOfWeek },
    });

    const insideRule = rules.some(r => {
        const rStart = timeStrToMinutes(r.start_time);
        const rEnd = timeStrToMinutes(r.end_time);
        if (rStart === null || rEnd === null) return false;
        return startMinutes >= rStart && endMinutes <= rEnd;
    });

    if (!insideRule) return false;

    const blocks = await getBlocks(args.tutorId, args.start, args.end);
    return isSlotFree({ start: args.start, end: args.end }, blocks);
};
