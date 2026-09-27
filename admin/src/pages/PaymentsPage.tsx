import React, { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { Loader2, ArrowUpRight, ArrowDownLeft, AlertOctagon, Banknote } from 'lucide-react';
import { cn } from '../lib/utils';

const apiError = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

interface Payment {
    id: string;
    tutor: string;
    type: 'SUBSCRIPTION' | 'COURSE_SALE';
    amount: number;
    status: string;
    date: string;
}

interface Dispute {
    id: string;
    reason: string;
    status: 'OPEN' | 'RESOLVED_REFUNDED' | 'RESOLVED_RELEASED';
    resolution_note?: string | null;
    created_at: string;
    resolved_at?: string | null;
    student: { id: string; username: string; user?: { email?: string } };
    tutor: { id: string; username: string; user?: { email?: string } };
    lesson: {
        id: string;
        start_time: string;
        status: string;
        earning?: { id: string; gross_cents: number; fee_cents: number; net_cents: number; status: string; available_at: string } | null;
    };
}

interface PayoutDetails {
    method: 'STRIPE' | 'ZELLE' | 'BANK_TRANSFER' | null;
    stripe_connected: boolean;
    zelle_contact: string | null;
    bank: { bank_name: string | null; account_name: string | null; account_number: string | null; routing: string | null; notes: string | null };
}

interface MentorEarningRow {
    tutor: { id: string; username: string; stripe_account_id?: string | null; user?: { email?: string }; payout?: PayoutDetails };
    totals: Record<string, { count: number; net_cents: number; gross_cents: number; fee_cents: number; promo_cents: number }>;
}

interface PayoutRecord {
    id: string;
    period: string;
    amount_cents: number;
    status: string;
    method?: string | null;
    proof_url?: string | null;
    note?: string | null;
    stripe_transfer_id?: string | null;
    created_at: string;
    paid_at?: string | null;
    tutor: { id: string; username: string; user?: { email?: string } };
}

const METHOD_LABEL: Record<string, string> = { STRIPE: 'Stripe', ZELLE: 'Zelle', BANK_TRANSFER: 'Bank transfer' };

const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');
const resolveProofUrl = (url?: string | null) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
};

