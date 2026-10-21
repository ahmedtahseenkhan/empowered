import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { WalletError } from './walletService';
import { ensureMeetLinkForLesson } from './googleCalendar';
import { lockTutorSchedule } from './availability';

/**
 * Custom sessions: a mentor schedules a FREE session (make-up for a missed one, or an extra)
 * with one of their own students, who accepts or declines it. The request is a Lesson with
 * origin = MENTOR_OFFER:
 *
 *   PENDING  -> waiting for the student's answer (expires automatically)
 *   BOOKED   -> student accepted; from here on it behaves like any booked session
 *              (Meet link, reminders, join, completion)
 *   CANCELLED-> declined / withdrawn / expired / cancelled, with cancel_reason saying which
 *
 * The platform is not involved in any payment: billing_type = CUSTOM_FREE, no booking, no
 * reservation, no credits are taken from the student and no earnings are recorded for the mentor.
 */

export const CUSTOM_SESSION_RULES = {
    /** Hours a student has to respond before the offer expires (also capped at the start time). */
    offerExpiryHours: Number(process.env.CUSTOM_SESSION_OFFER_EXPIRY_HOURS || 48),
    /** Earliest start, in hours from now, a mentor may offer. */
    minNoticeHours: Number(process.env.CUSTOM_SESSION_MIN_NOTICE_HOURS || 2),
    /** Allowed durations in minutes. */
    durations: (process.env.CUSTOM_SESSION_DURATIONS || '30,45,60')
        .split(',').map((v) => Number(v.trim())).filter((v) => Number.isInteger(v) && v > 0),
    /** Open (PENDING) offers a mentor may have with one student at a time. */
    maxOpenOffersPerStudent: Number(process.env.CUSTOM_SESSION_MAX_OPEN_OFFERS || 3),
};

export type CustomKind = 'MAKEUP' | 'EXTRA';

export const publicCustomSessionRules = () => ({
    offerExpiryHours: CUSTOM_SESSION_RULES.offerExpiryHours,
    minNoticeHours: CUSTOM_SESSION_RULES.minNoticeHours,
    durations: CUSTOM_SESSION_RULES.durations,
    maxOpenOffersPerStudent: CUSTOM_SESSION_RULES.maxOpenOffersPerStudent,
});

const OFFER_INCLUDE = {
    tutor: { select: { id: true, username: true, user: { select: { email: true } } } },
    student: { select: { id: true, username: true, user: { select: { email: true } } } },
    makeup_for: { select: { id: true, start_time: true, status: true } },
} as const;

/** Students this mentor has worked with: anyone with a lesson or booking with them. */
export async function listMentorStudents(tutorId: string) {
    const [lessonStudents, bookingStudents] = await Promise.all([
        prisma.lesson.groupBy({
            by: ['student_id'],
            where: { tutor_id: tutorId },
            _max: { start_time: true },
        }),
        prisma.booking.findMany({
            where: { tutor_id: tutorId },
            select: { student_id: true, created_at: true },
        }),
    ]);

    const lastSeen = new Map<string, Date>();
    for (const r of lessonStudents) {
        const d = r._max.start_time;
        if (d && (!lastSeen.has(r.student_id) || d > (lastSeen.get(r.student_id) as Date))) lastSeen.set(r.student_id, d);
        else if (!lastSeen.has(r.student_id)) lastSeen.set(r.student_id, d || new Date(0));
    }
    for (const b of bookingStudents) {
        if (!lastSeen.has(b.student_id)) lastSeen.set(b.student_id, b.created_at);
    }
    if (lastSeen.size === 0) return [];

    const students = await prisma.studentProfile.findMany({
        where: { id: { in: [...lastSeen.keys()] } },
        select: { id: true, username: true, user: { select: { email: true } } },
    });

    return students
        .map((s) => ({ id: s.id, username: s.username, last_session_at: lastSeen.get(s.id) || null }))
        .sort((a, b) => (b.last_session_at?.getTime() || 0) - (a.last_session_at?.getTime() || 0));
}

