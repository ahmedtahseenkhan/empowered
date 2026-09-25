import prisma from '../config/db';
import Stripe from 'stripe';
import { CARD_PLATFORM_FEE_RATE, splitCardCharge } from '../config/fees';

type LessonRef = { id: string; start_time: Date; status: string };

/**
 * PaymentSchedule rows aren't linked to a lesson; they're matched by due date
 * (48h before start for checkout bookings, 24h for legacy bookings).
 */
function matchLesson(dueDate: Date, lessons: LessonRef[]): LessonRef | null {
    const dueMs = dueDate.getTime();
    let best: LessonRef | null = null;
    let bestDiff = Infinity;
    for (const l of lessons) {
        const leadHours = (l.start_time.getTime() - dueMs) / 3_600_000;
        if (leadHours < 20 || leadHours > 52) continue;
        const diff = Math.min(Math.abs(leadHours - 48), Math.abs(leadHours - 24));
        if (diff < bestDiff) { best = l; bestDiff = diff; }
    }
    return best;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2024-12-18.acacia' as any,
});

export class PaymentAnalyticsService {
    /**
     * Get earnings overview for a tutor
     */
    static async getTutorEarningsOverview(tutorId: string) {
        try {
            // Get all paid sessions for this tutor
            const paidSessions = await prisma.paymentSchedule.findMany({
                where: {
                    booking: {
                        tutor_id: tutorId,
                    },
                    status: 'paid',
                },
                select: { amount: true, created_at: true },
            });

            // Mentor's share of what was actually charged (amount includes the platform fee),
            // not the mentor's current rate — rates can change after booking.
            const totalEarnings = paidSessions.reduce(
                (sum, session) => sum + Math.round(splitCardCharge(session.amount).tutorEarnings * 100), 0);

            // Calculate current month earnings
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const currentMonthEarnings = paidSessions
                .filter((session) => session.created_at && session.created_at >= startOfMonth)
                .reduce((sum, session) => sum + Math.round(splitCardCharge(session.amount).tutorEarnings * 100), 0);

            // Get Stripe Connect account balance and payout info
            const tutor = await prisma.tutorProfile.findUnique({
                where: { id: tutorId },
                select: { stripe_account_id: true },
            });

            let availableBalance = 0;
            let pendingBalance = 0;
            let nextPayoutDate = null;

            if (tutor?.stripe_account_id) {
                try {
                    // Get balance from Stripe
                    const balance = await stripe.balance.retrieve({
                        stripeAccount: tutor.stripe_account_id,
                    });

                    // Balance is in cents, convert to dollars
                    if (balance.available && balance.available.length > 0) {
                        availableBalance = balance.available[0].amount / 100;
                    }
                    if (balance.pending && balance.pending.length > 0) {
                        pendingBalance = balance.pending[0].amount / 100;
                    }
                } catch (error) {
                    console.error('Error fetching Stripe balance:', error);
                }
            }

            return {
                totalEarnings: isNaN(totalEarnings / 100) ? 0 : totalEarnings / 100,
                currentMonthEarnings: isNaN(currentMonthEarnings / 100) ? 0 : currentMonthEarnings / 100,
                availableBalance: isNaN(availableBalance) ? 0 : availableBalance,
                pendingBalance: isNaN(pendingBalance) ? 0 : pendingBalance,
                nextPayoutDate,
                currency: 'usd',
            };
        } catch (error) {
            console.error('Error getting tutor earnings overview:', error);
            throw error;
        }
    }