type Tab = 'ALL' | 'SUBSCRIPTION' | 'COURSE_SALE' | 'DISPUTES' | 'MENTOR_EARNINGS';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const PaymentsPage: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('ALL');

    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [disputeFilter, setDisputeFilter] = useState<'OPEN' | 'ALL'>('OPEN');
    const [disputesLoading, setDisputesLoading] = useState(false);
    const [mentorRows, setMentorRows] = useState<MentorEarningRow[]>([]);
    const [mentorsLoading, setMentorsLoading] = useState(false);
    const [config, setConfig] = useState<{ feePercent: number; settlementDays: number; payoutMinimumCents: number } | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

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

    const fetchDisputes = useCallback(async () => {
        setDisputesLoading(true);
        try {
            const res = await api.get('/admin/wallet/disputes', { params: disputeFilter === 'OPEN' ? { status: 'OPEN' } : {} });
            setDisputes(res.data.disputes || []);
        } catch (e) {
            console.error('Failed to fetch disputes', e);
        } finally {
            setDisputesLoading(false);
        }
    }, [disputeFilter]);

    const fetchMentorEarnings = useCallback(async () => {
        setMentorsLoading(true);
        try {
            const res = await api.get('/admin/wallet/mentor-earnings');
            setMentorRows(res.data.mentors || []);
            setConfig(res.data.config || null);
        } catch (e) {
            console.error('Failed to fetch mentor earnings', e);
        } finally {
            setMentorsLoading(false);
        }
    }, []);

    const fetchPayoutHistory = useCallback(async () => {
        try {
            const res = await api.get('/admin/wallet/payouts');
            setPayoutHistory(res.data.payouts || []);
        } catch (e) {
            console.error('Failed to fetch payouts', e);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'DISPUTES') fetchDisputes();
        if (activeTab === 'MENTOR_EARNINGS') { fetchMentorEarnings(); fetchPayoutHistory(); }
    }, [activeTab, fetchDisputes, fetchMentorEarnings, fetchPayoutHistory]);

    const resolveDispute = async (d: Dispute, action: 'REFUND' | 'RELEASE') => {
        const label = action === 'REFUND'
            ? `Return ${money(d.lesson.earning?.gross_cents || 0)} in credits to ${d.student.username} and cancel the mentor's earning?`
            : `Release ${money(d.lesson.earning?.net_cents || 0)} to ${d.tutor.username} (report dismissed)?`;
        const note = prompt(`${label}\n\nOptional note for the record:`);
        if (note === null) return;
        setBusyId(d.id);
        try {
            await api.put(`/admin/wallet/disputes/${d.id}/resolve`, { action, note });
            await fetchDisputes();
        } catch (e) {
            alert(apiError(e, 'Failed to resolve dispute'));
        } finally {
            setBusyId(null);
        }
    };

    const [settlementBusy, setSettlementBusy] = useState(false);
    const [payoutHistory, setPayoutHistory] = useState<PayoutRecord[]>([]);
    const [payoutTarget, setPayoutTarget] = useState<MentorEarningRow | null>(null);
    const [payoutMethod, setPayoutMethod] = useState<string>('BANK_TRANSFER');
    const [payoutNote, setPayoutNote] = useState('');
    const [proofUrl, setProofUrl] = useState('');
    const [proofBusy, setProofBusy] = useState(false);
    const [payoutSubmitBusy, setPayoutSubmitBusy] = useState(false);
    const [payoutError, setPayoutError] = useState('');

    const uploadProof = async (file: File) => {
        setProofBusy(true);
        setPayoutError('');
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(String(r.result));
                r.onerror = () => reject(new Error('Could not read the file'));
                r.readAsDataURL(file);
            });
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
                const res = await api.post('/uploads/image', { dataUrl, fileName: file.name });
                setProofUrl(res.data?.url || '');
            } else if (ext === 'pdf') {
                const res = await api.post('/uploads/base64', { dataUrl, fileName: file.name });
                setProofUrl(res.data?.attachment?.file_url || '');
            } else {
                setPayoutError('Proof must be an image (JPG/PNG/WEBP) or a PDF.');
            }
        } catch (e) {
            setPayoutError(apiError(e, 'Failed to upload the proof file.'));
        } finally {
            setProofBusy(false);
        }
    };

    const openPayoutModal = (row: MentorEarningRow) => {
        setPayoutTarget(row);
        setPayoutMethod(row.tutor.payout?.method || 'BANK_TRANSFER');
        setPayoutNote('');
        setProofUrl('');
        setPayoutError('');
    };

    const submitPayout = async () => {
        if (!payoutTarget) return;
        if (!payoutNote.trim()) { setPayoutError('Enter a payout reference (transfer ID, Zelle confirmation, date…).'); return; }
        setPayoutSubmitBusy(true);
        setPayoutError('');
        try {
            await api.put(`/admin/wallet/mentors/${payoutTarget.tutor.id}/mark-paid`, {
                note: payoutNote.trim(),
                method: payoutMethod,
                proofUrl: proofUrl || undefined,
            });
            setPayoutTarget(null);
            await Promise.all([fetchMentorEarnings(), fetchPayoutHistory()]);
        } catch (e) {
            setPayoutError(apiError(e, 'Failed to record payout'));
        } finally {
            setPayoutSubmitBusy(false);
        }
    };
    const runSettlement = async () => {
        if (!confirm('Run the monthly settlement now?\n\nEvery mentor with payout-ready earnings above the minimum and a connected Stripe account will receive one Stripe transfer.')) return;
        setSettlementBusy(true);
        try {
            const res = await api.post('/admin/wallet/settlement/run', {});
            const d = res.data;
            if (d?.already_ran) {
                alert(`Settlement for ${d.period} already ran this month. Balances roll forward to the next run.`);
            } else {
                alert(`Settlement ${d?.period}: ${d?.created ?? 0} payout(s) sent, ${money(d?.total_cents || 0)} total, ${d?.skipped ?? 0} mentor(s) rolled forward.`);
            }
            await fetchMentorEarnings();
        } catch (e) {
            alert(apiError(e, 'Failed to run settlement'));
        } finally {
            setSettlementBusy(false);
        }
    };

    const filteredPayments = activeTab === 'ALL'
        ? payments
        : payments.filter(p => p.type === activeTab);

    const TABS: Array<{ key: Tab; label: string }> = [
        { key: 'ALL', label: 'All Transactions' },
        { key: 'SUBSCRIPTION', label: 'Tutor Subscriptions' },
        { key: 'COURSE_SALE', label: 'Course Sales' },
        { key: 'DISPUTES', label: 'Session Reports' },
        { key: 'MENTOR_EARNINGS', label: 'Mentor Credit Earnings' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Financial Dashboard</h1>
                    <p className="text-gray-500 mt-1">Track payouts, subscriptions, course sales, and Learning Credit settlement.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 overflow-x-auto">
                <nav className="flex space-x-8 whitespace-nowrap">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                                activeTab === tab.key
                                    ? "border-primary-500 text-primary-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {activeTab === 'DISPUTES' && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2 text-gray-900 font-semibold"><AlertOctagon className="w-5 h-5 text-amber-600" /> Reported sessions</div>
                        <div className="flex gap-2 text-sm">
                            {(['OPEN', 'ALL'] as const).map((f) => (
                                <button key={f} onClick={() => setDisputeFilter(f)} className={cn('px-3 py-1 rounded-full border', disputeFilter === f ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600')}>
                                    {f === 'OPEN' ? 'Open' : 'All'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {disputesLoading ? (
                        <div className="px-6 py-12 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading…</div>
                    ) : disputes.length === 0 ? (
                        <div className="px-6 py-12 text-center text-gray-500">No reported sessions.</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {disputes.map((d) => (
                                <div key={d.id} className="px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
                                    <div className="lg:col-span-7">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                                                d.status === 'OPEN' ? 'bg-amber-100 text-amber-800' : d.status === 'RESOLVED_REFUNDED' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700')}>
                                                {d.status === 'OPEN' ? 'Open' : d.status === 'RESOLVED_REFUNDED' ? 'Refunded to student' : 'Released to mentor'}
                                            </span>
                                            <span className="text-xs text-gray-500">Reported {new Date(d.created_at).toLocaleString()}</span>
                                        </div>
                                        <p className="mt-2 text-sm text-gray-900">
                                            <span className="font-medium">{d.student.username}</span> reported a session with <span className="font-medium">{d.tutor.username}</span> on {new Date(d.lesson.start_time).toLocaleString()}.
                                        </p>
                                        <p className="mt-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{d.reason}</p>
                                        {d.resolution_note && <p className="mt-2 text-xs text-gray-500">Resolution note: {d.resolution_note}</p>}
                                    </div>
                                    <div className="lg:col-span-5 flex flex-col justify-between gap-3">
                                        {d.lesson.earning && (
                                            <div className="text-sm text-gray-700 grid grid-cols-3 gap-2">
                                                <div className="bg-gray-50 rounded-lg p-2"><div className="text-xs text-gray-500">Session</div><div className="font-semibold">{money(d.lesson.earning.gross_cents)}</div></div>
                                                <div className="bg-gray-50 rounded-lg p-2"><div className="text-xs text-gray-500">Fee</div><div className="font-semibold">{money(d.lesson.earning.fee_cents)}</div></div>
                                                <div className="bg-gray-50 rounded-lg p-2"><div className="text-xs text-gray-500">Mentor net</div><div className="font-semibold">{money(d.lesson.earning.net_cents)}</div></div>
                                            </div>
                                        )}
                                        {d.status === 'OPEN' && (
                                            <div className="flex gap-2">
                                                <button disabled={busyId === d.id} onClick={() => resolveDispute(d, 'REFUND')} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                                                    Refund credits to student
                                                </button>
                                                <button disabled={busyId === d.id} onClick={() => resolveDispute(d, 'RELEASE')} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                                                    Dismiss &amp; release to mentor
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'MENTOR_EARNINGS' && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-gray-900 font-semibold"><Banknote className="w-5 h-5 text-purple-600" /> Mentor earnings from Learning Credits</div>
                            <button
                                type="button"
                                disabled={settlementBusy}
                                onClick={runSettlement}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                            >
                                {settlementBusy ? 'Running…' : 'Run monthly settlement now'}
                            </button>
                        </div>
                        {config && (
                            <p className="text-xs text-gray-500 mt-1">
                                Fee {config.feePercent}% · Settlement window {config.settlementDays} days · Payout minimum {money(config.payoutMinimumCents)}. Settlement runs automatically on the 1st of each month via Stripe Connect transfers; "Record payout" stays available for mentors paid outside Stripe.
                            </p>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 font-semibold text-gray-900">Mentor</th>
                                    <th className="px-6 py-3 font-semibold text-gray-900 text-right">Pending</th>
                                    <th className="px-6 py-3 font-semibold text-gray-900 text-right">On hold</th>
                                    <th className="px-6 py-3 font-semibold text-gray-900 text-right">Payout-ready</th>
                                    <th className="px-6 py-3 font-semibold text-gray-900 text-right">Paid</th>
                                    <th className="px-6 py-3 font-semibold text-gray-900 text-right">Promo-funded</th>
                                    <th className="px-6 py-3 font-semibold text-gray-900">Payout method</th>
                                    <th className="px-6 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {mentorsLoading ? (
                                    <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading…</td></tr>
                                ) : mentorRows.length === 0 ? (
                                    <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">No credit-funded sessions completed yet.</td></tr>
                                ) : mentorRows.map((row) => {
                                    const t = row.totals;
                                    const available = t.AVAILABLE?.net_cents || 0;
                                    const promo = Object.values(t).reduce((acc, v) => acc + (v.promo_cents || 0), 0);
                                    return (
                                        <tr key={row.tutor.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{row.tutor.username}</div>
                                                <div className="text-xs text-gray-500">{row.tutor.user?.email}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right tabular-nums">{money(t.PENDING?.net_cents || 0)}</td>
                                            <td className="px-6 py-4 text-right tabular-nums text-amber-700">{money(t.ON_HOLD?.net_cents || 0)}</td>
                                            <td className="px-6 py-4 text-right tabular-nums font-semibold text-green-700">{money(available)}</td>
                                            <td className="px-6 py-4 text-right tabular-nums">{money((t.PAID?.net_cents || 0) + (t.TRANSFERRED?.net_cents || 0))}</td>
                                            <td className="px-6 py-4 text-right tabular-nums text-gray-500">{money(promo)}</td>
                                            <td className="px-6 py-4">
                                                {row.tutor.payout?.method ? (
                                                    <span className={cn('px-2 py-0.5 rounded-full text-xs',
                                                        row.tutor.payout.method === 'STRIPE' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700')}>
                                                        {METHOD_LABEL[row.tutor.payout.method]}
                                                        {row.tutor.payout.method === 'ZELLE' && row.tutor.payout.zelle_contact ? ` · ${row.tutor.payout.zelle_contact}` : ''}
                                                    </span>
                                                ) : (
                                                    <span className={cn('px-2 py-0.5 rounded-full text-xs', row.tutor.stripe_account_id ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
                                                        {row.tutor.stripe_account_id ? 'Stripe (default)' : 'Not set'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    disabled={busyId === row.tutor.id || available <= 0}
                                                    onClick={() => openPayoutModal(row)}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
                                                >
                                                    Record payout
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {payoutHistory.length > 0 && (
                        <div className="border-t border-gray-100">
                            <div className="px-6 py-3 text-sm font-semibold text-gray-900 bg-gray-50">Payout history</div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-gray-100 text-xs uppercase text-gray-500">
                                        <tr>
                                            <th className="px-6 py-2">Date</th>
                                            <th className="px-6 py-2">Mentor</th>
                                            <th className="px-6 py-2">Period</th>
                                            <th className="px-6 py-2 text-right">Amount</th>
                                            <th className="px-6 py-2">Method</th>
                                            <th className="px-6 py-2">Status</th>
                                            <th className="px-6 py-2">Reference</th>
                                            <th className="px-6 py-2">Proof</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {payoutHistory.map((p) => (
                                            <tr key={p.id}>
                                                <td className="px-6 py-2.5 whitespace-nowrap text-gray-600">{new Date(p.paid_at || p.created_at).toLocaleDateString()}</td>
                                                <td className="px-6 py-2.5 text-gray-900">{p.tutor.username}</td>
                                                <td className="px-6 py-2.5 text-gray-600">{p.period}</td>
                                                <td className="px-6 py-2.5 text-right font-semibold tabular-nums">{money(p.amount_cents)}</td>
                                                <td className="px-6 py-2.5">{METHOD_LABEL[p.method || ''] || (p.stripe_transfer_id ? 'Stripe' : '—')}</td>
                                                <td className="px-6 py-2.5">
                                                    <span className={cn('px-2 py-0.5 rounded-full text-xs',
                                                        p.status === 'PAID' || p.status === 'MANUAL' ? 'bg-green-50 text-green-700'
                                                            : p.status === 'TRANSFERRED' ? 'bg-purple-50 text-purple-700'
                                                                : p.status === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600')}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-2.5 text-gray-600 max-w-[220px] truncate" title={p.note || p.stripe_transfer_id || ''}>{p.note || p.stripe_transfer_id || '—'}</td>
                                                <td className="px-6 py-2.5">
                                                    {p.proof_url ? (
                                                        <a href={resolveProofUrl(p.proof_url) || '#'} target="_blank" rel="noreferrer" className="text-purple-700 underline text-xs">View proof</a>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {payoutTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => !payoutSubmitBusy && setPayoutTarget(null)} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-gray-900">Record payout — {payoutTarget.tutor.username}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                            Pays out <span className="font-semibold">{money(payoutTarget.totals.AVAILABLE?.net_cents || 0)}</span> of payout-ready earnings and marks them PAID.
                        </p>

                        <div className="mt-4 bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm text-gray-700 space-y-1">
                            <div className="text-xs uppercase font-semibold text-gray-500">Mentor's payout details</div>
                            {payoutTarget.tutor.payout?.method === 'ZELLE' && (
                                <div>Zelle: <span className="font-medium">{payoutTarget.tutor.payout.zelle_contact || 'not provided'}</span></div>
                            )}
                            {payoutTarget.tutor.payout?.method === 'BANK_TRANSFER' && (
                                <>
                                    <div>Bank: <span className="font-medium">{payoutTarget.tutor.payout.bank.bank_name || '—'}</span></div>
                                    <div>Account holder: <span className="font-medium">{payoutTarget.tutor.payout.bank.account_name || '—'}</span></div>
                                    <div>Account #: <span className="font-medium">{payoutTarget.tutor.payout.bank.account_number || '—'}</span></div>
                                    {payoutTarget.tutor.payout.bank.routing && <div>Routing/SWIFT: <span className="font-medium">{payoutTarget.tutor.payout.bank.routing}</span></div>}
                                    {payoutTarget.tutor.payout.bank.notes && <div>Notes: {payoutTarget.tutor.payout.bank.notes}</div>}
                                </>
                            )}
                            {payoutTarget.tutor.payout?.method === 'STRIPE' && (
                                <div>Prefers automatic Stripe payouts — use this form only for an off-Stripe payment.</div>
                            )}
                            {!payoutTarget.tutor.payout?.method && <div>The mentor hasn't chosen a payout method yet — confirm details with them first.</div>}
                        </div>

                        <div className="mt-4">
                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Paid via</label>
                            <select
                                value={payoutMethod}
                                onChange={(e) => setPayoutMethod(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                                disabled={payoutSubmitBusy}
                            >
                                <option value="ZELLE">Zelle</option>
                                <option value="BANK_TRANSFER">Bank transfer</option>
                                <option value="STRIPE">Stripe (manual)</option>
                            </select>
                        </div>

                        <div className="mt-3">
                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Reference (required)</label>
                            <input
                                type="text"
                                value={payoutNote}
                                onChange={(e) => setPayoutNote(e.target.value)}
                                placeholder="Transfer ID, Zelle confirmation #, date…"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                disabled={payoutSubmitBusy}
                            />
                        </div>

                        <div className="mt-3">
                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Proof of transfer (image or PDF)</label>
                            <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProof(f); }}
                                className="w-full text-sm"
                                disabled={proofBusy || payoutSubmitBusy}
                            />
                            {proofBusy && <div className="text-xs text-gray-500 mt-1">Uploading…</div>}
                            {proofUrl && !proofBusy && (
                                <div className="text-xs text-green-700 mt-1">
                                    Proof attached — <a href={resolveProofUrl(proofUrl) || '#'} target="_blank" rel="noreferrer" className="underline">preview</a>
                                </div>
                            )}
                        </div>

                        {payoutError && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{payoutError}</div>}

                        <div className="mt-5 flex gap-3">
                            <button
                                onClick={() => setPayoutTarget(null)}
                                disabled={payoutSubmitBusy}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitPayout}
                                disabled={payoutSubmitBusy || proofBusy}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                            >
                                {payoutSubmitBusy ? 'Recording…' : `Confirm — ${money(payoutTarget.totals.AVAILABLE?.net_cents || 0)} paid`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {(activeTab === 'ALL' || activeTab === 'SUBSCRIPTION' || activeTab === 'COURSE_SALE') && (
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
            )}
        </div>
    );
};

export default PaymentsPage;
