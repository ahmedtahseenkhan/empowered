import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import axios from 'axios';

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

interface UpcomingPayment {
    id: string;
    studentName: string;
    sessionDate: string;
    expectedAmount: number;
    tutorWillReceive: number;
    paymentDueDate: string;
}

interface SubscriptionInfo {
    plan: string;
    status: string;
    currentPeriodEnd: string;
    amount: number | null;
    interval: string | null;
    cancelAtPeriodEnd: boolean;
}

const PaymentsPage: React.FC = () => {
    const [overview, setOverview] = useState<EarningsOverview | null>(null);
    const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
    const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>([]);
    const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        fetchAllData();
    }, [currentPage]);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [overviewRes, historyRes, upcomingRes, subscriptionRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/payments/tutor/earnings/overview`, { headers }),
                axios.get(`${import.meta.env.VITE_API_URL}/api/payments/tutor/earnings/history?page=${currentPage}&limit=10`, { headers }),
                axios.get(`${import.meta.env.VITE_API_URL}/api/payments/tutor/earnings/upcoming`, { headers }),
                axios.get(`${import.meta.env.VITE_API_URL}/api/payments/tutor/subscription-info`, { headers }),
            ]);

            setOverview(overviewRes.data || null);
            setPaymentHistory(historyRes.data?.payments || []);
            setTotalPages(historyRes.data?.pagination?.totalPages || 1);
            setUpcomingPayments(upcomingRes.data || []);
            setSubscriptionInfo(subscriptionRes.data || null);
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
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/api/payments/tutor/earnings/export`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob',
                }
            );

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

                {/* Payment History */}
                <Card className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 Payment History</h2>
                    <div className="overflow-x-auto">
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
                        <div className="overflow-x-auto">
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

                {/* Payout Settings & Subscription Info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Payout Settings */}
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

                    {/* Subscription Info */}
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
                </div>
            </div>
        </DashboardLayout>
    );
};

export default PaymentsPage;
