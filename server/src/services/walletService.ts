import prisma from '../config/db';
import { Prisma, CreditSource, CreditTransactionType } from '@prisma/client';

/**
 * Learning Credits wallet — Phase 1.
 *
 * Closed-loop service credits (1 credit = 1 USD). Credits move through clear states:
 *   Available -> Reserved (booking) -> Released (session completed) -> Mentor Pending Earnings
 *   -> settlement / risk window -> Mentor Available Earnings -> (Phase 2) monthly Stripe payout.
 *
 * Every movement is written to CreditLedger (append-only). Balances on StudentProfile are
 * cached totals; the ledger is the source of truth for audits.
 */

export const WALLET_CONFIG = {
    enabled: (process.env.WALLET_ENABLED || 'true').toLowerCase() !== 'false',
    /** Payment & Settlement Fee charged to mentors on completed-session earnings (percent). */
    feePercent: Number(process.env.WALLET_FEE_PERCENT || 5),
    /** Days a completed session's earnings stay PENDING before becoming payout-ready. */
    settlementDays: Number(process.env.WALLET_SETTLEMENT_DAYS || 7),
    /** Weeks of sessions reserved per booking (client rule: four weekly sessions). */
    weeksPerBooking: Number(process.env.WALLET_WEEKS_PER_BOOKING || 4),
    /** Student can cancel a reserved session for a full credit return up to this many hours before start. */
    cancelCutoffHours: Number(process.env.WALLET_CANCEL_CUTOFF_HOURS || 24),
    /** Backstop: minutes after end_time before a BOOKED credit-funded session is auto-marked COMPLETED
     *  when neither side pressed the completion-confirmation buttons. */
    completionGraceMinutes: Number(process.env.WALLET_COMPLETION_GRACE_MINUTES || 1440),
    /** Minimum AVAILABLE earnings before a payout is made (cents). Phase 2 uses this; shown to mentors now. */
    payoutMinimumCents: Number(process.env.WALLET_PAYOUT_MINIMUM_CENTS || 5000),
};