const isMentorsStudent = async (tutorId: string, studentId: string) => {
    const [lesson, booking] = await Promise.all([
        prisma.lesson.findFirst({ where: { tutor_id: tutorId, student_id: studentId }, select: { id: true } }),
        prisma.booking.findFirst({ where: { tutor_id: tutorId, student_id: studentId }, select: { id: true } }),
    ]);
    return !!(lesson || booking);
};

/** Any non-cancelled lesson (for either party) or mentor time block overlapping [start, end). */
const findConflict = async (
    args: { tutorId: string; studentId: string; start: Date; end: Date; excludeLessonId?: string },
    db: Prisma.TransactionClient = prisma,
) => {
    const overlap = { start_time: { lt: args.end }, end_time: { gt: args.start }, status: { not: 'CANCELLED' as const } };
    const tutorLesson = await db.lesson.findFirst({
        where: { tutor_id: args.tutorId, ...overlap, ...(args.excludeLessonId ? { id: { not: args.excludeLessonId } } : {}) },
        select: { id: true },
    });
    const studentLesson = await db.lesson.findFirst({
        where: { student_id: args.studentId, ...overlap, ...(args.excludeLessonId ? { id: { not: args.excludeLessonId } } : {}) },
        select: { id: true },
    });
    const block = await db.tutorTimeBlock.findFirst({
        where: { tutor_id: args.tutorId, start_time: { lt: args.end }, end_time: { gt: args.start } },
        select: { id: true },
    });
    if (tutorLesson) return 'You already have a session at that time.';
    if (block) return 'That time is blocked in your schedule.';
    if (studentLesson) return 'The student already has a session at that time.';
    return null;
};

const queueEmail = async (type: string, toEmail: string | null | undefined, payload: Prisma.InputJsonObject, key: string) => {
    if (!toEmail) return;
    await prisma.emailOutbox.createMany({
        data: [{ type, to_email: toEmail, payload, idempotency_key: key }],
        skipDuplicates: true,
    });
};

export async function createOffer(args: {
    tutorId: string;
    studentId: string;
    startTime: Date;
    durationMinutes: number;
    kind: CustomKind;
    makeupForLessonId?: string | null;
    message?: string | null;
}) {
    const { tutorId, studentId, startTime, durationMinutes, kind } = args;
    if (Number.isNaN(startTime.getTime())) throw new WalletError('A valid start time is required');
    if (!CUSTOM_SESSION_RULES.durations.includes(durationMinutes)) {
        throw new WalletError(`Duration must be one of ${CUSTOM_SESSION_RULES.durations.join(', ')} minutes`);
    }
    if (kind !== 'MAKEUP' && kind !== 'EXTRA') throw new WalletError('Session type must be MAKEUP or EXTRA');

    const minStart = new Date(Date.now() + CUSTOM_SESSION_RULES.minNoticeHours * 3600 * 1000);
    if (startTime < minStart) {
        throw new WalletError(`The session must start at least ${CUSTOM_SESSION_RULES.minNoticeHours} hours from now`);
    }
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    if (!(await isMentorsStudent(tutorId, studentId))) {
        throw new WalletError('You can only schedule sessions with students who have booked with you', 403);
    }

    const openOffers = await prisma.lesson.count({
        where: { tutor_id: tutorId, student_id: studentId, origin: 'MENTOR_OFFER', status: 'PENDING' },
    });
    if (openOffers >= CUSTOM_SESSION_RULES.maxOpenOffersPerStudent) {
        throw new WalletError(`This student already has ${openOffers} session(s) from you waiting for their answer. Wait for a response first.`);
    }

    let makeupForLessonId: string | null = null;
    if (kind === 'MAKEUP' && args.makeupForLessonId) {
        const original = await prisma.lesson.findUnique({
            where: { id: args.makeupForLessonId },
            select: { id: true, tutor_id: true, student_id: true, status: true },
        });
        if (!original || original.tutor_id !== tutorId || original.student_id !== studentId) {
            throw new WalletError('The original session does not belong to you and this student');
        }
        if (original.status !== 'MISSED' && original.status !== 'CANCELLED') {
            throw new WalletError('A make-up can only be offered for a missed or cancelled session');
        }
        makeupForLessonId = original.id;
    }

    const conflict = await findConflict({ tutorId, studentId, start: startTime, end: endTime });
    if (conflict) throw new WalletError(conflict, 409);

    const expiresAt = new Date(Math.min(startTime.getTime(), Date.now() + CUSTOM_SESSION_RULES.offerExpiryHours * 3600 * 1000));
    const message = (args.message || '').trim().slice(0, 500) || null;

    const lesson = await prisma.$transaction(async (tx) => {
        await lockTutorSchedule(tx, tutorId);
        const raced = await findConflict({ tutorId, studentId, start: startTime, end: endTime }, tx);
        if (raced) throw new WalletError(raced, 409);
        return tx.lesson.create({
            data: {
                tutor_id: tutorId,
                student_id: studentId,
                start_time: startTime,
                end_time: endTime,
                duration: durationMinutes,
                status: 'PENDING',
                billing_type: 'CUSTOM_FREE',
                origin: 'MENTOR_OFFER',
                custom_kind: kind,
                makeup_for_lesson_id: makeupForLessonId,
                offer_message: message,
                offer_expires_at: expiresAt,
            },
            include: OFFER_INCLUDE,
        });
    });

    await queueEmail('SESSION_OFFER_STUDENT', lesson.student.user.email, { lessonId: lesson.id }, `session-offer:${lesson.id}`);
    return lesson;
}

