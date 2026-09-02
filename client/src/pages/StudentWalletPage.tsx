import React, { useEffect, useState } from 'react';
import { Wallet, Lock, Sparkles, Info } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import api from '../api/axios';

const apiError = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

type WalletData = {
    available: number;
    promotional: number;
    purchased: number;
    reserved: number;
    config: {
        enabled: boolean;
        feePercent: number;
        settlementDays: number;
        weeksPerBooking: number;
        cancelCutoffHours: number;
    };
};

type Entry = {
    id: string;
    amount: number;
    type: string;
    source?: string | null;
    balance_after?: number | null;
    description?: string | null;
    created_at: string;
    metadata?: Record<string, unknown> | null;
};

const TYPE_LABEL: Record<string, string> = {
    PURCHASE: 'Credits purchased',
    PROMO_GRANT: 'Credits added',
    MANUAL_ADJUSTMENT: 'Adjustment',
    RESERVE: 'Reserved for session',
    UNRESERVE: 'Returned to wallet',
    RELEASE: 'Session completed',
    REVERSAL: 'Refunded after review',
    CANCELLATION_REFUND: 'Refund',
    USAGE: 'Used',
};

const StudentWalletPage: React.FC = () => {
    const [wallet, setWallet] = useState<WalletData | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [w, h] = await Promise.all([api.get('/wallet/me'), api.get('/wallet/me/history')]);
                if (cancelled) return;
                setWallet(w.data);
                setEntries(h.data?.entries || []);
            } catch (e) {
                if (!cancelled) setError(apiError(e, 'Failed to load your credits.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const fmtDate = (iso: string) =>
        new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

    const amountCell = (e: Entry) => {
        if (e.type === 'RELEASE') {
            const released = Number((e.metadata as { credits_released?: number } | null)?.credits_released || 0);
            return <span className="text-gray-500">{released ? `${released} released` : '—'}</span>;
        }
        if (e.amount > 0) return <span className="font-semibold text-emerald-700">+{e.amount}</span>;
        if (e.amount < 0) return <span className="font-semibold text-gray-900">{e.amount}</span>;
        return <span className="text-gray-500">—</span>;
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="min-h-[50vh] flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="w-full space-y-6">
                <div>
                    <div className="flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-[#4A1D96]" />
                        <h1 className="text-3xl font-bold text-gray-900">My Learning Credits</h1>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                        Learning Credits are used to reserve sessions with mentors. 1 credit = $1.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
                )}

                {wallet && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 overflow-hidden">
                            <div className="absolute left-0 inset-y-0 w-1 rounded-l-2xl bg-purple-500" />
                            <div className="flex items-center gap-3 pl-1">
                                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600"><Wallet className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500">Available credits</p>
                                    <p className="text-2xl font-bold text-gray-900 leading-none mt-0.5">{wallet.available}</p>
                                </div>
                            </div>
                        </div>
                        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 overflow-hidden">
                            <div className="absolute left-0 inset-y-0 w-1 rounded-l-2xl bg-amber-500" />
                            <div className="flex items-center gap-3 pl-1">
                                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Lock className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500">Reserved for upcoming sessions</p>
                                    <p className="text-2xl font-bold text-gray-900 leading-none mt-0.5">{wallet.reserved}</p>
                                </div>
                            </div>
                        </div>
                        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 overflow-hidden">
                            <div className="absolute left-0 inset-y-0 w-1 rounded-l-2xl bg-emerald-500" />
                            <div className="flex items-center gap-3 pl-1">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><Sparkles className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500">Promotional credits included</p>
                                    <p className="text-2xl font-bold text-gray-900 leading-none mt-0.5">{wallet.promotional}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <Card className="p-5 bg-purple-50/60 border-purple-100">
                    <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-purple-700 mt-0.5 shrink-0" />
                        <div className="text-sm text-gray-700 space-y-1">
                            <p className="font-semibold text-gray-900">How Learning Credits work</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>When you continue with a mentor, credits for <span className="font-medium">{wallet?.config.weeksPerBooking || 4} weekly sessions</span> are reserved up front (mentor rate × sessions).</li>
                                <li>Credits are only released to the mentor after each session is completed — one session at a time.</li>
                                <li>Cancel an upcoming session more than {wallet?.config.cancelCutoffHours || 24} hours before it starts and the credits return to your wallet instantly.</li>
                                <li>Had a problem with a session? Report it within {wallet?.config.settlementDays || 7} days from your sessions page and our team will review it.</li>
                                <li>Credits can only be used on EmpowerEd Learnings and cannot be withdrawn as cash. They never expire.</li>
                            </ul>
                            <p className="text-xs text-gray-500 pt-1">Need more credits during beta? Contact the EmpowerEd team and we'll top up your wallet.</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Credit history</h2>
                    {entries.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">No credit activity yet.</p>
                    ) : (
                        <>
                            <div className="md:hidden space-y-3">
                                {entries.map((e) => (
                                    <div key={e.id} className="border border-gray-200 rounded-xl p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-gray-900">{TYPE_LABEL[e.type] || e.type}</span>
                                            <span>{amountCell(e)}</span>
                                        </div>
                                        {e.description && <p className="text-xs text-gray-600 mt-1">{e.description}</p>}
                                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                                            <span>{fmtDate(e.created_at)}</span>
                                            {typeof e.balance_after === 'number' && <span>Balance: {e.balance_after}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credits</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {entries.map((e) => (
                                            <tr key={e.id}>
                                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(e.created_at)}</td>
                                                <td className="px-4 py-3 font-medium text-gray-900">{TYPE_LABEL[e.type] || e.type}</td>
                                                <td className="px-4 py-3 text-gray-600">{e.description || '—'}</td>
                                                <td className="px-4 py-3 text-right tabular-nums">{amountCell(e)}</td>
                                                <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{typeof e.balance_after === 'number' ? e.balance_after : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default StudentWalletPage;
