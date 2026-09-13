import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet, Lock, Sparkles, Info, CreditCard, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';
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
    frozen?: boolean;
    freeze_reason?: string | null;
    config: {
        enabled: boolean;
        feePercent: number;
        settlementDays: number;
        weeksPerBooking: number;
        cancelCutoffHours: number;
        purchaseMinCredits?: number;
        purchaseMaxCredits?: number;
        purchasePackages?: number[];
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
    const [searchParams, setSearchParams] = useSearchParams();

    const [buyAmount, setBuyAmount] = useState('');
    const [buyBusy, setBuyBusy] = useState(false);
    const [buyError, setBuyError] = useState('');
    const [purchaseNotice, setPurchaseNotice] = useState('');

    const refresh = useCallback(async () => {
        const [w, h] = await Promise.all([api.get('/wallet/me'), api.get('/wallet/me/history')]);
        setWallet(w.data);
        setEntries(h.data?.entries || []);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await refresh();
            } catch (e) {
                if (!cancelled) setError(apiError(e, 'Failed to load your credits.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [refresh]);

    // Returning from Stripe Checkout: credit the purchase (idempotent with the webhook).
    useEffect(() => {
        const sessionId = searchParams.get('purchase_session_id');
        if (!sessionId) return;
        (async () => {
            try {
                await api.post('/wallet/purchase/finalize', { sessionId });
                setPurchaseNotice('Payment received — your credits have been added to your wallet.');
                await refresh();
            } catch (e) {
                setPurchaseNotice(apiError(e, 'We could not confirm your purchase automatically. It may take a minute — refresh this page.'));
            } finally {
                searchParams.delete('purchase_session_id');
                setSearchParams(searchParams, { replace: true });
            }
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const packages = useMemo(() => wallet?.config.purchasePackages?.length ? wallet.config.purchasePackages : [25, 50, 100, 200], [wallet]);
    const minBuy = wallet?.config.purchaseMinCredits ?? 10;
    const maxBuy = wallet?.config.purchaseMaxCredits ?? 1000;

    const startPurchase = async (credits: number) => {
        try {
            setBuyBusy(true);
            setBuyError('');
            const base = window.location.origin;
            const res = await api.post('/wallet/purchase', {
                credits,
                successUrl: `${base}/student/wallet`,
                cancelUrl: `${base}/student/wallet`,
            });
            const url = res.data?.url as string | undefined;
            if (!url) throw new Error('No checkout URL returned');
            window.location.href = url;
        } catch (e) {
            setBuyError(apiError(e, 'Failed to start the purchase.'));
            setBuyBusy(false);
        }
    };

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

                {purchaseNotice && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm flex items-start justify-between gap-3">
                        <span>{purchaseNotice}</span>
                        <button type="button" className="text-emerald-700 text-xs underline" onClick={() => setPurchaseNotice('')}>Dismiss</button>
                    </div>
                )}

                {wallet?.frozen && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>Your wallet is currently on hold while our team reviews recent activity. You can't buy credits or book new sessions right now — please contact support.</span>
                    </div>
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

                {!wallet?.frozen && (
                    <Card className="p-6">
                        <div className="flex items-center gap-2 mb-1">
                            <CreditCard className="w-5 h-5 text-[#4A1D96]" />
                            <h2 className="text-lg font-semibold text-gray-900">Buy Learning Credits</h2>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">1 credit = $1, paid securely through Stripe. Credits land in your wallet instantly after payment.</p>
                        <div className="flex flex-wrap gap-2">
                            {packages.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    disabled={buyBusy}
                                    onClick={() => startPurchase(p)}
                                    className="px-5 py-3 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 font-semibold text-sm disabled:opacity-50"
                                >
                                    {p} credits
                                    <span className="block text-xs font-normal text-purple-700">${p}.00</span>
                                </button>
                            ))}
                        </div>
                        <div className="mt-4 flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Custom amount</label>
                                <input
                                    type="number"
                                    min={minBuy}
                                    max={maxBuy}
                                    step={1}
                                    value={buyAmount}
                                    onChange={(e) => setBuyAmount(e.target.value)}
                                    placeholder={`${minBuy}–${maxBuy}`}
                                    className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    disabled={buyBusy}
                                />
                            </div>
                            <Button
                                size="sm"
                                disabled={buyBusy || !buyAmount || !Number.isInteger(Number(buyAmount)) || Number(buyAmount) < minBuy || Number(buyAmount) > maxBuy}
                                onClick={() => startPurchase(Number(buyAmount))}
                            >
                                {buyBusy ? 'Redirecting…' : `Buy${buyAmount ? ` ${buyAmount} credits ($${buyAmount})` : ' credits'}`}
                            </Button>
                        </div>
                        {buyError && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{buyError}</div>}
                        <p className="mt-3 text-xs text-gray-500">Credits can only be used on EmpowerEd Learnings and can't be withdrawn as cash. They never expire.</p>
                    </Card>
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
                            <p className="text-xs text-gray-500 pt-1">Buy credits any time with the form above — they're added to your wallet the moment payment completes.</p>
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