export class WalletError extends Error {
    status: number;
    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

type Tx = Prisma.TransactionClient;

const now = () => new Date();
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 24 * 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// Balances & history
// ---------------------------------------------------------------------------

export async function getStudentWallet(studentId: string) {
    const s = await prisma.studentProfile.findUnique({
        where: { id: studentId },
        select: { credits_balance: true, promo_credits_balance: true, reserved_credits: true },
    });
    if (!s) throw new WalletError('Student profile not found', 404);
    return {
        available: s.credits_balance,
        promotional: s.promo_credits_balance,
        purchased: s.credits_balance - s.promo_credits_balance,
        reserved: s.reserved_credits,
        config: publicConfig(),
    };
}

export function publicConfig() {
    return {
        enabled: WALLET_CONFIG.enabled,
        feePercent: WALLET_CONFIG.feePercent,
        settlementDays: WALLET_CONFIG.settlementDays,
        weeksPerBooking: WALLET_CONFIG.weeksPerBooking,
        cancelCutoffHours: WALLET_CONFIG.cancelCutoffHours,
        payoutMinimumCents: WALLET_CONFIG.payoutMinimumCents,
    };
}

export async function getStudentLedger(studentId: string, limit = 100) {
    return prisma.creditLedger.findMany({
        where: { student_id: studentId },
        orderBy: { created_at: 'desc' },
        take: limit,
    });
}

// ---------------------------------------------------------------------------
// Admin: grant / adjust
// ---------------------------------------------------------------------------

export async function adminAdjustCredits(args: {
    studentId: string;
    amount: number; // positive = add, negative = remove (MANUAL_ADJUSTMENT only)
    type: 'PROMO_GRANT' | 'MANUAL_ADJUSTMENT';
    reason: string;
    adminUserId: string;
}) {
    const { studentId, amount, type, reason, adminUserId } = args;
    if (!Number.isInteger(amount) || amount === 0) throw new WalletError('Amount must be a non-zero whole number of credits');
    if (type === 'PROMO_GRANT' && amount < 0) throw new WalletError('Promotional grants must be positive');
    if (!reason?.trim()) throw new WalletError('A reason is required');

    return prisma.$transaction(async (tx) => {
        const student = await tx.studentProfile.findUnique({
            where: { id: studentId },
            select: { id: true, credits_balance: true, promo_credits_balance: true },
        });
        if (!student) throw new WalletError('Student not found', 404);

        let promoDelta = 0;
        let source: CreditSource | null = null;

        if (amount > 0) {
            // Grants go to the promotional pool (beta credits) or the purchased pool (corrections).
            source = type === 'PROMO_GRANT' ? 'PROMOTIONAL' : 'PURCHASED';
            promoDelta = source === 'PROMOTIONAL' ? amount : 0;
        } else {
            const remove = -amount;
            if (student.credits_balance < remove) {
                throw new WalletError(`Student only has ${student.credits_balance} available credits`);
            }
            // Remove promotional credits first, then purchased.
            promoDelta = -Math.min(student.promo_credits_balance, remove);
            source = -promoDelta === remove ? 'PROMOTIONAL' : promoDelta === 0 ? 'PURCHASED' : null;
        }

        const updated = await tx.studentProfile.update({
            where: { id: studentId },
            data: {
                credits_balance: { increment: amount },
                promo_credits_balance: { increment: promoDelta },
            },
            select: { credits_balance: true, promo_credits_balance: true, reserved_credits: true },
        });

        const entry = await tx.creditLedger.create({
            data: {
                student_id: studentId,
                amount,
                type: type as CreditTransactionType,
                source,
                balance_after: updated.credits_balance,
                description: reason.trim(),
                created_by_user_id: adminUserId,
                metadata: { adminUserId, promoDelta },
            },
        });

        return { entry, wallet: updated };
    });
}

// ---------------------------------------------------------------------------
// Booking: reserve credits
// ---------------------------------------------------------------------------

export function quoteForBooking(args: { hourlyRate: number; weeklySlots: number }) {
    const sessions = args.weeklySlots * WALLET_CONFIG.weeksPerBooking;
    const creditsPerSession = Math.max(0, Math.round(args.hourlyRate));
    return {
        creditsPerSession,
        sessions,
        required: creditsPerSession * sessions,
    };
}

/**
 * Move credits Available -> Reserved for a set of freshly created lessons.
 * Must be called inside the same transaction that created the booking + lessons.
 * Uses a conditional update so two concurrent bookings can never overdraw the wallet.
 */
export async function reserveCreditsForLessons(
    tx: Tx,
    args: {
        studentId: string;
        bookingId: string;
        lessons: Array<{ id: string; start_time: Date }>;
        creditsPerSession: number;
        description: string;
    },
) {
    const { studentId, bookingId, lessons, creditsPerSession, description } = args;
    const total = creditsPerSession * lessons.length;
    if (total <= 0) throw new WalletError('Nothing to reserve');

    const before = await tx.studentProfile.findUnique({
        where: { id: studentId },
        select: { credits_balance: true, promo_credits_balance: true },
    });
    if (!before) throw new WalletError('Student profile not found', 404);
    if (before.credits_balance < total) {
        throw new WalletError(
            `You need ${total} credits to reserve these sessions but only have ${before.credits_balance}.`,
            402,
        );
    }

    // Promotional credits are spent first.
    const promoUsed = Math.min(before.promo_credits_balance, total);

    const res = await tx.studentProfile.updateMany({
        where: {
            id: studentId,
            credits_balance: { gte: total },
            promo_credits_balance: { gte: promoUsed },
        },
        data: {
            credits_balance: { decrement: total },
            promo_credits_balance: { decrement: promoUsed },
            reserved_credits: { increment: total },
        },
    });
    if (res.count !== 1) {
        throw new WalletError('Your credit balance changed while booking. Please try again.', 409);
    }

    let runningBalance = before.credits_balance;
    let promoLeft = promoUsed;
    const reservations = [];

    for (const lesson of lessons) {
        const promoForLesson = Math.min(promoLeft, creditsPerSession);
        promoLeft -= promoForLesson;
        runningBalance -= creditsPerSession;

        const reservation = await tx.sessionReservation.create({
            data: {
                student_id: studentId,
                booking_id: bookingId,
                lesson_id: lesson.id,
                credits: creditsPerSession,
                promo_credits: promoForLesson,
                status: 'RESERVED',
            },
        });
        reservations.push(reservation);

        await tx.creditLedger.create({
            data: {
                student_id: studentId,
                amount: -creditsPerSession,
                type: 'RESERVE',
                source: promoForLesson === creditsPerSession ? 'PROMOTIONAL' : promoForLesson === 0 ? 'PURCHASED' : null,
                balance_after: runningBalance,
                description: `${description} — session on ${lesson.start_time.toISOString()}`,
                booking_id: bookingId,
                lesson_id: lesson.id,
                reservation_id: reservation.id,
                metadata: { promo_credits: promoForLesson },
            },
        });
    }

    return { reservations, total, promoUsed };
}

// ---------------------------------------------------------------------------
// Reservation lifecycle
// ---------------------------------------------------------------------------

async function returnReservationTx(tx: Tx, reservationId: string, reason: string) {
    const r = await tx.sessionReservation.findUnique({ where: { id: reservationId } });
    if (!r) throw new WalletError('Reservation not found', 404);
    if (r.status !== 'RESERVED') return r; // idempotent

    const updated = await tx.studentProfile.update({
        where: { id: r.student_id },
        data: {
            credits_balance: { increment: r.credits },
            promo_credits_balance: { increment: r.promo_credits },
            reserved_credits: { decrement: r.credits },
        },
        select: { credits_balance: true },
    });

    await tx.creditLedger.create({
        data: {
            student_id: r.student_id,
            amount: r.credits,
            type: 'UNRESERVE',
            source: r.promo_credits === r.credits ? 'PROMOTIONAL' : r.promo_credits === 0 ? 'PURCHASED' : null,
            balance_after: updated.credits_balance,
            description: reason,
            booking_id: r.booking_id,
            lesson_id: r.lesson_id,
            reservation_id: r.id,
            metadata: { promo_credits: r.promo_credits },
        },
    });

    return tx.sessionReservation.update({
        where: { id: r.id },
        data: { status: 'RETURNED', returned_at: now(), return_reason: reason },
    });
}

/** Reserved -> Released; creates the mentor's PENDING earning for the completed session. */
async function releaseReservationTx(tx: Tx, reservationId: string) {
    const r = await tx.sessionReservation.findUnique({
        where: { id: reservationId },
        include: { lesson: { select: { id: true, tutor_id: true, start_time: true } } },
    });
    if (!r) throw new WalletError('Reservation not found', 404);
    if (r.status !== 'RESERVED') return null; // idempotent

    const grossCents = r.credits * 100;
    const feeCents = Math.round((grossCents * WALLET_CONFIG.feePercent) / 100);
    const netCents = grossCents - feeCents;

    const updated = await tx.studentProfile.update({
        where: { id: r.student_id },
        data: { reserved_credits: { decrement: r.credits } },
        select: { credits_balance: true },
    });

    await tx.sessionReservation.update({
        where: { id: r.id },
        data: { status: 'RELEASED', released_at: now() },
    });

    await tx.creditLedger.create({
        data: {
            student_id: r.student_id,
            amount: 0,
            type: 'RELEASE',
            source: r.promo_credits === r.credits ? 'PROMOTIONAL' : r.promo_credits === 0 ? 'PURCHASED' : null,
            balance_after: updated.credits_balance,
            description: `Released ${r.credits} reserved credits for completed session on ${r.lesson.start_time.toISOString()}`,
            booking_id: r.booking_id,
            lesson_id: r.lesson_id,
            reservation_id: r.id,
            metadata: { credits_released: r.credits, promo_credits: r.promo_credits },
        },
    });

    const earning = await tx.mentorEarning.create({
        data: {
            tutor_id: r.lesson.tutor_id,
            student_id: r.student_id,
            booking_id: r.booking_id,
            lesson_id: r.lesson_id,
            reservation_id: r.id,
            gross_cents: grossCents,
            fee_cents: feeCents,
            net_cents: netCents,
            fee_percent: WALLET_CONFIG.feePercent,
            promo_cents: r.promo_credits * 100,
            status: 'PENDING',
            available_at: addDays(now(), WALLET_CONFIG.settlementDays),
        },
    });

    return earning;
}

// ---------------------------------------------------------------------------
// Student actions
// ---------------------------------------------------------------------------

export async function cancelReservedLesson(args: { studentId: string; lessonId: string }) {
    const { studentId, lessonId } = args;

    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { booking: { select: { id: true, funding: true } }, reservation: true },
    });
    if (!lesson) throw new WalletError('Session not found', 404);
    if (lesson.student_id !== studentId) throw new WalletError('Forbidden', 403);
    if (lesson.booking?.funding !== 'CREDITS' || !lesson.reservation) {
        throw new WalletError('Only sessions reserved with Learning Credits can be cancelled here');
    }
    if (lesson.status !== 'BOOKED') throw new WalletError('Only upcoming booked sessions can be cancelled');

    const cutoffMs = WALLET_CONFIG.cancelCutoffHours * 60 * 60 * 1000;
    if (lesson.start_time.getTime() - Date.now() < cutoffMs) {
        throw new WalletError(
            `Sessions can only be cancelled more than ${WALLET_CONFIG.cancelCutoffHours} hours before they start`,
        );
    }

    return prisma.$transaction(async (tx) => {
        await tx.lesson.update({
            where: { id: lesson.id },
            data: { status: 'CANCELLED', cancel_reason: 'Cancelled by student' },
        });
        const reservation = await returnReservationTx(
            tx,
            lesson.reservation!.id,
            'Session cancelled by student — credits returned',
        );
        return { lesson, reservation };
    });
}

