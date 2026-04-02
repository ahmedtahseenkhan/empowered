import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User, CreditCard, ExternalLink, CalendarDays } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

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
    } | null;
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

    const needsPayment = lesson && (lesson.payment_status === 'pending' || lesson.payment_status === 'failed');
    const isUpcoming = lesson && new Date(lesson.start_time).getTime() > Date.now();

    const paymentBadge = () => {
        if (!lesson) return null;
        const ps = lesson.payment_status;
        const ls = lesson.status.toUpperCase();
        const bt = lesson.billing_type.toUpperCase();

        if (ls === 'CANCELLED') return <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200">Cancelled</span>;
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
            }
        } catch (e: any) {
            setPayError(e?.response?.data?.error || 'Unable to process payment.');
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
            }
        } catch (e: any) {
            setJoinError(e?.response?.data?.error || 'Unable to join session.');
        } finally {
            setJoinBusy(false);
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
                        {(payError || joinError) && (
                            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                                {payError || joinError}
                            </div>
                        )}

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

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-3 pt-2">
                            {isStudent && !needsPayment && (
                                <Button
                                    className="flex items-center gap-2"
                                    disabled={joinBusy}
                                    onClick={handleJoin}
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    {joinBusy ? 'Joining…' : 'Join Session'}
                                </Button>
                            )}

                            {!isStudent && lesson.meeting_link && (
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
        </DashboardLayout>
    );
};

export default SessionDetailPage;
