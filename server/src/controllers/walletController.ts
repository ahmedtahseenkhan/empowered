import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { ensureMeetLinkForLesson } from '../services/googleCalendar';
import { StripeService } from '../services/stripeService';
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

/** Wallet policy values (fee, windows, grace) for any signed-in user — used for UI copy. */
export const getWalletConfig = async (_req: AuthRequest, res: Response) => {
    return res.json(wallet.publicConfig());
};

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
        for (const lesson of result.createdLessons) {
            try {
                await ensureMeetLinkForLesson(lesson.id);
            } catch (e) {
                console.error(`[Wallet] Meeting link creation failed for lesson ${lesson.id} (non-fatal):`, e);
            }
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

/** Start a Stripe Checkout to buy Learning Credits (1 credit = $1). */
export const createCreditsPurchaseCheckout = async (req: AuthRequest, res: Response) => {
    try {
        if (!WALLET_CONFIG.enabled) throw new WalletError('Learning Credits are not enabled', 403);
        const student = await requireStudent(req);
        if (student.wallet_frozen_at) throw new WalletError('Your credits wallet is currently on hold. Please contact support.', 403);

        const { credits, successUrl, cancelUrl } = req.body as { credits?: number; successUrl?: string; cancelUrl?: string };
        const amount = Number(credits);
        if (!Number.isInteger(amount) || amount < WALLET_CONFIG.purchaseMinCredits || amount > WALLET_CONFIG.purchaseMaxCredits) {
            throw new WalletError(`You can buy between ${WALLET_CONFIG.purchaseMinCredits} and ${WALLET_CONFIG.purchaseMaxCredits} credits at a time.`);
        }
        if (!successUrl || !cancelUrl) throw new WalletError('successUrl and cancelUrl are required');

        const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true } });

        // A stored customer id can be stale (created in Stripe test mode, or deleted).
        // Validate it and mint a fresh customer if Stripe no longer recognizes it.
        let stripeCustomerId = student.stripe_customer_id;
        if (stripeCustomerId) {
            try {
                const c = await StripeService.getCustomer(stripeCustomerId);
                if ((c as { deleted?: boolean }).deleted) stripeCustomerId = null;
            } catch {
                console.warn(`[Wallet] Stored Stripe customer ${stripeCustomerId} is invalid (test-mode leftover?); creating a new one.`);
                stripeCustomerId = null;
            }
        }
        if (!stripeCustomerId) {
            stripeCustomerId = (await StripeService.createCustomer(user?.email || 'student@example.com', student.username)).id;
            await prisma.studentProfile.update({ where: { id: student.id }, data: { stripe_customer_id: stripeCustomerId } });
        }

        const successWithSession = successUrl.includes('?')
            ? `${successUrl}&purchase_session_id={CHECKOUT_SESSION_ID}`
            : `${successUrl}?purchase_session_id={CHECKOUT_SESSION_ID}`;

        const session = await StripeService.createCreditsCheckoutSession(
            amount * 100,
            stripeCustomerId,
            successWithSession,
            cancelUrl,
            { type: 'credits_purchase', studentId: student.id, credits: String(amount) },
        );
        return res.json({ url: session.url });
    } catch (e) {
        return fail(res, e, 'Failed to start credits purchase');
    }
};