export async function respondToOffer(args: { lessonId: string; studentId: string; action: 'accept' | 'decline' }) {
    const lesson = await prisma.lesson.findUnique({ where: { id: args.lessonId }, include: OFFER_INCLUDE });
    if (!lesson || lesson.origin !== 'MENTOR_OFFER') throw new WalletError('Session not found', 404);
    if (lesson.student_id !== args.studentId) throw new WalletError('Forbidden', 403);
    if (lesson.status !== 'PENDING') throw new WalletError('This session request is no longer open');

    if (lesson.offer_expires_at && lesson.offer_expires_at.getTime() < Date.now()) {
        await closeOffer(lesson.id, 'Expired — no response');
        throw new WalletError('This session request has expired');
    }

    if (args.action === 'decline') {
        const updated = await prisma.lesson.update({
            where: { id: lesson.id },
            data: { status: 'CANCELLED', cancel_reason: 'Declined by student', offer_responded_at: new Date() },
            include: OFFER_INCLUDE,
        });
        await queueEmail('CUSTOM_SESSION_CLOSED', lesson.tutor.user.email,
            { lessonId: lesson.id, role: 'tutor', reason: 'declined' }, `custom-closed:${lesson.id}:tutor`);
        return updated;
    }

    const conflict = await findConflict({
        tutorId: lesson.tutor_id, studentId: lesson.student_id,
        start: lesson.start_time, end: lesson.end_time, excludeLessonId: lesson.id,
    });
    if (conflict) throw new WalletError(`This time is no longer available: ${conflict.replace(/^You /, 'The mentor ')}`, 409);

    const updated = await prisma.$transaction(async (tx) => {
        await lockTutorSchedule(tx, lesson.tutor_id);
        const raced = await findConflict({
            tutorId: lesson.tutor_id, studentId: lesson.student_id,
            start: lesson.start_time, end: lesson.end_time, excludeLessonId: lesson.id,
        }, tx);
        if (raced) throw new WalletError(`This time is no longer available: ${raced.replace(/^You /, 'The mentor ')}`, 409);
        const accepted = await tx.lesson.updateMany({
            where: { id: lesson.id, status: 'PENDING' },
            data: { status: 'BOOKED', offer_responded_at: new Date() },
        });
        if (accepted.count !== 1) throw new WalletError('This session request is no longer open');
        return tx.lesson.findUniqueOrThrow({ where: { id: lesson.id }, include: OFFER_INCLUDE });
    });

    try {
        await ensureMeetLinkForLesson(updated.id);
    } catch (e) {
        console.error(`[CustomSession] Meet link for ${updated.id} failed (non-fatal):`, e);
    }

    await queueEmail('CUSTOM_SESSION_CONFIRMED', lesson.student.user.email, { lessonId: lesson.id, role: 'student' }, `custom-confirmed:${lesson.id}:student`);
    await queueEmail('CUSTOM_SESSION_CONFIRMED', lesson.tutor.user.email, { lessonId: lesson.id, role: 'tutor' }, `custom-confirmed:${lesson.id}:tutor`);
    return updated;
}

