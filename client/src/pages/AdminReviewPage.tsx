import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Check, X, ExternalLink, Star, Award, MessageSquareQuote, RefreshCw } from 'lucide-react';
import api from '../api/axios';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
type Tab = 'certifications' | 'external-reviews';

interface TutorRef {
    id: string;
    username: string;
    user?: { email?: string };
}

interface Certification {
    id: string;
    name: string;
    issuer: string;
    year: number;
    image_url?: string | null;
    verification_status: Status;
    rejection_reason?: string | null;
    created_at: string;
    tutor: TutorRef;
}

interface ExternalReview {
    id: string;
    platform: string;
    reviewer: string;
    rating: number;
    comment?: string | null;
    external_url?: string | null;
    date?: string | null;
    verification_status: Status;
    rejection_reason?: string | null;
    created_at: string;
    tutor: TutorRef;
}

const STATUS_TABS: Status[] = ['PENDING', 'APPROVED', 'REJECTED'];

const statusBadge = (status: Status) => {
    const map: Record<Status, string> = {
        PENDING: 'bg-amber-100 text-amber-800',
        APPROVED: 'bg-green-100 text-green-800',
        REJECTED: 'bg-red-100 text-red-700',
    };
    return (
        <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${map[status]}`}>
            {status}
        </span>
    );
};

const errMsg = (e: unknown, fallback: string): { status?: number; message: string } => {
    const err = e as { response?: { status?: number; data?: { error?: string } } };
    return { status: err?.response?.status, message: err?.response?.data?.error || fallback };
};

const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');
const resolveImage = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

const AdminReviewPage: React.FC = () => {
    const [tab, setTab] = useState<Tab>('certifications');
    const [status, setStatus] = useState<Status>('PENDING');
    const [certs, setCerts] = useState<Certification[]>([]);
    const [reviews, setReviews] = useState<ExternalReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    // Reject modal state
    const [rejectTarget, setRejectTarget] = useState<{ id: string; label: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (tab === 'certifications') {
                const res = await api.get('/admin/approvals/certifications', { params: { status } });
                setCerts(res.data.certifications || []);
            } else {
                const res = await api.get('/admin/approvals/external-reviews', { params: { status } });
                setReviews(res.data.reviews || []);
            }
        } catch (e: unknown) {
            const { status: code, message } = errMsg(e, 'Failed to load review queue.');
            setError(code === 403 ? 'You do not have permission to review approvals.' : message);
        } finally {
            setLoading(false);
        }
    }, [tab, status]);

    useEffect(() => { load(); }, [load]);

    const endpoint = tab === 'certifications' ? 'certifications' : 'external-reviews';

    const approve = async (id: string) => {
        setBusyId(id);
        try {
            await api.put(`/admin/approvals/${endpoint}/${id}/approve`);
            await load();
        } catch (e: unknown) {
            setError(errMsg(e, 'Failed to approve.').message);
        } finally {
            setBusyId(null);
        }
    };

    const submitReject = async () => {
        if (!rejectTarget || !rejectReason.trim()) return;
        setBusyId(rejectTarget.id);
        try {
            await api.put(`/admin/approvals/${endpoint}/${rejectTarget.id}/reject`, { reason: rejectReason.trim() });
            setRejectTarget(null);
            setRejectReason('');
            await load();
        } catch (e: unknown) {
            setError(errMsg(e, 'Failed to reject.').message);
        } finally {
            setBusyId(null);
        }
    };

    const ActionButtons: React.FC<{ id: string; label: string }> = ({ id, label }) => (
        <div className="flex gap-2 shrink-0">
            {status !== 'APPROVED' && (
                <Button
                    size="sm"
                    onClick={() => approve(id)}
                    disabled={busyId === id}
                    className="bg-green-600 hover:bg-green-700 text-white"
                >
                    <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
            )}
            {status !== 'REJECTED' && (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setRejectTarget({ id, label }); setRejectReason(''); }}
                    disabled={busyId === id}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                >
                    <X className="w-4 h-4 mr-1" /> Reject
                </Button>
            )}
        </div>
    );

    const isEmpty = tab === 'certifications' ? certs.length === 0 : reviews.length === 0;

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Review Approvals</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Approve or reject mentor certifications and external reviews.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={load} title="Refresh">
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Link to="/dashboard" className="text-sm text-primary-700 hover:underline">Back to dashboard</Link>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-gray-200">
                    {([['certifications', 'Certifications', Award], ['external-reviews', 'External Reviews', MessageSquareQuote]] as const).map(([key, label, Icon]) => (
                        <button
                            key={key}
                            onClick={() => setTab(key as Tab)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === key
                                ? 'border-[#4A1D96] text-[#4A1D96]'
                                : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            <Icon className="w-4 h-4" /> {label}
                        </button>
                    ))}
                </div>

                {/* Status filter */}
                <div className="flex gap-2">
                    {STATUS_TABS.map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatus(s)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${status === s
                                ? 'bg-[#4A1D96] text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="py-20 text-center text-gray-500">
                        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin mx-auto mb-3" />
                        Loading…
                    </div>
                ) : isEmpty ? (
                    <Card className="text-center text-gray-500 italic py-12">
                        No {status.toLowerCase()} {tab === 'certifications' ? 'certifications' : 'reviews'}.
                    </Card>
                ) : tab === 'certifications' ? (
                    <div className="space-y-3">
                        {certs.map((c) => {
                            const img = resolveImage(c.image_url);
                            return (
                                <Card key={c.id} className="flex flex-col md:flex-row md:items-center gap-4">
                                    {img && (
                                        <a href={img} target="_blank" rel="noreferrer" className="shrink-0">
                                            <img src={img} alt={c.name} className="w-full md:w-28 h-28 object-cover rounded-lg border border-gray-200" />
                                        </a>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-gray-900">{c.name}</h3>
                                            {statusBadge(c.verification_status)}
                                        </div>
                                        <p className="text-sm text-gray-600">{c.issuer} · {c.year}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Mentor: <span className="font-medium text-gray-600">{c.tutor?.username}</span>
                                            {c.tutor?.user?.email ? ` · ${c.tutor.user.email}` : ''}
                                        </p>
                                        {c.verification_status === 'REJECTED' && c.rejection_reason && (
                                            <p className="text-xs text-red-600 mt-1">Reason: {c.rejection_reason}</p>
                                        )}
                                    </div>
                                    <ActionButtons id={c.id} label={c.name} />
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reviews.map((r) => (
                            <Card key={r.id} className="flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-semibold text-gray-900">{r.platform}</h3>
                                        <span className="flex items-center gap-0.5 text-amber-500 text-sm">
                                            {Array.from({ length: r.rating }).map((_, i) => (
                                                <Star key={i} className="w-3.5 h-3.5 fill-current" />
                                            ))}
                                        </span>
                                        {statusBadge(r.verification_status)}
                                        {r.external_url && (
                                            <a href={r.external_url} target="_blank" rel="noreferrer" className="text-primary-700 hover:underline text-xs inline-flex items-center gap-1">
                                                source <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                    {r.comment && <p className="text-sm text-gray-600 mt-1">“{r.comment}”</p>}
                                    <p className="text-xs text-gray-400 mt-1">
                                        By {r.reviewer} · Mentor: <span className="font-medium text-gray-600">{r.tutor?.username}</span>
                                        {r.tutor?.user?.email ? ` · ${r.tutor.user.email}` : ''}
                                    </p>
                                    {r.verification_status === 'REJECTED' && r.rejection_reason && (
                                        <p className="text-xs text-red-600 mt-1">Reason: {r.rejection_reason}</p>
                                    )}
                                </div>
                                <ActionButtons id={r.id} label={`${r.platform} review`} />
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Modal
                isOpen={!!rejectTarget}
                onClose={() => setRejectTarget(null)}
                title={`Reject — ${rejectTarget?.label ?? ''}`}
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Provide a reason for rejection. The mentor can see this to resubmit.
                    </p>
                    <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={4}
                        placeholder="e.g. Certificate image is unreadable / issuer could not be verified."
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-[#4A1D96] focus:border-transparent outline-none text-sm"
                    />
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
                        <Button
                            onClick={submitReject}
                            disabled={!rejectReason.trim() || busyId === rejectTarget?.id}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Confirm Rejection
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AdminReviewPage;