/** Called when the browser returns from Checkout — credits the wallet if the webhook hasn't already. */
export const finalizeCreditsPurchase = async (req: AuthRequest, res: Response) => {
    try {
        const student = await requireStudent(req);
        const { sessionId } = req.body as { sessionId?: string };
        if (!sessionId) throw new WalletError('sessionId is required');

        const session = await StripeService.getCheckoutSessionById(sessionId);
        if (!session) throw new WalletError('Checkout session not found', 404);
        const meta = (session.metadata || {}) as Record<string, string>;
        if (meta.type !== 'credits_purchase') throw new WalletError('Invalid checkout session type');
        if (meta.studentId !== student.id) throw new WalletError('Forbidden', 403);
        if (session.payment_status !== 'paid') throw new WalletError('Payment has not completed yet', 400);

        const result = await wallet.applyCreditsPurchase({
            studentId: student.id,
            credits: Number(meta.credits),
            amountCents: Number(session.amount_total || 0),
            stripePaymentIntentId: String(session.payment_intent),
            stripeCheckoutSessionId: session.id,
        });
        const w = await wallet.getStudentWallet(student.id);
        return res.json({ ok: true, applied: result.applied, wallet: w });
    } catch (e) {
        return fail(res, e, 'Failed to finalize credits purchase');
    }
};

// ---------------------------------------------------------------------------
// Mentor
// ---------------------------------------------------------------------------

export const getMentorPayoutSettings = async (req: AuthRequest, res: Response) => {
    try {
        const tutor = await requireTutor(req);
        const settings = await wallet.getMentorPayoutSettings(tutor.id);
        return res.json(settings);
    } catch (e) {
        return fail(res, e, 'Failed to load payout settings');
    }
};

export const updateMentorPayoutSettings = async (req: AuthRequest, res: Response) => {
    try {
        const tutor = await requireTutor(req);
        const { method, zelle_contact, bank_name, bank_account_name, bank_account_number, bank_routing, bank_notes } =
            req.body as Record<string, string | undefined>;
        const settings = await wallet.updateMentorPayoutSettings(tutor.id, {
            method: method as 'STRIPE' | 'ZELLE' | 'BANK_TRANSFER',
            zelle_contact, bank_name, bank_account_name, bank_account_number, bank_routing, bank_notes,
        });
        return res.json(settings);
    } catch (e) {
        return fail(res, e, 'Failed to save payout settings');
    }
};

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

export const adminSetWalletFrozen = async (req: AuthRequest, res: Response) => {
    try {
        const adminUserId = req.user?.id;
        if (!adminUserId) throw new WalletError('Unauthorized', 401);
        const { id } = req.params;
        const { frozen, reason } = req.body as { frozen?: boolean; reason?: string };
        if (typeof frozen !== 'boolean') throw new WalletError('frozen must be true or false');
        const result = await wallet.setWalletFrozen({ studentId: id, frozen, reason, adminUserId });
        return res.json({ ok: true, ...result });
    } catch (e) {
        return fail(res, e, 'Failed to update wallet freeze');
    }
};

export const adminRunSettlement = async (req: AuthRequest, res: Response) => {
    try {
        const adminUserId = req.user?.id;
        if (!adminUserId) throw new WalletError('Unauthorized', 401);
        const { force } = req.body as { force?: boolean };
        const result = await wallet.runMonthlySettlement({ triggeredBy: adminUserId, force: !!force });
        return res.json(result);
    } catch (e) {
        return fail(res, e, 'Failed to run settlement');
    }
};

export const adminListPayouts = async (req: AuthRequest, res: Response) => {
    try {
        const tutorId = (req.query.tutorId as string | undefined)?.trim() || undefined;
        const payouts = await wallet.listPayouts(tutorId);
        return res.json({ payouts });
    } catch (e) {
        return fail(res, e, 'Failed to load payouts');
    }
};

export const adminMarkMentorPaid = async (req: AuthRequest, res: Response) => {
    try {
        const adminUserId = req.user?.id;
        if (!adminUserId) throw new WalletError('Unauthorized', 401);
        const { id } = req.params;
        const { note, method, proofUrl } = req.body as { note?: string; method?: string; proofUrl?: string };
        const result = await wallet.markEarningsPaid({
            tutorId: id,
            note: note || '',
            adminUserId,
            method: method === 'STRIPE' || method === 'ZELLE' || method === 'BANK_TRANSFER' ? method : undefined,
            proofUrl,
        });
        return res.json(result);
    } catch (e) {
        return fail(res, e, 'Failed to record payout');
    }
};
