import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Mail, GraduationCap, AlertTriangle, CheckCircle, XCircle, BookOpen, Wallet, Lock, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

const apiError = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

interface DetailedStudent {
    id: string;
    username: string;
    profile_photo: string | null;
    grade_level: string;
    user: {
        id: string;
        email: string;
        is_suspended: boolean;
    };
    enrollments?: unknown[];
}

interface WalletInfo {
    wallet: { available: number; promotional: number; purchased: number; reserved: number };
    entries: Array<{
        id: string;
        amount: number;
        type: string;
        source?: string | null;
        balance_after?: number | null;
        description?: string | null;
        created_at: string;
        created_by_user_id?: string | null;
    }>;
    reservations: Array<{
        id: string;
        credits: number;
        promo_credits: number;
        status: string;
        created_at: string;
        lesson: { start_time: string; status: string; tutor: { username: string } };
    }>;
}

const TYPE_LABEL: Record<string, string> = {
    PURCHASE: 'Purchase',
    PROMO_GRANT: 'Promo grant',
    MANUAL_ADJUSTMENT: 'Adjustment',
    RESERVE: 'Reserved',
    UNRESERVE: 'Returned',
    RELEASE: 'Released to mentor',
    REVERSAL: 'Refunded (dispute)',
    CANCELLATION_REFUND: 'Refund',
    USAGE: 'Used',
};

const StudentDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [student, setStudent] = useState<DetailedStudent | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
    const [walletError, setWalletError] = useState('');
    const [grantAmount, setGrantAmount] = useState('');
    const [grantType, setGrantType] = useState<'PROMO_GRANT' | 'MANUAL_ADJUSTMENT'>('PROMO_GRANT');
    const [grantReason, setGrantReason] = useState('');
    const [grantBusy, setGrantBusy] = useState(false);
    const [grantMsg, setGrantMsg] = useState('');

    const fetchWallet = useCallback(async () => {
        if (!id) return;
        try {
            const res = await api.get(`/admin/students/${id}/wallet`);
            setWalletInfo(res.data);
            setWalletError('');
        } catch (e) {
            setWalletError(apiError(e, 'Failed to load wallet'));
        }
    }, [id]);

    useEffect(() => {
        const fetchStudent = async () => {
            try {
                const res = await api.get(`/admin/students/${id}`);
                setStudent(res.data.student);
            } catch (error) {
                console.error('Failed to fetch student', error);
                alert('Failed to load student details');
                navigate('/students');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchStudent();
            fetchWallet();
        }
    }, [id, navigate, fetchWallet]);

    const handleSuspendToggle = async () => {
        if (!student) return;
        const newStatus = !student.user.is_suspended;
        if (!confirm(`Are you sure you want to ${newStatus ? 'SUSPEND' : 'ACTIVATE'} this user?`)) return;

        setActionLoading(true);
        try {
            await api.put(`/admin/users/${student.user.id}/suspended`, { is_suspended: newStatus });
            setStudent(prev => prev ? { ...prev, user: { ...prev.user, is_suspended: newStatus } } : null);
        } catch (error) {
            console.error('Failed to update suspension status', error);
            alert('Failed to update status');
        } finally {
            setActionLoading(false);
        }
    };

    const submitGrant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const amount = Number(grantAmount);
        if (!Number.isInteger(amount) || amount === 0) {
            setGrantMsg('Enter a whole number of credits (negative only for adjustments).');
            return;
        }
        if (!grantReason.trim()) {
            setGrantMsg('A reason is required — it is recorded in the ledger.');
            return;
        }
        if (!confirm(`${amount > 0 ? 'Add' : 'Remove'} ${Math.abs(amount)} credits ${amount > 0 ? 'to' : 'from'} ${student?.username}?`)) return;
        setGrantBusy(true);
        setGrantMsg('');
        try {
            await api.post(`/admin/students/${id}/credits`, { amount, type: grantType, reason: grantReason.trim() });
            setGrantAmount('');
            setGrantReason('');
            setGrantMsg(`Done — ${Math.abs(amount)} credits ${amount > 0 ? 'added' : 'removed'}.`);
            await fetchWallet();
        } catch (err) {
            setGrantMsg(apiError(err, 'Failed to update credits'));
        } finally {
            setGrantBusy(false);
        }
    };

    const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

    if (loading) return <div className="text-center py-12 text-gray-500">Loading profile...</div>;
    if (!student) return <div className="text-center py-12 text-gray-500">Student not found.</div>;

    return (
        <div className="space-y-6">
            <button
                onClick={() => navigate('/students')}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Students
            </button>

            {/* Header Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <img
                        src={student.profile_photo || `https://ui-avatars.com/api/?name=${student.username}&background=random`}
                        alt={student.username}
                        className="w-24 h-24 rounded-full object-cover border-4 border-gray-50"
                    />
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    {student.username}
                                </h1>
                                <p className="text-gray-500 flex items-center gap-2 mt-1">
                                    <Mail className="w-4 h-4" /> {student.user.email}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {student.user.is_suspended ? (
                                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-sm font-medium flex items-center gap-1">
                                        <AlertTriangle className="w-4 h-4" /> Suspended
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium flex items-center gap-1">
                                        <CheckCircle className="w-4 h-4" /> Active
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="mt-6">
                            <div className="p-3 bg-gray-50 rounded-lg inline-block pr-8">
                                <div className="text-xs text-gray-500 uppercase font-semibold">Grade Level</div>
                                <div className="mt-1 font-medium text-gray-900 flex items-center gap-1">
                                    <GraduationCap className="w-4 h-4 text-gray-600" />
                                    {student.grade_level}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3 border-t border-gray-100 pt-6">
                    <button
                        onClick={handleSuspendToggle}
                        disabled={actionLoading}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                            student.user.is_suspended
                                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                : "bg-white text-red-700 border-red-200 hover:bg-red-50"
                        )}
                    >
                        {student.user.is_suspended ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {student.user.is_suspended ? 'Activate Account' : 'Suspend Account'}
                    </button>
                </div>
            </div>

            {/* Learning Credits wallet */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-purple-600" /> Learning Credits
                </h3>
                <p className="text-sm text-gray-500 mb-4">1 credit = $1. Promotional credits are spent first and never leave the platform as cash.</p>

                {walletError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{walletError}</div>}

                {walletInfo && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                        <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
                            <div className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Available</div>
                            <div className="text-2xl font-bold text-gray-900 mt-1">{walletInfo.wallet.available}</div>
                            <div className="text-xs text-gray-500 mt-1">{walletInfo.wallet.purchased} purchased · {walletInfo.wallet.promotional} promotional</div>
                        </div>
                        <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                            <div className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Reserved</div>
                            <div className="text-2xl font-bold text-gray-900 mt-1">{walletInfo.wallet.reserved}</div>
                            <div className="text-xs text-gray-500 mt-1">Held for upcoming sessions</div>
                        </div>
                        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                            <div className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Promotional</div>
                            <div className="text-2xl font-bold text-gray-900 mt-1">{walletInfo.wallet.promotional}</div>
                            <div className="text-xs text-gray-500 mt-1">Platform-funded (beta)</div>
                        </div>
                    </div>
                )}

                <form onSubmit={submitGrant} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Credits</label>
                        <input
                            type="number"
                            step="1"
                            value={grantAmount}
                            onChange={(e) => setGrantAmount(e.target.value)}
                            placeholder="100"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            disabled={grantBusy}
                        />
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Type</label>
                        <select
                            value={grantType}
                            onChange={(e) => setGrantType(e.target.value as 'PROMO_GRANT' | 'MANUAL_ADJUSTMENT')}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                            disabled={grantBusy}
                        >
                            <option value="PROMO_GRANT">Promotional grant (beta credits)</option>
                            <option value="MANUAL_ADJUSTMENT">Manual adjustment (+/−)</option>
                        </select>
                    </div>
                    <div className="md:col-span-5">
                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Reason (recorded in ledger)</label>
                        <input
                            type="text"
                            value={grantReason}
                            onChange={(e) => setGrantReason(e.target.value)}
                            placeholder="e.g. Beta welcome credits"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            disabled={grantBusy}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            disabled={grantBusy}
                            className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                        >
                            {grantBusy ? 'Saving…' : 'Apply'}
                        </button>
                    </div>
                    {grantMsg && <div className="md:col-span-12 text-sm text-gray-700">{grantMsg}</div>}
                </form>

                {walletInfo && walletInfo.reservations.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Session reservations</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Session</th>
                                        <th className="px-3 py-2 text-left">Mentor</th>
                                        <th className="px-3 py-2 text-right">Credits</th>
                                        <th className="px-3 py-2 text-left">Session status</th>
                                        <th className="px-3 py-2 text-left">Credits status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {walletInfo.reservations.map((r) => (
                                        <tr key={r.id}>
                                            <td className="px-3 py-2 whitespace-nowrap">{fmt(r.lesson.start_time)}</td>
                                            <td className="px-3 py-2">{r.lesson.tutor.username}</td>
                                            <td className="px-3 py-2 text-right">{r.credits}{r.promo_credits ? <span className="text-xs text-gray-500"> ({r.promo_credits} promo)</span> : null}</td>
                                            <td className="px-3 py-2">{r.lesson.status}</td>
                                            <td className="px-3 py-2">
                                                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                                                    r.status === 'RESERVED' ? 'bg-amber-100 text-amber-800' : r.status === 'RELEASED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700')}>
                                                    {r.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="mt-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Credit ledger</h4>
                    {!walletInfo || walletInfo.entries.length === 0 ? (
                        <p className="text-sm text-gray-500">No credit activity yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Date</th>
                                        <th className="px-3 py-2 text-left">Type</th>
                                        <th className="px-3 py-2 text-left">Description</th>
                                        <th className="px-3 py-2 text-right">Amount</th>
                                        <th className="px-3 py-2 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {walletInfo.entries.map((e) => (
                                        <tr key={e.id}>
                                            <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmt(e.created_at)}</td>
                                            <td className="px-3 py-2 font-medium text-gray-900">{TYPE_LABEL[e.type] || e.type}</td>
                                            <td className="px-3 py-2 text-gray-600">{e.description || '—'}</td>
                                            <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', e.amount > 0 ? 'text-emerald-700' : e.amount < 0 ? 'text-gray-900' : 'text-gray-400')}>
                                                {e.amount > 0 ? `+${e.amount}` : e.amount === 0 ? '—' : e.amount}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{typeof e.balance_after === 'number' ? e.balance_after : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Enrollments */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-gray-400" /> Enrollments
                    </h3>
                    {(student.enrollments?.length ?? 0) > 0 ? (
                        <div className="space-y-4">
                            {/* Simple list for now as enrollment structure varies */}
                            <p className="text-sm text-gray-600">Student has {student.enrollments?.length ?? 0} active enrollments.</p>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">No enrollments found.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudentDetailPage;