export async function openDispute(args: { studentId: string; lessonId: string; reason: string }) {
    const { studentId, lessonId } = args;
    const reason = (args.reason || '').trim();
    if (reason.length < 10) throw new WalletError('Please describe the problem in at least 10 characters');

    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { booking: { select: { funding: true } }, earning: true, dispute: true },
    });
    if (!lesson) throw new WalletError('Session not found', 404);
    if (lesson.student_id !== studentId) throw new WalletError('Forbidden', 403);
    if (lesson.booking?.funding !== 'CREDITS') throw new WalletError('Only sessions paid with Learning Credits can be reported here');
    if (lesson.status !== 'COMPLETED' || !lesson.earning) throw new WalletError('You can report a problem once the session is marked completed');
    if (lesson.dispute) throw new WalletError('A report has already been filed for this session');
    if (lesson.earning.status !== 'PENDING') {
        throw new WalletError(
            `The ${WALLET_CONFIG.settlementDays}-day review window for this session has closed`,
        );
    }

    return prisma.$transaction(async (tx) => {
        const dispute = await tx.sessionDispute.create({
            data: {
                lesson_id: lesson.id,
                student_id: lesson.student_id,
                tutor_id: lesson.tutor_id,
                reason,
                status: 'OPEN',
            },
        });
        await tx.mentorEarning.update({ where: { id: lesson.earning!.id }, data: { status: 'ON_HOLD' } });
        return dispute;
    });
}

