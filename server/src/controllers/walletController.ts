import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { createMeetEventForLesson } from '../services/googleCalendar';
import { isTutorSlotAvailable } from '../services/availability';
import * as wallet from '../services/walletService';
import { WalletError, WALLET_CONFIG } from '../services/walletService';

type Frequency = 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY';

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const weeklySlotsForFrequency = (frequency: Frequency) => {
    if (frequency === 'TWICE_WEEKLY') return 2;
    if (frequency === 'THRICE_WEEKLY') return 3;
    return 1;
};

const fail = (res: Response, e: unknown, fallback: string) => {
    if (e instanceof WalletError) return res.status(e.status).json({ error: e.message });
    console.error(`[Wallet] ${fallback}:`, e);
    return res.status(500).json({ error: fallback });
};

async function requireStudent(req: AuthRequest) {
    if (!req.user?.id) throw new WalletError('Unauthorized', 401);
    if (req.user.role !== 'STUDENT') throw new WalletError('Only students can access the credits wallet', 403);
    const student = await prisma.studentProfile.findUnique({ where: { user_id: req.user.id } });
    if (!student) throw new WalletError('Student profile not found', 404);
    return student;
}

async function requireTutor(req: AuthRequest) {
    if (!req.user?.id) throw new WalletError('Unauthorized', 401);
    if (req.user.role !== 'TUTOR') throw new WalletError('Only mentors can view earnings', 403);
    const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: req.user.id } });
    if (!tutor) throw new WalletError('Tutor profile not found', 404);
    return tutor;
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

export const getMyWallet = async (req: AuthRequest, res: Response) => {
    try {
        const student = await requireStudent(req);
        const data = await wallet.getStudentWallet(student.id);
        return res.json(data);
    } catch (e) {
        return fail(res, e, 'Failed to load wallet');
    }
};

export const getMyWalletHistory = async (req: AuthRequest, res: Response) => {
    try {
        const student = await requireStudent(req);
        const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
        const entries = await wallet.getStudentLedger(student.id, limit);
        return res.json({ entries });
    } catch (e) {
        return fail(res, e, 'Failed to load credit history');
    }
};

/** How many credits a booking with this mentor needs, and whether the student has them. */
export const getBookingQuote = async (req: AuthRequest, res: Response) => {
    try {
        const student = await requireStudent(req);
        const tutorId = (req.query.tutorId as string | undefined)?.trim();
        if (!tutorId) throw new WalletError('tutorId is required');
        const frequency = ((req.query.frequency as string | undefined) || 'WEEKLY') as Frequency;
        const weeklySlots = weeklySlotsForFrequency(frequency);

        const tutor = await prisma.tutorProfile.findUnique({ where: { id: tutorId }, select: { hourly_rate: true, username: true } });
        if (!tutor) throw new WalletError('Tutor not found', 404);

        const quote = wallet.quoteForBooking({ hourlyRate: tutor.hourly_rate, weeklySlots });
        const w = await wallet.getStudentWallet(student.id);

        return res.json({
            enabled: WALLET_CONFIG.enabled,
            mentor: tutor.username,
            ...quote,
            available: w.available,
            sufficient: WALLET_CONFIG.enabled && w.available >= quote.required && quote.required > 0,
            shortfall: Math.max(0, quote.required - w.available),
            config: w.config,
        });
    } catch (e) {
        return fail(res, e, 'Failed to build credits quote');
    }
};

/**
 * Book a block of weekly sessions with Learning Credits. Credits move Available -> Reserved,
 * one reservation per session. No Stripe call is made.
 */
