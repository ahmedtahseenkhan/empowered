import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import api from '../api/axios';

interface EarningsOverview {
    totalEarnings: number;
    currentMonthEarnings: number;
    availableBalance: number;
    pendingBalance: number;
    nextPayoutDate: string | null;
    currency: string;
}

interface PaymentHistory {
    id: string;
    date: string;
    studentName: string;
    sessionDate: string;
    amountCharged: number;
    tutorEarnings: number;
    platformFee: number;
    status: string;
}

interface WalletEarning {
    id: string;
    lesson_id: string;
    student_name: string;
    session_start: string;
    gross_cents: number;
    fee_cents: number;
    net_cents: number;
    fee_percent: number;
    status: 'PENDING' | 'ON_HOLD' | 'AVAILABLE' | 'TRANSFERRED' | 'PAID' | 'REVERSED' | string;
    available_at: string;
    paid_at?: string | null;
    dispute_status?: string | null;
}

interface WalletEarnings {
    config: { feePercent: number; settlementDays: number; payoutMinimumCents: number };
    totals: {
        pending_cents: number;
        on_hold_cents: number;
        available_cents: number;
        paid_cents: number;
        reversed_cents: number;
        lifetime_gross_cents: number;
        lifetime_fee_cents: number;
    };
    earnings: WalletEarning[];
}

interface UpcomingPayment {
    id: string;
    studentName: string;
    sessionDate: string;
    expectedAmount: number;
    tutorWillReceive: number;
    paymentDueDate: string;
}