// ---------------------------------------------------------------------------
// Admin: disputes & payouts
// ---------------------------------------------------------------------------

export async function resolveDispute(args: {
    disputeId: string;
    adminUserId: string;
    action: 'REFUND' | 'RELEASE';
    note?: string;
}) {
    const { disputeId, adminUserId, action } = args;
    const note = (args.note || '').trim();

    return prisma.$transaction(async (tx) => {
        const dispute = await tx.sessionDispute.findUnique({
            where: { id: disputeId },
            include: { lesson: { include: { earning: true } } },
        });
        if (!dispute) throw new WalletError('Dispute not found', 404);
        if (dispute.status !== 'OPEN') throw new WalletError('This dispute is already resolved');
        const earning = dispute.lesson.earning;
        if (!earning) throw new WalletError('No mentor earning is linked to this session');

        if (action === 'REFUND') {
            const credits = Math.round(earning.gross_cents / 100);
            const promo = Math.round(earning.promo_cents / 100);

            const updated = await tx.studentProfile.update({
                where: { id: dispute.student_id },
                data: {
                    credits_balance: { increment: credits },
                    promo_credits_balance: { increment: promo },
                },
                select: { credits_balance: true },
            });

            await tx.creditLedger.create({
                data: {
                    student_id: dispute.student_id,
                    amount: credits,
                    type: 'REVERSAL',
                    source: promo === credits ? 'PROMOTIONAL' : promo === 0 ? 'PURCHASED' : null,
                    balance_after: updated.credits_balance,
                    description: `Credits returned after review of reported session${note ? `: ${note}` : ''}`,
                    booking_id: earning.booking_id,
                    lesson_id: dispute.lesson_id,
                    reservation_id: earning.reservation_id,
                    created_by_user_id: adminUserId,
                    metadata: { disputeId, promo_credits: promo },
                },
            });

            await tx.mentorEarning.update({
                where: { id: earning.id },
                data: { status: 'REVERSED', reversed_at: now() },
            });
        } else {
            const pastWindow = earning.available_at.getTime() <= Date.now();
            await tx.mentorEarning.update({
                where: { id: earning.id },
                data: pastWindow
                    ? { status: 'AVAILABLE', settled_at: now() }
                    : { status: 'PENDING' },
            });
        }

        return tx.sessionDispute.update({
            where: { id: dispute.id },
            data: {
                status: action === 'REFUND' ? 'RESOLVED_REFUNDED' : 'RESOLVED_RELEASED',
                resolution_note: note || null,
                resolved_by_user_id: adminUserId,
                resolved_at: now(),
            },
        });
    });
}

