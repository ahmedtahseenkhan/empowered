import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Loader2, Filter } from 'lucide-react';
import { cn } from '../lib/utils'; // Ensure you have this utility or adjust imports

interface Subscription {
    id: string;
    username: string;
    email: string;
    tier: 'STANDARD' | 'PRO' | 'PREMIUM';
    status: string;
    joined_at: string;
    next_billing_date: string;
    amount: number;
}

const SubscriptionsPage: React.FC = () => {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTier, setSelectedTier] = useState<string>('');

    useEffect(() => {
        fetchSubscriptions();
    }, [selectedTier]);

    const fetchSubscriptions = async () => {
        setLoading(true);
        try {
            const params = selectedTier ? { tier: selectedTier } : {};
            const response = await api.get('/admin/subscriptions', { params });
            setSubscriptions(response.data.subscriptions);
        } catch (error) {
            console.error('Failed to fetch subscriptions:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Subscriptions Overview</h1>
                    <p className="text-gray-500 mt-1">Manage mentor subscription plans and statuses.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-4">
                <div className="flex items-center gap-2 text-gray-500">
                    <Filter className="w-4 h-4" />
                    <span className="text-sm font-medium">Filter by Tier:</span>
                </div>
                <div className="flex gap-2">
                    {['STANDARD', 'PRO', 'PREMIUM'].map((tier) => (
                        <button
                            key={tier}
                            onClick={() => setSelectedTier(selectedTier === tier ? '' : tier)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                                selectedTier === tier
                                    ? "bg-primary-50 border-primary-200 text-primary-700"
                                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            )}
                        >
                            {tier}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-gray-900">Mentor</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Plan</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Status</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Amount</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Next Billing</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Joined Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading subscriptions...
                                    </td>
                                </tr>
                            ) : subscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        No subscriptions found.
                                    </td>
                                </tr>
                            ) : (
                                subscriptions.map((sub) => (
                                    <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-medium text-gray-900">{sub.username}</div>
                                                <div className="text-xs text-gray-500">{sub.email}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-1 rounded-full text-xs font-medium border",
                                                sub.tier === 'PREMIUM' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                                    sub.tier === 'PRO' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                        "bg-gray-50 text-gray-700 border-gray-200"
                                            )}>
                                                {sub.tier}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                                {sub.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            ${sub.amount}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {new Date(sub.next_billing_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {new Date(sub.joined_at).toLocaleDateString()}
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

export default SubscriptionsPage;
