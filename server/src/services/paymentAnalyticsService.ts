import prisma from '../config/db';
import Stripe from 'stripe';

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
                include: {
                    booking: {
                        include: {
                            tutor: {
                                select: {
                                    hourly_rate: true,
                                },
                            },
                        },
                    },
                },
            });

            // Calculate total earnings (all time) - using tutor's hourly_rate, not total payment
            const totalEarnings = paidSessions.reduce((sum, session) => {
                const tutorEarning = Number(session.booking.tutor.hourly_rate) * 100; // Convert to cents
                return sum + tutorEarning;
            }, 0);

            // Calculate current month earnings
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const currentMonthEarnings = paidSessions
                .filter((session) => session.created_at && session.created_at >= startOfMonth)
                .reduce((sum, session) => {
                    const tutorEarning = Number(session.booking.tutor.hourly_rate) * 100; // Convert to cents
                    return sum + tutorEarning;
                }, 0);

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
                                tutor: {
                                    select: {
                                        hourly_rate: true,
                                    },
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
                const sessionRate = Number(payment.booking.tutor.hourly_rate);
                const platformFeePercentage = 0.10;
                const platformFee = sessionRate * platformFeePercentage;
                const totalCharged = sessionRate + platformFee;

                return {
                    id: payment.id,
                    date: payment.created_at,
                    studentName: payment.booking.student.username,
                    sessionDate: payment.due_date,
                    amountCharged: totalCharged,
                    tutorEarnings: sessionRate,
                    platformFee: platformFee,
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
                        },
                    },
                },
                orderBy: {
                    due_date: 'asc',
                },
                take: 10, // Limit to next 10 upcoming payments
            });

            const formattedPayments = upcomingPayments.map((payment) => {
                const sessionRate = Number(payment.booking.tutor.hourly_rate);
                const platformFeePercentage = 0.10;
                const platformFee = sessionRate * platformFeePercentage;
                const totalExpected = sessionRate + platformFee;

                // Payment is typically charged 48 hours before session
                const paymentDueDate = new Date(payment.due_date);
                paymentDueDate.setHours(paymentDueDate.getHours() - 48);

                return {
                    id: payment.id,
                    studentName: payment.booking.student.username,
                    sessionDate: payment.due_date,
                    expectedAmount: totalExpected,
                    tutorWillReceive: sessionRate,
                    paymentDueDate: paymentDueDate,
                };
            });

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

            if (tutor.stripe_subscription_id) {
                try {
                    const subscription = await stripe.subscriptions.retrieve(tutor.stripe_subscription_id);

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
                payment.sessionDate.toISOString().split('T')[0],
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