export const createCreditsBooking = async (req: AuthRequest, res: Response) => {
    try {
        if (!WALLET_CONFIG.enabled) throw new WalletError('Learning Credits are not enabled', 403);
        const student = await requireStudent(req);

        const { tutorId, frequency, slotStarts, durationMinutes, clientTimezone } = req.body as {
            tutorId?: string;
            frequency?: Frequency;
            slotStarts?: string[];
            durationMinutes?: number;
            clientTimezone?: string;
        };

        if (!tutorId) throw new WalletError('tutorId is required');
        if (!slotStarts || !Array.isArray(slotStarts) || slotStarts.length === 0) throw new WalletError('slotStarts is required');

        const bookingFrequency: Frequency = frequency === 'TWICE_WEEKLY' || frequency === 'THRICE_WEEKLY' ? frequency : 'WEEKLY';
        const requiredSlots = weeklySlotsForFrequency(bookingFrequency);
        if (slotStarts.length !== requiredSlots) {
            throw new WalletError(`Please select ${requiredSlots} weekly time slot${requiredSlots === 1 ? '' : 's'}`);
        }

        const dur = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 60;

        const tutor = await prisma.tutorProfile.findUnique({ where: { id: tutorId } });
        if (!tutor) throw new WalletError('Tutor not found', 404);
        if (!tutor.hourly_rate || tutor.hourly_rate <= 0) throw new WalletError('This mentor has not set a session rate yet');

        const starts = slotStarts
            .map((s) => new Date(s))
            .filter((d) => !Number.isNaN(d.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());
        if (starts.length !== slotStarts.length) throw new WalletError('One or more slotStarts are invalid');
        if (starts[0].getTime() < Date.now()) throw new WalletError('Selected time is in the past');

        const weeks = WALLET_CONFIG.weeksPerBooking;
        const lessonsToCreate: Array<{ start: Date; end: Date }> = [];
        for (const baseStart of starts) {
            for (let week = 0; week < weeks; week++) {
                const s = addDays(baseStart, week * 7);
                lessonsToCreate.push({ start: s, end: addMinutes(s, dur) });
            }
        }
        lessonsToCreate.sort((a, b) => a.start.getTime() - b.start.getTime());

        for (const l of lessonsToCreate) {
            const ok = await isTutorSlotAvailable({ tutorId, start: l.start, end: l.end });
            if (!ok) throw new WalletError('One of the selected times is no longer available', 409);
        }

        const quote = wallet.quoteForBooking({ hourlyRate: tutor.hourly_rate, weeklySlots: requiredSlots });
        const bookingStart = lessonsToCreate[0].start;
        const bookingEnd = addDays(bookingStart, weeks * 7);

        const result = await prisma.$transaction(async (tx) => {
            const createdBooking = await tx.booking.create({
                data: {
                    student_id: student.id,
                    tutor_id: tutorId,
                    start_date: bookingStart,
                    end_date: bookingEnd,
                    frequency: bookingFrequency,
                    client_timezone: clientTimezone || 'UTC',
                    funding: 'CREDITS',
                    status: 'active',
                },
            });

            const createdLessons = [];
            for (const l of lessonsToCreate) {
                createdLessons.push(
                    await tx.lesson.create({
                        data: {
                            tutor_id: tutorId,
                            student_id: student.id,
                            booking_id: createdBooking.id,
                            start_time: l.start,
                            end_time: l.end,
                            duration: dur,
                            status: 'BOOKED',
                            billing_type: 'PAID',
                        },
                    }),
                );
            }

            const reserved = await wallet.reserveCreditsForLessons(tx, {
                studentId: student.id,
                bookingId: createdBooking.id,
                lessons: createdLessons.map((l) => ({ id: l.id, start_time: l.start_time })),
                creditsPerSession: quote.creditsPerSession,
                description: `Reserved for sessions with ${tutor.username}`,
            });

            return { createdBooking, createdLessons, reserved };
        });

        // Google Meet links (non-fatal)
        const studentUser = await prisma.user.findUnique({ where: { id: student.user_id } });
        const tutorUser = await prisma.user.findUnique({ where: { id: tutor.user_id } });
        const attendees = [studentUser?.email, tutorUser?.email].filter(Boolean) as string[];
        try {
            for (const lesson of result.createdLessons) {
                const event = await createMeetEventForLesson({
                    tutorId,
                    lessonId: lesson.id,
                    title: `Mentoring Session with ${tutor.username}`,
                    description: 'Scheduled via Empowered Learnings',
                    start: lesson.start_time,
                    end: lesson.end_time,
                    attendeesEmails: attendees,
                });
                if (event?.eventId || event?.meetLink || event?.htmlLink) {
                    await prisma.lesson.update({
                        where: { id: lesson.id },
                        data: {
                            meeting_link: event.meetLink || undefined,
                            google_calendar_event_id: event.eventId || undefined,
                            google_calendar_html_link: event.htmlLink || undefined,
                        },
                    });
                }
            }
        } catch (e) {
            console.error('[Wallet] Calendar event creation failed (non-fatal):', e);
        }

        const firstLesson = result.createdLessons[0];
        if (studentUser?.email) {
            await prisma.emailOutbox.create({
                data: {
                    type: 'BOOKING_CONFIRMATION_STUDENT',
                    to_email: studentUser.email,
                    payload: {
                        bookingId: result.createdBooking.id,
                        tutorName: tutor.username,
                        clientTimezone: clientTimezone || undefined,
                        start: firstLesson?.start_time?.toISOString() || null,
                        end: firstLesson?.end_time?.toISOString() || null,
                        paidWithCredits: true,
                        creditsReserved: result.reserved.total,
                    },
                    idempotency_key: `booking:${result.createdBooking.id}:student`,
                },
            }).catch((e: any) => { if (e.code !== 'P2002') console.error('[Wallet] student email queue failed:', e); });
        }
        if (tutorUser?.email) {
            await prisma.emailOutbox.create({
                data: {
                    type: 'BOOKING_CONFIRMATION_TUTOR',
                    to_email: tutorUser.email,
                    payload: {
                        bookingId: result.createdBooking.id,
                        studentId: student.id,
                        start: firstLesson?.start_time?.toISOString() || null,
                        end: firstLesson?.end_time?.toISOString() || null,
                        paidWithCredits: true,
                    },
                    idempotency_key: `booking:${result.createdBooking.id}:tutor`,
                },
            }).catch((e: any) => { if (e.code !== 'P2002') console.error('[Wallet] tutor email queue failed:', e); });
        }

        const w = await wallet.getStudentWallet(student.id);
        return res.status(201).json({
            booking: result.createdBooking,
            lessons: result.createdLessons.map((l) => ({ id: l.id, start_time: l.start_time, end_time: l.end_time })),
            credits_reserved: result.reserved.total,
            wallet: w,
        });
    } catch (e) {
        return fail(res, e, 'Failed to book with credits');
    }
};

/** Student cancels an upcoming credit-reserved session (within policy) — credits return to Available. */
export const cancelCreditsLesson = async (req: AuthRequest, res: Response) => {
    try {
        const student = await requireStudent(req);
        const lessonId = (req.params.lessonId || '').trim();
        if (!lessonId) throw new WalletError('lessonId is required');

        const { lesson, reservation } = await wallet.cancelReservedLesson({ studentId: student.id, lessonId });

        // Notify the mentor (non-fatal)
        const tutor = await prisma.tutorProfile.findUnique({ where: { id: lesson.tutor_id }, select: { user: { select: { email: true } } } });
        if (tutor?.user?.email) {
            await prisma.emailOutbox.create({
                data: {
                    type: 'SESSION_CANCELLED_BY_STUDENT_TUTOR',
                    to_email: tutor.user.email,
                    payload: { lessonId: lesson.id, studentName: student.username },
                    idempotency_key: `session-cancelled-by-student:${lesson.id}:tutor`,
                },
            }).catch((e: any) => { if (e.code !== 'P2002') console.error('[Wallet] cancel email queue failed:', e); });
        }

        const w = await wallet.getStudentWallet(student.id);
        return res.json({ ok: true, credits_returned: reservation.credits, wallet: w });
    } catch (e) {
        return fail(res, e, 'Failed to cancel session');
    }
};

/** Student reports a problem with a completed session inside the settlement window. */
export const reportSessionProblem = async (req: AuthRequest, res: Response) => {
    try {
        const student = await requireStudent(req);
        const lessonId = (req.params.lessonId || '').trim();
        const { reason } = req.body as { reason?: string };
        if (!lessonId) throw new WalletError('lessonId is required');

        const dispute = await wallet.openDispute({ studentId: student.id, lessonId, reason: reason || '' });
        return res.status(201).json({ dispute });
    } catch (e) {
        return fail(res, e, 'Failed to report a problem');
    }
};

// ---------------------------------------------------------------------------
// Mentor
// ---------------------------------------------------------------------------

export const getMentorWalletEarnings = async (req: AuthRequest, res: Response) => {
    try {
        const tutor = await requireTutor(req);
        const data = await wallet.getMentorEarnings(tutor.id);
        return res.json(data);
    } catch (e) {
        return fail(res, e, 'Failed to load earnings');
    }
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const adminGetStudentWallet = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const [w, entries, reservations] = await Promise.all([
            wallet.getStudentWallet(id),
            wallet.getStudentLedger(id, 200),
            prisma.sessionReservation.findMany({
                where: { student_id: id },
                orderBy: { created_at: 'desc' },
                take: 100,
                include: { lesson: { select: { start_time: true, status: true, tutor: { select: { username: true } } } } },
            }),
        ]);
        return res.json({ wallet: w, entries, reservations });
    } catch (e) {
        return fail(res, e, 'Failed to load student wallet');
    }
};