export async function withdrawOffer(args: { lessonId: string; tutorId: string }) {
    const lesson = await prisma.lesson.findUnique({ where: { id: args.lessonId }, include: OFFER_INCLUDE });
    if (!lesson || lesson.origin !== 'MENTOR_OFFER') throw new WalletError('Session not found', 404);
    if (lesson.tutor_id !== args.tutorId) throw new WalletError('Forbidden', 403);
    if (lesson.status !== 'PENDING') throw new WalletError('Only a session the student has not answered yet can be withdrawn');

    const updated = await prisma.lesson.update({
        where: { id: lesson.id },
        data: { status: 'CANCELLED', cancel_reason: 'Withdrawn by mentor', offer_responded_at: new Date() },
        include: OFFER_INCLUDE,
    });
    await queueEmail('CUSTOM_SESSION_CLOSED', lesson.student.user.email,
        { lessonId: lesson.id, role: 'student', reason: 'withdrawn' }, `custom-closed:${lesson.id}:student`);
    return updated;
}

/** Cancel a confirmed custom session; the other side is told by email. */
export async function cancelCustomSession(args: { lessonId: string; actor: 'TUTOR' | 'STUDENT'; profileId: string }) {
    const lesson = await prisma.lesson.findUnique({ where: { id: args.lessonId }, include: OFFER_INCLUDE });
    if (!lesson || lesson.origin !== 'MENTOR_OFFER') throw new WalletError('Session not found', 404);
    const owner = args.actor === 'TUTOR' ? lesson.tutor_id : lesson.student_id;
    if (owner !== args.profileId) throw new WalletError('Forbidden', 403);
    if (lesson.status !== 'BOOKED') throw new WalletError('Only a confirmed session can be cancelled');
    if (lesson.end_time.getTime() < Date.now()) throw new WalletError('This session has already ended');

    const reason = args.actor === 'TUTOR' ? 'Cancelled by mentor' : 'Cancelled by student';
    const updated = await prisma.lesson.update({
        where: { id: lesson.id },
        data: { status: 'CANCELLED', cancel_reason: reason },
        include: OFFER_INCLUDE,
    });

    const otherRole = args.actor === 'TUTOR' ? 'student' : 'tutor';
    const otherEmail = args.actor === 'TUTOR' ? lesson.student.user.email : lesson.tutor.user.email;
    await queueEmail('CUSTOM_SESSION_CLOSED', otherEmail,
        { lessonId: lesson.id, role: otherRole, reason: args.actor === 'TUTOR' ? 'cancelled_by_mentor' : 'cancelled_by_student' },
        `custom-closed:${lesson.id}:${otherRole}:${Date.now()}`);
    return updated;
}

const closeOffer = async (lessonId: string, reason: string) => {
    await prisma.lesson.updateMany({ where: { id: lessonId, status: 'PENDING' }, data: { status: 'CANCELLED', cancel_reason: reason } });
};

/** Scheduler: PENDING session requests past their expiry -> CANCELLED, both sides told. */
export async function expireStaleOffers() {
    const stale = await prisma.lesson.findMany({
        where: { origin: 'MENTOR_OFFER', status: 'PENDING', offer_expires_at: { lte: new Date() } },
        include: OFFER_INCLUDE,
        take: 100,
    });
    let expired = 0;
    for (const l of stale) {
        try {
            await closeOffer(l.id, 'Expired — no response');
            await queueEmail('CUSTOM_SESSION_CLOSED', l.student.user.email, { lessonId: l.id, role: 'student', reason: 'expired' }, `custom-closed:${l.id}:student`);
            await queueEmail('CUSTOM_SESSION_CLOSED', l.tutor.user.email, { lessonId: l.id, role: 'tutor', reason: 'expired' }, `custom-closed:${l.id}:tutor`);
            expired += 1;
        } catch (e) {
            console.error(`[CustomSession] Failed to expire offer ${l.id}:`, e);
        }
    }
    return { expired };
}