    /**
     * Get payment history for a tutor with pagination
     */
    static async getTutorPaymentHistory(
        tutorId: string,
        page: number = 1,
        limit: number = 20,
        startDate?: Date,
        endDate?: Date
    ) {
        try {
            const skip = (page - 1) * limit;

            const whereClause: any = {
                booking: {
                    tutor_id: tutorId,
                },
                status: 'paid',
            };

            if (startDate || endDate) {
                whereClause.created_at = {};
                if (startDate) whereClause.created_at.gte = startDate;
                if (endDate) whereClause.created_at.lte = endDate;
            }

            const [payments, total] = await Promise.all([
                prisma.paymentSchedule.findMany({
                    where: whereClause,
                    include: {
                        booking: {
                            include: {
                                student: {
                                    select: {
                                        username: true,
                                        user: {
                                            select: {
                                                email: true,
                                            },
                                        },
                                    },
                                },
                                lessons: {
                                    select: { id: true, start_time: true, status: true },
                                },
                            },
                        },
                    },
                    orderBy: {
                        created_at: 'desc',
                    },
                    skip,
                    take: limit,
                }),
                prisma.paymentSchedule.count({ where: whereClause }),
            ]);

            const formattedPayments = payments.map((payment) => {
                const { tutorEarnings, platformFee } = splitCardCharge(payment.amount);
                const lesson = matchLesson(payment.due_date, payment.booking.lessons);

                return {
                    id: payment.id,
                    date: payment.created_at,
                    studentName: payment.booking.student.username,
                    // due_date is when the charge was due (before the lesson), not the lesson itself
                    sessionDate: lesson?.start_time ?? null,
                    lessonStatus: lesson?.status ?? null,
                    amountCharged: payment.amount,
                    tutorEarnings,
                    platformFee,
                    status: payment.status,
                    paymentIntentId: payment.stripe_pi_id,
                };
            });

            return {
                payments: formattedPayments,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            console.error('Error getting tutor payment history:', error);
            throw error;
        }
    }

    /**
     * Get upcoming expected payments for a tutor
     */
    static async getTutorUpcomingPayments(tutorId: string) {
        try {
            const now = new Date();

            const upcomingPayments = await prisma.paymentSchedule.findMany({
                where: {
                    booking: {
                        tutor_id: tutorId,
                    },
                    status: 'pending',
                    due_date: {
                        gte: now,
                    },
                },
                include: {
                    booking: {
                        include: {
                            student: {
                                select: {
                                    username: true,
                                },
                            },
                            tutor: {
                                select: {
                                    hourly_rate: true,
                                },
                            },
                            lessons: {
                                select: { id: true, start_time: true, status: true },
                            },
                        },
                    },
                },
                orderBy: {
                    due_date: 'asc',
                },
                take: 10, // Limit to next 10 upcoming payments
            });

            const formattedPayments = upcomingPayments
                .map((payment) => {
                    const sessionRate = Number(payment.booking.tutor.hourly_rate);
                    const platformFee = sessionRate * CARD_PLATFORM_FEE_RATE;
                    const lesson = matchLesson(payment.due_date, payment.booking.lessons);

                    return {
                        id: payment.id,
                        studentName: payment.booking.student.username,
                        sessionDate: lesson?.start_time ?? null,
                        lessonStatus: lesson?.status ?? null,
                        expectedAmount: sessionRate + platformFee,
                        tutorWillReceive: sessionRate,
                        // due_date already is the charge date (before the lesson)
                        paymentDueDate: payment.due_date,
                    };
                })
                // A cancelled lesson will never be charged
                .filter((p) => p.lessonStatus !== 'CANCELLED');

            return formattedPayments;
        } catch (error) {
            console.error('Error getting upcoming payments:', error);
            throw error;
        }
    }

    /**
     * Get tutor's subscription information
     */
    static async getTutorSubscriptionInfo(tutorId: string) {
        try {
            const tutor = await prisma.tutorProfile.findUnique({
                where: { id: tutorId },
                select: {
                    tier: true,
                    stripe_subscription_id: true,
                    subscription_status: true,
                    subscription_end_date: true,
                },
            });

            if (!tutor) {
                throw new Error('Tutor not found');
            }

            let subscriptionDetails = null;

            // Guard against cus_ accidentally stored in stripe_subscription_id
            const validSubId = tutor.stripe_subscription_id?.startsWith('sub_')
                ? tutor.stripe_subscription_id
                : null;

            if (validSubId) {
                try {
                    const subscription = await stripe.subscriptions.retrieve(validSubId);

                    // Type assertion to work around Stripe SDK type wrapper
                    const sub: any = subscription;

                    subscriptionDetails = {
                        plan: tutor.tier,
                        status: tutor.subscription_status,
                        currentPeriodEnd: sub.current_period_end
                            ? new Date(sub.current_period_end * 1000)
                            : tutor.subscription_end_date,
                        amount: sub.items?.data?.[0]?.price?.unit_amount
                            ? sub.items.data[0].price.unit_amount / 100
                            : null,
                        interval: sub.items?.data?.[0]?.price?.recurring?.interval || 'month',
                        cancelAtPeriodEnd: sub.cancel_at_period_end || false,
                    };
                } catch (error) {
                    console.error('Error fetching subscription from Stripe:', error);
                    // Fallback to database info
                    subscriptionDetails = {
                        plan: tutor.tier,
                        status: tutor.subscription_status,
                        currentPeriodEnd: tutor.subscription_end_date,
                        amount: null,
                        interval: null,
                        cancelAtPeriodEnd: false,
                    };
                }
            }

            return subscriptionDetails;
        } catch (error) {
            console.error('Error getting subscription info:', error);
            throw error;
        }
    }

    /**
     * Export payment history to CSV format
     */
    static async exportPaymentHistoryCSV(tutorId: string, startDate?: Date, endDate?: Date) {
        try {
            const { payments } = await this.getTutorPaymentHistory(tutorId, 1, 1000, startDate, endDate);

            // Create CSV header
            const headers = [
                'Date',
                'Student Name',
                'Session Date',
                'Amount Charged',
                'Your Earnings',
                'Platform Fee',
                'Status',
            ];

            // Create CSV rows
            const rows = payments.map((payment) => [
                payment.date?.toISOString().split('T')[0] || '',
                payment.studentName,
                payment.sessionDate ? payment.sessionDate.toISOString().split('T')[0] : '',
                `$${payment.amountCharged.toFixed(2)}`,
                `$${payment.tutorEarnings.toFixed(2)}`,
                `$${payment.platformFee.toFixed(2)}`,
                payment.status,
            ]);

            // Combine headers and rows
            const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');

            return csvContent;
        } catch (error) {
            console.error('Error exporting payment history:', error);
            throw error;
        }
    }
}