export async function listDisputes(status?: 'OPEN' | 'RESOLVED_REFUNDED' | 'RESOLVED_RELEASED') {
    return prisma.sessionDispute.findMany({
        where: status ? { status } : undefined,
        orderBy: { created_at: 'desc' },
        take: 200,
        include: {
            student: { select: { id: true, username: true, user: { select: { email: true } } } },
            tutor: { select: { id: true, username: true, user: { select: { email: true } } } },
            lesson: {
                select: {
                    id: true, start_time: true, end_time: true, status: true,
                    earning: { select: { id: true, gross_cents: true, fee_cents: true, net_cents: true, status: true, available_at: true } },
                },
            },
        },
    });
}

/** Phase 1 manual payout: mark a mentor's AVAILABLE earnings as PAID with a reference note. */
export async function markEarningsPaid(args: { tutorId: string; note: string; adminUserId: string }) {
    const note = (args.note || '').trim();
    if (!note) throw new WalletError('A payout reference / note is required');
    const res = await prisma.mentorEarning.updateMany({
        where: { tutor_id: args.tutorId, status: 'AVAILABLE' },
        data: { status: 'PAID', paid_at: now(), payout_note: `${note} (by ${args.adminUserId})` },
    });
    return { count: res.count };
}

export async function listMentorEarningsForAdmin() {
    const rows = await prisma.mentorEarning.groupBy({
        by: ['tutor_id', 'status'],
        _sum: { net_cents: true, gross_cents: true, fee_cents: true, promo_cents: true },
        _count: { _all: true },
    });
    const tutorIds = Array.from(new Set(rows.map((r) => r.tutor_id)));
    const tutors = await prisma.tutorProfile.findMany({
        where: { id: { in: tutorIds } },
        select: { id: true, username: true, stripe_account_id: true, user: { select: { email: true } } },
    });
    const byTutor = new Map<string, any>();
    for (const t of tutors) {
        byTutor.set(t.id, {
            tutor: t,
            totals: {} as Record<string, { count: number; net_cents: number; gross_cents: number; fee_cents: number; promo_cents: number }>,
        });
    }
    for (const r of rows) {
        const entry = byTutor.get(r.tutor_id);
        if (!entry) continue;
        entry.totals[r.status] = {
            count: r._count._all,
            net_cents: r._sum.net_cents || 0,
            gross_cents: r._sum.gross_cents || 0,
            fee_cents: r._sum.fee_cents || 0,
            promo_cents: r._sum.promo_cents || 0,
        };
    }
    return Array.from(byTutor.values());
}

// ---------------------------------------------------------------------------
// Mentor view
// ---------------------------------------------------------------------------

