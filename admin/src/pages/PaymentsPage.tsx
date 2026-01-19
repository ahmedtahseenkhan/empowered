import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Loader2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface Payment {
    id: string;
    tutor: string;
    type: 'SUBSCRIPTION' | 'COURSE_SALE';
    amount: number;
    status: string;
    date: string;
}

const PaymentsPage: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'ALL' | 'SUBSCRIPTION' | 'COURSE_SALE'>('ALL');

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/payments');
            setPayments(response.data.payments);
        } catch (error) {
            console.error('Failed to fetch payments:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPayments = activeTab === 'ALL'
        ? payments
        : payments.filter(p => p.type === activeTab);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Financial Dashboard</h1>
                    <p className="text-gray-500 mt-1">Track payouts, subscriptions, and course sales.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                    {['ALL', 'SUBSCRIPTION', 'COURSE_SALE'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={cn(
                                "py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                                activeTab === tab
                                    ? "border-primary-500 text-primary-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            {tab === 'ALL' ? 'All Transactions' : tab === 'SUBSCRIPTION' ? 'Tutor Subscriptions' : 'Course Sales'}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-gray-900">Transaction ID</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Type</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Tutor / User</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Amount</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Status</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading payments...
                                    </td>
                                </tr>
                            ) : filteredPayments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        No transactions found.
                                    </td>
                                </tr>
                            ) : (
                                filteredPayments.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-gray-500 text-xs">
                                            {payment.id}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {payment.type === 'SUBSCRIPTION' ? (
                                                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                        <ArrowUpRight className="w-4 h-4" />
                                                    </div>
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                                                        <ArrowDownLeft className="w-4 h-4" />
                                                    </div>
                                                )}
                                                <span className="font-medium text-gray-900">
                                                    {payment.type === 'SUBSCRIPTION' ? 'Subscription' : 'Course Sale'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-700">
                                            {payment.tutor}
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-gray-900">
                                            ${(payment.amount / 100).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-1 rounded-full text-xs font-medium border",
                                                payment.status === 'SUCCEEDED' ? "bg-green-50 text-green-700 border-green-200" :
                                                    "bg-red-50 text-red-700 border-red-200"
                                            )}>
                                                {payment.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {new Date(payment.date).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PaymentsPage;
