import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User, CreditCard, ExternalLink, CalendarDays } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const apiError = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

type LessonDetail = {
    id: string;
    tutor_id: string;
    student_id: string;
    booking_id?: string | null;
    start_time: string;
    end_time: string;
    duration: number;
    status: string;
    billing_type: 'FREE_TRIAL' | 'FREE_INTRO' | 'PAID';
    payment_status: 'paid' | 'pending' | 'failed' | 'not_required' | 'unknown';
    meeting_link?: string | null;
    google_calendar_html_link?: string | null;
    category?: string | null;
    created_at: string;
    booking?: {
        id: string;
        frequency?: string;
        created_at?: string;
        funding?: string | null;
    } | null;
    reservation?: { status: string; credits: number } | null;
    earning?: { status: string; available_at: string } | null;
    dispute?: { status: string } | null;
    student?: { username?: string | null };
    tutor?: { username?: string | null; timezone?: string | null };
};

const SessionDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isStudent = user?.role === 'STUDENT';

    const [lesson, setLesson] = useState<LessonDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [payBusy, setPayBusy] = useState(false);
    const [payError, setPayError] = useState('');

    const [joinBusy, setJoinBusy] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [errorModalOpen, setErrorModalOpen] = useState(false);

    // Learning Credits actions
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelBusy, setCancelBusy] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportBusy, setReportBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    const [actionNotice, setActionNotice] = useState('');

    const [searchParams, setSearchParams] = useSearchParams();
    const [finalizeStatus, setFinalizeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    // Auto-finalize after returning from Stripe checkout
    useEffect(() => {
        const sessionId = searchParams.get('session_id');
        if (!sessionId) return;
        setFinalizeStatus('loading');
        api.post('/payments/student/booking/finalize', { sessionId })
            .then(() => {
                setFinalizeStatus('success');
                // Re-fetch lesson to get updated payment status
                if (id) {
                    api.get(`/lessons/${id}/detail`).then((r) => setLesson(r.data?.lesson || null));
                }
            })
            .catch(() => setFinalizeStatus('error'))
            .finally(() => {
                // Remove session_id from URL
                searchParams.delete('session_id');
                setSearchParams(searchParams, { replace: true });
            });
    }, []);// eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!id) return;
        const fetch = async () => {
            try {
                const res = await api.get(`/lessons/${id}/detail`);
                setLesson(res.data?.lesson || null);
            } catch (e: any) {
                setError(e?.response?.data?.error || 'Failed to load session.');
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [id]);

    const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString(undefined, { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleTimeString(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const formatRange = (startIso: string, endIso: string) => {
        return `${formatTime(startIso)} – ${formatTime(endIso)}`;
    };

    const formatBookedOn = (iso?: string | null) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleString(undefined, { timeZone: tz, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const needsPayment = lesson
        && !['CANCELLED', 'COMPLETED', 'MISSED'].includes(lesson.status.toUpperCase())
        && (lesson.payment_status === 'pending' || lesson.payment_status === 'failed');
    const isUpcoming = lesson && new Date(lesson.start_time).getTime() > Date.now();
    // Session is joinable from start_time until 50 minutes after it begins
    const isJoinable = lesson && (() => {
        const start = new Date(lesson.start_time).getTime();
        const now = Date.now();
        return now >= start - 15 * 60 * 1000 && now <= start + 50 * 60 * 1000 && !['COMPLETED', 'CANCELLED', 'MISSED'].includes(lesson.status.toUpperCase());
    })();

    const paymentBadge = () => {
        if (!lesson) return null;
        const ps = lesson.payment_status;
        const ls = lesson.status.toUpperCase();
        const bt = lesson.billing_type.toUpperCase();

        if (ls === 'CANCELLED') return <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200">Cancelled</span>;
        if (lesson.booking?.funding === 'CREDITS') {
            const ds = lesson.dispute?.status;
            if (ds === 'OPEN') return <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">Under review</span>;
            if (ds === 'RESOLVED_REFUNDED') return <span className="px-3 py-1 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Credits refunded</span>;
            if (ls === 'BOOKED') return <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200">Reserved with credits</span>;
        }
        if (ls === 'COMPLETED') return <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-200">Completed</span>;
        if (ls === 'MISSED') return <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700 border border-red-200">Missed</span>;
        if (bt === 'FREE_INTRO') return <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-200">Free Intro</span>;
        if (bt === 'FREE_TRIAL') return <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">Free Trial</span>;
        if (ps === 'paid') return <span className="px-3 py-1 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Paid</span>;
        if (ps === 'failed') return <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700 border border-red-200">Payment Failed</span>;
        return <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">Payment Pending</span>;
    };

    const handlePay = async () => {
        if (!lesson) return;
        try {
            setPayBusy(true);
            setPayError('');
            const baseUrl = window.location.origin;
            const res = await api.post('/payments/student/booking/pay-next', {
                lessonId: lesson.id,
                bookingId: lesson.booking_id || lesson.booking?.id,
                successUrl: `${baseUrl}/student/sessions/${lesson.id}`,
                cancelUrl: `${baseUrl}/student/sessions/${lesson.id}`,
            });
            if (res.data?.url) {
                window.location.href = res.data.url;
            } else {
                setPayError('Failed to start payment – please try again.');
                setErrorModalOpen(true);
            }
        } catch (e: any) {
            setPayError(e?.response?.data?.error || 'Unable to process payment.');
            setErrorModalOpen(true);
        } finally {
            setPayBusy(false);
        }
    };

    const handleJoin = async () => {
        if (!lesson) return;
        try {
            setJoinBusy(true);
            setJoinError('');
            const res = await api.get(`/lessons/${lesson.id}/join`);
            const url = res.data?.meeting_link as string | undefined;
            if (url) {
                window.open(url, '_blank');
            } else {
                setJoinError('Meeting link is not available yet.');
                setErrorModalOpen(true);
            }
        } catch (e: any) {
            setJoinError(e?.response?.data?.error || 'Unable to join session.');
            setErrorModalOpen(true);
        } finally {
            setJoinBusy(false);
        }
    };

    const isCreditsFunded = !!lesson && lesson.booking?.funding === 'CREDITS';
    const canCancelCredits = !!lesson && isStudent && isCreditsFunded
        && lesson.status.toUpperCase() === 'BOOKED'
        && new Date(lesson.start_time).getTime() - Date.now() > 24 * 60 * 60 * 1000;
    const canReportCredits = !!lesson && isStudent && isCreditsFunded
        && lesson.status.toUpperCase() === 'COMPLETED'
        && lesson.earning?.status === 'PENDING'
        && !lesson.dispute;

    const handleCancelCredits = async () => {
        if (!lesson) return;
        try {
            setCancelBusy(true);
            setActionError('');
            const res = await api.post(`/wallet/lessons/${lesson.id}/cancel`);
            setLesson({ ...lesson, status: 'CANCELLED', reservation: lesson.reservation ? { ...lesson.reservation, status: 'RETURNED' } : lesson.reservation });
            setCancelOpen(false);
            setActionNotice(`Session cancelled. ${Number(res.data?.credits_returned || 0)} credits are back in your wallet.`);
        } catch (e) {
            setActionError(apiError(e, 'Unable to cancel this session.'));
        } finally {
            setCancelBusy(false);
        }
    };

    const handleReportCredits = async () => {
        if (!lesson) return;
        try {
            setReportBusy(true);
            setActionError('');
            await api.post(`/wallet/lessons/${lesson.id}/report`, { reason: reportReason });
            setLesson({ ...lesson, dispute: { status: 'OPEN' }, earning: lesson.earning ? { ...lesson.earning, status: 'ON_HOLD' } : lesson.earning });
            setReportOpen(false);
            setReportReason('');
            setActionNotice('Thanks — your report has been sent to the EmpowerEd team for review.');
        } catch (e) {
            setActionError(apiError(e, 'Unable to send your report.'));
        } finally {
            setReportBusy(false);
        }
    };

    const backPath = isStudent ? '/student/sessions' : '/sessions';

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-900 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-gray-600">Loading session...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !lesson) {
        return (
            <DashboardLayout>
                <div className="w-full">
                    <Button variant="ghost" className="mb-4 text-gray-500" onClick={() => navigate(backPath)}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sessions
                    </Button>
                    <Card className="p-8 text-center">
                        <p className="text-red-600 font-medium">{error || 'Session not found.'}</p>
                        <Button className="mt-4" onClick={() => navigate(backPath)}>Go to Sessions</Button>
                    </Card>
                </div>
            </DashboardLayout>
        );
    }

    const otherPerson = isStudent
        ? lesson.tutor?.username || 'Mentor'
        : lesson.student?.username || 'Student';

    const otherLabel = isStudent ? 'Mentor' : 'Student';

    return (
        <DashboardLayout>
            <div className="w-full">
                <Button variant="ghost" className="mb-4 text-gray-500" onClick={() => navigate(backPath)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sessions
                </Button>

                <Card className="p-0 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] px-8 py-6 text-white">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <h1 className="text-2xl font-bold">Session with {otherPerson}</h1>
                                <p className="text-purple-100 text-sm mt-1">{formatDate(lesson.start_time)}</p>
                            </div>
                            {paymentBadge()}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="px-8 py-6 space-y-6">
                        {/* Errors */}
                        {/* Removed error div, now using modal */}

                        {/* Finalize status after Stripe redirect */}
                        {finalizeStatus === 'loading' && (
                            <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                                Confirming your payment...
                            </div>
                        )}
                        {finalizeStatus === 'success' && (
                            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                                Payment confirmed! Your session is booked.
                            </div>
                        )}
                        {finalizeStatus === 'error' && (
                            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                                We couldn't confirm your payment automatically. It may take a moment to update — please refresh the page.
                            </div>
                        )}

                        {/* Payment CTA for students */}
                        {isStudent && needsPayment && isUpcoming && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                                <div className="flex items-start gap-3">
                                    <CreditCard className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-amber-900">Payment Required</h3>
                                        <p className="text-sm text-amber-800 mt-1">
                                            Please complete payment to confirm this session. Once paid, you'll be able to join the meeting.
                                        </p>
                                        <Button
                                            className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                                            disabled={payBusy}
                                            onClick={handlePay}
                                        >
                                            <CreditCard className="w-4 h-4 mr-2" />
                                            {payBusy ? 'Processing…' : 'Pay Now & Confirm Session'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Session details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-start gap-3">
                                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Date</p>
                                    <p className="text-gray-900 font-medium">{formatDate(lesson.start_time)}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Time</p>
                                    <p className="text-gray-900 font-medium">{formatRange(lesson.start_time, lesson.end_time)}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{otherLabel}</p>
                                    <p className="text-gray-900 font-medium">{otherPerson}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <CalendarDays className="w-5 h-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Duration</p>
                                    <p className="text-gray-900 font-medium">{lesson.duration} min</p>
                                </div>
                            </div>
                        </div>

                        {(lesson.created_at || lesson.booking?.created_at) && (
                            <p className="text-xs text-gray-500">Booked on {formatBookedOn(lesson.created_at || lesson.booking?.created_at)}</p>
                        )}

                        {actionNotice && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm">{actionNotice}</div>
                        )}

                        {isCreditsFunded && lesson.reservation && (
                            <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 text-sm text-purple-900">
                                {lesson.reservation.status === 'RESERVED' && (
                                    <>{lesson.reservation.credits} Learning Credits are reserved for this session. They are released to {isStudent ? 'your mentor' : 'you'} only after the session is completed.</>
                                )}
                                {lesson.reservation.status === 'RELEASED' && (
                                    <>{lesson.reservation.credits} Learning Credits were released for this completed session{lesson.earning?.status === 'PENDING' && lesson.earning?.available_at ? ` (in review until ${formatDate(lesson.earning.available_at)})` : ''}.</>
                                )}
                                {lesson.reservation.status === 'RETURNED' && (
                                    <>{lesson.reservation.credits} Learning Credits were returned to the student's wallet.</>
                                )}
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-3 pt-2">
                            {isStudent && !needsPayment && isJoinable && (
                                <Button
                                    className="flex items-center gap-2"
                                    disabled={joinBusy}
                                    onClick={handleJoin}
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    {joinBusy ? 'Joining…' : 'Join Session'}
                                </Button>
                            )}

                            {canCancelCredits && (
                                <Button variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" onClick={() => { setActionError(''); setCancelOpen(true); }}>
                                    Cancel session
                                </Button>
                            )}
                            {canReportCredits && (
                                <Button variant="outline" onClick={() => { setActionError(''); setReportReason(''); setReportOpen(true); }}>
                                    Report a problem
                                </Button>
                            )}

                            {!isStudent && lesson.meeting_link && !['COMPLETED', 'CANCELLED', 'MISSED'].includes(lesson.status.toUpperCase()) && (() => {
                                const startMs = new Date(lesson.start_time).getTime();
                                const nowMs = Date.now();
                                return nowMs >= startMs - 15 * 60 * 1000 && nowMs <= startMs + 50 * 60 * 1000;
                            })() && (
                                <a href={lesson.meeting_link} target="_blank" rel="noreferrer">
                                    <Button className="flex items-center gap-2">
                                        <ExternalLink className="w-4 h-4" /> Join
                                    </Button>
                                </a>
                            )}

                            {lesson.google_calendar_html_link && (
                                <a href={lesson.google_calendar_html_link} target="_blank" rel="noreferrer">
                                    <Button variant="outline">Open in Calendar</Button>
                                </a>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
            <Modal
                isOpen={errorModalOpen}
                onClose={() => setErrorModalOpen(false)}
                title="Error"
            >
                <p>{payError || joinError}</p>
            </Modal>
            <Modal isOpen={cancelOpen} onClose={() => { if (!cancelBusy) setCancelOpen(false); }} title="Cancel this session?">
                {lesson && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700">
                            This session on <span className="font-medium">{formatDate(lesson.start_time)}</span> will be cancelled and{' '}
                            <span className="font-medium">{lesson.reservation?.credits ?? ''} Learning Credits</span> will return to your wallet immediately.
                        </p>
                        {actionError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionError}</div>}
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setCancelOpen(false)} disabled={cancelBusy}>Keep session</Button>
                            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleCancelCredits} disabled={cancelBusy}>
                                {cancelBusy ? 'Cancelling…' : 'Yes, cancel session'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
            <Modal isOpen={reportOpen} onClose={() => { if (!reportBusy) setReportOpen(false); }} title="Report a problem with this session">
                <div className="space-y-4">
                    <p className="text-sm text-gray-700">
                        Tell us what went wrong. The mentor's payment for this session is paused while the EmpowerEd team reviews your report.
                    </p>
                    <textarea
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 min-h-[120px]"
                        placeholder="e.g. The mentor didn't show up / the session ended after 15 minutes…"
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        disabled={reportBusy}
                    />
                    {actionError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionError}</div>}
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setReportOpen(false)} disabled={reportBusy}>Back</Button>
                        <Button className="flex-1" onClick={handleReportCredits} disabled={reportBusy || reportReason.trim().length < 10}>
                            {reportBusy ? 'Sending…' : 'Send report'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
};

export default SessionDetailPage;