export async function getMentorEarnings(tutorId: string) {
    const earnings = await prisma.mentorEarning.findMany({
        where: { tutor_id: tutorId },
        orderBy: { created_at: 'desc' },
        take: 200,
        include: {
            student: { select: { username: true } },
            lesson: { select: { start_time: true, end_time: true, dispute: { select: { status: true } } } },
        },
    });

    const sum = (statuses: string[], field: 'net_cents' | 'gross_cents' | 'fee_cents') =>
        earnings.filter((e) => statuses.includes(e.status)).reduce((acc, e) => acc + e[field], 0);

    return {
        config: publicConfig(),
        totals: {
            pending_cents: sum(['PENDING', 'ON_HOLD'], 'net_cents'),
            on_hold_cents: sum(['ON_HOLD'], 'net_cents'),
            available_cents: sum(['AVAILABLE'], 'net_cents'),
            paid_cents: sum(['PAID', 'TRANSFERRED'], 'net_cents'),
            reversed_cents: sum(['REVERSED'], 'net_cents'),
            lifetime_gross_cents: sum(['PENDING', 'ON_HOLD', 'AVAILABLE', 'PAID', 'TRANSFERRED'], 'gross_cents'),
            lifetime_fee_cents: sum(['PENDING', 'ON_HOLD', 'AVAILABLE', 'PAID', 'TRANSFERRED'], 'fee_cents'),
        },
        earnings: earnings.map((e) => ({
            id: e.id,
            lesson_id: e.lesson_id,
            student_name: e.student.username,
            session_start: e.lesson.start_time,
            gross_cents: e.gross_cents,
            fee_cents: e.fee_cents,
            net_cents: e.net_cents,
            fee_percent: e.fee_percent,
            status: e.status,
            available_at: e.available_at,
            paid_at: e.paid_at,
            dispute_status: e.lesson.dispute?.status || null,
            created_at: e.created_at,
        })),
    };
}

/**
 * Immediately mark a lesson COMPLETED (both sides confirmed) and, for credit-funded
 * sessions, release the reserved credits into the mentor's pending earnings.
 */
export async function completeLessonNow(lessonId: string) {
    return prisma.$transaction(async (tx) => {
        const lesson = await tx.lesson.findUnique({
            where: { id: lessonId },
            include: { reservation: true, booking: { select: { funding: true } } },
        });
        if (!lesson) throw new WalletError('Session not found', 404);
        if (lesson.status === 'COMPLETED') return lesson;
        if (lesson.status !== 'BOOKED') throw new WalletError('Only booked sessions can be completed');

        const updated = await tx.lesson.update({
            where: { id: lesson.id },
            data: { status: 'COMPLETED', completed_at: now() },
        });
        if (lesson.booking?.funding === 'CREDITS' && lesson.reservation?.status === 'RESERVED') {
            await releaseReservationTx(tx, lesson.reservation.id);
        }
        return updated;
    });
}

// ---------------------------------------------------------------------------
// Scheduler jobs
// ---------------------------------------------------------------------------

/** BOOKED credit-funded sessions whose end time has passed -> COMPLETED, credits released to mentor. */
export async function processCompletedLessons() {
    const cutoff = new Date(Date.now() - WALLET_CONFIG.completionGraceMinutes * 60 * 1000);
    const due = await prisma.lesson.findMany({
        where: {
            status: 'BOOKED',
            end_time: { lte: cutoff },
            booking: { funding: 'CREDITS' },
            reservation: { status: 'RESERVED' },
        },
        select: { id: true, reservation: { select: { id: true } } },
        take: 200,
    });

    let completed = 0;
    for (const lesson of due) {
        if (!lesson.reservation) continue;
        try {
            await prisma.$transaction(async (tx) => {
                await tx.lesson.update({
                    where: { id: lesson.id },
                    data: { status: 'COMPLETED', completed_at: now() },
                });
                await releaseReservationTx(tx, lesson.reservation!.id);
            });
            completed += 1;
        } catch (e) {
            console.error(`[Wallet] Failed to complete lesson ${lesson.id}:`, e);
        }
    }

    // Safety sweep: a reservation still RESERVED against a CANCELLED lesson (cancelled outside the
    // wallet flow, e.g. by an admin) must give the credits back.
    const orphaned = await prisma.sessionReservation.findMany({
        where: { status: 'RESERVED', lesson: { status: 'CANCELLED' } },
        select: { id: true },
        take: 200,
    });
    let returned = 0;
    for (const r of orphaned) {
        try {
            await prisma.$transaction((tx) => returnReservationTx(tx, r.id, 'Session cancelled — credits returned'));
            returned += 1;
        } catch (e) {
            console.error(`[Wallet] Failed to return reservation ${r.id}:`, e);
        }
    }

    return { completed, returned };
}

/** PENDING earnings whose settlement window has passed -> AVAILABLE. */
export async function settlePendingEarnings() {
    const res = await prisma.mentorEarning.updateMany({
        where: { status: 'PENDING', available_at: { lte: now() } },
        data: { status: 'AVAILABLE', settled_at: now() },
    });
    return { settled: res.count };
}