const PaymentsPage: React.FC = () => {
    const [overview, setOverview] = useState<EarningsOverview | null>(null);
    const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
    const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>([]);
    const [walletEarnings, setWalletEarnings] = useState<WalletEarnings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        fetchAllData();
    }, [currentPage]);

    const fetchAllData = async () => {
        // Learning Credit earnings (independent of the Stripe-based history below)
        api.get('/wallet/mentor/earnings')
            .then((r) => setWalletEarnings(r.data || null))
            .catch(() => setWalletEarnings(null));

        try {
            setLoading(true);
            setError(null);
            const [overviewRes, historyRes, upcomingRes] = await Promise.all([
                api.get('/payments/tutor/earnings/overview'),
                api.get(`/payments/tutor/earnings/history?page=${currentPage}&limit=10`),
                api.get('/payments/tutor/earnings/upcoming'),
            ]);

            setOverview(overviewRes.data || null);
            setPaymentHistory(historyRes.data?.payments || []);
            setTotalPages(historyRes.data?.pagination?.totalPages || 1);
            setUpcomingPayments(upcomingRes.data || []);
        } catch (error: any) {
            console.error('Error fetching payment data:', error);
            console.error('Error details:', error.response?.data || error.message);

            // Check if it's a 404 (tutor profile not found)
            if (error.response?.status === 404) {
                setError('Tutor profile not found. Please complete your tutor profile setup first.');
            } else {
                setError('Failed to load payment data. Please try again later.');
            }

            // Set safe defaults on error
            setPaymentHistory([]);
            setUpcomingPayments([]);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = async () => {
        try {
            const response = await api.get('/payments/tutor/earnings/export', {
                responseType: 'blob',
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payment-history-${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error exporting CSV:', error);
        }
    };

    const formatCurrency = (amount: number | undefined | null) => {
        // Convert NaN, undefined, or null to 0
        const validAmount = amount && !isNaN(amount) ? amount : 0;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(validAmount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="w-full flex items-center justify-center min-h-[400px]">
                    <div className="text-gray-600">Loading payment information...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (error) {
        return (
            <DashboardLayout>
                <div className="w-full flex flex-col items-center justify-center min-h-[400px]">
                    <div className="text-red-600 text-lg mb-4">⚠️ {error}</div>
                    <button
                        onClick={() => fetchAllData()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="w-full space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
                    <button
                        onClick={handleExportCSV}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Export CSV
                    </button>
                </div>

                {/* Earnings Overview */}
                {overview && (
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">💰 Earnings Overview</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <div className="text-sm text-gray-600 mb-1">Total Earnings</div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {formatCurrency(overview.totalEarnings)}
                                </div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <div className="text-sm text-gray-600 mb-1">Current Month</div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {formatCurrency(overview.currentMonthEarnings)}
                                </div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg">
                                <div className="text-sm text-gray-600 mb-1">Available Balance</div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {formatCurrency(overview.availableBalance)}
                                </div>
                            </div>
                            <div className="bg-yellow-50 p-4 rounded-lg">
                                <div className="text-sm text-gray-600 mb-1">Pending Payout</div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {formatCurrency(overview.pendingBalance)}
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Learning Credit earnings */}
                {walletEarnings && (
                    <Card className="p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">🎓 Learning Credit Earnings</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Sessions paid with Learning Credits. Earnings become payout-ready after a {walletEarnings.config.settlementDays}-day settlement &amp; review period.
                                    A {walletEarnings.config.feePercent}% Payment &amp; Settlement Fee is applied to each completed session.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-amber-50 p-4 rounded-lg">
                                <div className="text-sm text-gray-600 mb-1">Pending (in review window)</div>
                                <div className="text-2xl font-bold text-gray-900">{formatCurrency(walletEarnings.totals.pending_cents / 100)}</div>
                                {walletEarnings.totals.on_hold_cents > 0 && (
                                    <div className="text-xs text-amber-700 mt-1">{formatCurrency(walletEarnings.totals.on_hold_cents / 100)} on hold (reported)</div>
                                )}
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <div className="text-sm text-gray-600 mb-1">Payout-ready</div>
                                <div className="text-2xl font-bold text-gray-900">{formatCurrency(walletEarnings.totals.available_cents / 100)}</div>
                                <div className="text-xs text-gray-500 mt-1">Paid monthly once you reach {formatCurrency(walletEarnings.config.payoutMinimumCents / 100)}</div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg">
                                <div className="text-sm text-gray-600 mb-1">Paid out</div>
                                <div className="text-2xl font-bold text-gray-900">{formatCurrency(walletEarnings.totals.paid_cents / 100)}</div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <div className="text-sm text-gray-600 mb-1">Lifetime (before fee)</div>
                                <div className="text-2xl font-bold text-gray-900">{formatCurrency(walletEarnings.totals.lifetime_gross_cents / 100)}</div>
                                <div className="text-xs text-gray-500 mt-1">Fees: {formatCurrency(walletEarnings.totals.lifetime_fee_cents / 100)}</div>
                            </div>
                        </div>

                        {walletEarnings.earnings.length > 0 && (
                            <div className="mt-6 overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Session price</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fee</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Your earnings</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                        {walletEarnings.earnings.map((e) => {
                                            const statusLabel: Record<string, { text: string; cls: string }> = {
                                                PENDING: { text: `In review until ${formatDate(e.available_at)}`, cls: 'bg-amber-100 text-amber-800' },
                                                ON_HOLD: { text: 'On hold — reported by student', cls: 'bg-red-100 text-red-800' },
                                                AVAILABLE: { text: 'Payout-ready', cls: 'bg-green-100 text-green-800' },
                                                TRANSFERRED: { text: 'Transferred', cls: 'bg-purple-100 text-purple-800' },
                                                PAID: { text: e.paid_at ? `Paid ${formatDate(e.paid_at)}` : 'Paid', cls: 'bg-purple-100 text-purple-800' },
                                                REVERSED: { text: 'Refunded to student', cls: 'bg-gray-100 text-gray-700' },
                                            };
                                            const st = statusLabel[e.status] || { text: e.status, cls: 'bg-gray-100 text-gray-700' };
                                            return (
                                                <tr key={e.id}>
                                                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{formatDate(e.session_start)}</td>
                                                    <td className="px-4 py-3 text-gray-700">{e.student_name}</td>
                                                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(e.gross_cents / 100)}</td>
                                                    <td className="px-4 py-3 text-right text-gray-500">−{formatCurrency(e.fee_cents / 100)}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(e.net_cents / 100)}</td>
                                                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${st.cls}`}>{st.text}</span></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                )}

                {/* Payment History */}
                <Card className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 Payment History</h2>

                    {/* Mobile: stacked cards */}
                    <div className="md:hidden space-y-3">
                        {paymentHistory.length === 0 ? (
                            <p className="text-center text-gray-500 py-6 text-sm">No payment history yet</p>
                        ) : (
                            paymentHistory.map((payment) => (
                                <div key={payment.id} className="border border-gray-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="font-medium text-gray-900">{payment.studentName}</span>
                                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs whitespace-nowrap">
                                            ✅ {payment.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm py-0.5">
                                        <span className="text-gray-500">Paid on</span>
                                        <span className="text-gray-900">{formatDate(payment.date)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm py-0.5">
                                        <span className="text-gray-500">Session</span>
                                        <span className="text-gray-600">{formatDate(payment.sessionDate)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm py-0.5">
                                        <span className="text-gray-500">Charged</span>
                                        <span className="text-gray-900">{formatCurrency(payment.amountCharged)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm py-0.5">
                                        <span className="text-gray-500">Your earnings</span>
                                        <span className="font-semibold text-green-600">{formatCurrency(payment.tutorEarnings)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop: table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Student
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Session Date
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Charged
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Your Earnings
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {paymentHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                            No payment history yet
                                        </td>
                                    </tr>
                                ) : (
                                    paymentHistory.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-4 text-sm text-gray-900">
                                                {formatDate(payment.date)}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-900">
                                                {payment.studentName}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-600">
                                                {formatDate(payment.sessionDate)}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-900">
                                                {formatCurrency(payment.amountCharged)}
                                            </td>
                                            <td className="px-4 py-4 text-sm font-semibold text-green-600">
                                                {formatCurrency(payment.tutorEarnings)}
                                            </td>
                                            <td className="px-4 py-4 text-sm">
                                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                                    ✅ {payment.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="mt-4 flex items-center justify-between">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-gray-600">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </Card>

                {/* Upcoming Expected Payments */}
                {Array.isArray(upcomingPayments) && upcomingPayments.length > 0 && (
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">📅 Upcoming Expected Payments</h2>

                        {/* Mobile: stacked cards */}
                        <div className="md:hidden space-y-3">
                            {upcomingPayments.map((payment) => (
                                <div key={payment.id} className="border border-gray-200 rounded-xl p-4">
                                    <div className="font-medium text-gray-900 mb-2">{payment.studentName}</div>
                                    <div className="flex justify-between text-sm py-0.5">
                                        <span className="text-gray-500">Session</span>
                                        <span className="text-gray-600">{formatDate(payment.sessionDate)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm py-0.5">
                                        <span className="text-gray-500">Expected</span>
                                        <span className="font-semibold text-gray-900">{formatCurrency(payment.expectedAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm py-0.5">
                                        <span className="text-gray-500">Due</span>
                                        <span className="text-gray-600">{formatDate(payment.paymentDueDate)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop: table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Student
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Session Date
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Expected Amount
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Payment Due
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {upcomingPayments.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-4 text-sm text-gray-900">
                                                {payment.studentName}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-600">
                                                {formatDate(payment.sessionDate)}
                                            </td>
                                            <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                                                {formatCurrency(payment.expectedAmount)}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-600">
                                                {formatDate(payment.paymentDueDate)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {/* Payout Settings & Subscription Info - HIDDEN FOR NOW */}
                {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">🏦 Payout Settings</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Status:</span>
                                <span className="text-sm font-semibold text-green-600">✅ Verified & Active</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Schedule:</span>
                                <span className="text-sm text-gray-900">Automatic (Stripe)</span>
                            </div>
                            <button className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                Manage Payout Settings →
                            </button>
                        </div>
                    </Card>

                    {subscriptionInfo && (
                        <Card className="p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">📱 My Subscription</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Plan:</span>
                                    <span className="text-sm font-semibold text-gray-900">
                                        {subscriptionInfo.plan} Plan
                                    </span>
                                </div>
                                {subscriptionInfo.amount && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Cost:</span>
                                        <span className="text-sm text-gray-900">
                                            {formatCurrency(subscriptionInfo.amount)} / {subscriptionInfo.interval}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Next Billing:</span>
                                    <span className="text-sm text-gray-900">
                                        {formatDate(subscriptionInfo.currentPeriodEnd)}
                                    </span>
                                </div>
                                <button className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                                    Manage Subscription
                                </button>
                            </div>
                        </Card>
                    )}
                </div> */}
            </div>
        </DashboardLayout>
    );
};

export default PaymentsPage;