export const adminAdjustStudentCredits = async (req: AuthRequest, res: Response) => {
    try {
        const adminUserId = req.user?.id;
        if (!adminUserId) throw new WalletError('Unauthorized', 401);
        const { id } = req.params;
        const { amount, type, reason } = req.body as { amount?: number; type?: string; reason?: string };
        const t = type === 'MANUAL_ADJUSTMENT' ? 'MANUAL_ADJUSTMENT' : 'PROMO_GRANT';
        const result = await wallet.adminAdjustCredits({
            studentId: id,
            amount: Number(amount),
            type: t,
            reason: reason || '',
            adminUserId,
        });
        return res.status(201).json(result);
    } catch (e) {
        return fail(res, e, 'Failed to adjust credits');
    }
};

export const adminListDisputes = async (req: AuthRequest, res: Response) => {
    try {
        const status = req.query.status as 'OPEN' | 'RESOLVED_REFUNDED' | 'RESOLVED_RELEASED' | undefined;
        const disputes = await wallet.listDisputes(status);
        return res.json({ disputes });
    } catch (e) {
        return fail(res, e, 'Failed to load disputes');
    }
};

export const adminResolveDispute = async (req: AuthRequest, res: Response) => {
    try {
        const adminUserId = req.user?.id;
        if (!adminUserId) throw new WalletError('Unauthorized', 401);
        const { id } = req.params;
        const { action, note } = req.body as { action?: string; note?: string };
        if (action !== 'REFUND' && action !== 'RELEASE') throw new WalletError('action must be REFUND or RELEASE');
        const dispute = await wallet.resolveDispute({ disputeId: id, adminUserId, action, note });
        return res.json({ dispute });
    } catch (e) {
        return fail(res, e, 'Failed to resolve dispute');
    }
};

export const adminListMentorEarnings = async (_req: AuthRequest, res: Response) => {
    try {
        const mentors = await wallet.listMentorEarningsForAdmin();
        return res.json({ mentors, config: wallet.publicConfig() });
    } catch (e) {
        return fail(res, e, 'Failed to load mentor earnings');
    }
};

export const adminMarkMentorPaid = async (req: AuthRequest, res: Response) => {
    try {
        const adminUserId = req.user?.id;
        if (!adminUserId) throw new WalletError('Unauthorized', 401);
        const { id } = req.params;
        const { note } = req.body as { note?: string };
        const result = await wallet.markEarningsPaid({ tutorId: id, note: note || '', adminUserId });
        return res.json(result);
    } catch (e) {
        return fail(res, e, 'Failed to record payout');
    }
};
