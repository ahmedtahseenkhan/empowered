import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Users, ExternalLink, Copy, Check, Send } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import SessionListCard from '../components/sessions/SessionListCard';
import api from '../api/axios';

// Earliest date the Past tab looks back to (before the platform launched)
const PAST_SESSIONS_FROM = '2020-01-01T00:00:00.000Z';

type Lesson = {
    id: string;
    student_id?: string;
    start_time: string;
    end_time: string;
    created_at?: string;
    status: string;
    billing_type?: 'FREE_TRIAL' | 'FREE_INTRO' | 'PAID';
    payment_status?: 'paid' | 'pending' | 'failed' | 'not_required' | 'refunded' | 'unknown';
    meeting_link?: string | null;
    google_calendar_html_link?: string | null;
    student?: { username?: string | null };
    booking?: { frequency?: string; created_at?: string; funding?: string | null } | null;
    student_confirmed_at?: string | null;
    tutor_confirmed_at?: string | null;
};

const TutorSessionsPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loadError, setLoadError] = useState('');
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
    const [joinBusyId, setJoinBusyId] = useState<string | null>(null);
    const [confirmBusyId, setConfirmBusyId] = useState<string | null>(null);
    const [graceHours, setGraceHours] = useState(24);

    useEffect(() => {
        api.get('/wallet/config')
            .then((r) => {
                const mins = Number(r.data?.completionGraceMinutes);
                if (Number.isFinite(mins) && mins > 0) setGraceHours(Math.max(1, Math.round(mins / 60)));
            })
            .catch(() => {});
    }, []);
    const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
    const [sendBusyId, setSendBusyId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

    const apiError = (e: unknown, fallback: string) =>
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

    /** The session's Google Meet link; created on the server on demand if it does not exist yet. */
    const getMeetingLink = async (lesson: Lesson): Promise<string | null> => {
        if (lesson.meeting_link) return lesson.meeting_link;
        const res = await api.get(`/lessons/${lesson.id}/join`);
        const url = (res.data?.meeting_link as string | undefined) || null;
        if (url) setLessons((prev) => prev.map((x) => (x.id === lesson.id ? { ...x, meeting_link: url } : x)));
        return url;
    };

    const copyMeetingLink = async (lesson: Lesson) => {
        try {
            setLinkBusyId(lesson.id);
            const url = await getMeetingLink(lesson);
            if (!url) {
                setNotice({ title: 'Meeting link not ready', message: 'The Google Meet link could not be created yet. Please try again in a minute.' });
                return;
            }
            if (!navigator.clipboard) {
                setNotice({ title: 'Google Meet link', message: url });
                return;
            }
            await navigator.clipboard.writeText(url);
            setCopiedId(lesson.id);
            window.setTimeout(() => setCopiedId((cur) => (cur === lesson.id ? null : cur)), 2000);
        } catch (e) {
            setNotice({ title: 'Error', message: apiError(e, 'Unable to copy the meeting link.') });
        } finally {
            setLinkBusyId(null);
        }
    };

    const sendMeetingLink = async (lesson: Lesson) => {
        try {
            setSendBusyId(lesson.id);
            const res = await api.post(`/lessons/${lesson.id}/meeting-link/send`);
            const url = res.data?.meeting_link as string | undefined;
            if (url) setLessons((prev) => prev.map((x) => (x.id === lesson.id ? { ...x, meeting_link: url } : x)));
            const studentName = (res.data?.sent_to as string | undefined) || lesson.student?.username || 'the student';
            setNotice({
                title: 'Meeting link sent',
                message: res.data?.queued === false
                    ? `The Google Meet link was already sent to ${studentName} a moment ago.`
                    : `The Google Meet link has been emailed to ${studentName}.`,
            });
        } catch (e) {
            setNotice({ title: 'Error', message: apiError(e, 'Unable to send the meeting link.') });
        } finally {
            setSendBusyId(null);
        }
    };

    const studentId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const v = params.get('studentId');
        return v && v.trim() ? v.trim() : null;
    }, [location.search]);

    useEffect(() => {
        // Each tab fetches its own range: Past has no 2-month floor, Upcoming starts a day back
        // so sessions in progress are included.
        let cancelled = false;
        setLoading(true);
        setLoadError('');
        const now = new Date();
        const params = tab === 'upcoming'
            ? { from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), to: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() }
            : { from: PAST_SESSIONS_FROM, to: now.toISOString() };

        api.get('/lessons/me', { params })
            .then((res) => {
                if (!cancelled) setLessons(res.data?.lessons || []);
            })
            .catch((e) => {
                console.error('Failed to fetch tutor lessons', e);
                if (!cancelled) {
                    setLessons([]);
                    setLoadError('Could not load your sessions. Please refresh the page.');
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [tab]);

    const nowMs = Date.now();

    const filtered = useMemo(() => {
        const base = lessons
            .map((l) => ({
                ...l,
                startMs: new Date(l.start_time).getTime(),
                endMs: new Date(l.end_time).getTime(),
            }))
            .filter((l) => !Number.isNaN(l.startMs));

        // A session belongs to Upcoming until it has ended
        const tabbed = tab === 'upcoming'
            ? base.filter((l) => l.endMs >= nowMs)
            : base.filter((l) => l.endMs < nowMs);

        if (!studentId) return tabbed;
        return tabbed.filter((l) => l.student_id === studentId);
    }, [lessons, tab, nowMs, studentId]);

    const sorted = useMemo(() => {
        const copy = [...filtered];
        copy.sort((a, b) => (tab === 'upcoming' ? a.startMs - b.startMs : b.startMs - a.startMs));
        return copy;
    }, [filtered, tab]);

    const formatDateLong = (iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTimeOnlyRange = (startIso: string, endIso: string) => {
        const s = new Date(startIso);
        const e = new Date(endIso);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—';
        const startTime = s.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
        const endTime = e.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${startTime} – ${endTime}`;
    };

    const durationMinutes = (startIso: string, endIso: string) => {
        const s = new Date(startIso).getTime();
        const e = new Date(endIso).getTime();
        if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 60;
        return Math.max(1, Math.round((e - s) / 60000));
    };

    const formatBookedOn = (iso?: string | null) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const mapPaymentBadge = (lesson: Lesson) => {
        const billing = (lesson.billing_type || '').toUpperCase();
        const ps = lesson.payment_status;
        const lessonStatus = (lesson.status || '').toUpperCase();

        const pill = 'inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium border';
        const startMs = new Date(lesson.start_time).getTime();
        const endMs = new Date(lesson.end_time).getTime();
        const nowMs2 = Date.now();
        if (lessonStatus === 'BOOKED' && nowMs2 >= startMs && nowMs2 <= endMs + 15 * 60 * 1000) {
            return <span className={`${pill} bg-green-600 text-white border-green-600 animate-pulse`}>In progress — join now</span>;
        }
        if (lessonStatus === 'BOOKED' && nowMs2 > endMs) {
            return (
                <span className={`${pill} bg-blue-50 text-blue-700 border-blue-200`}>
                    {lesson.student_confirmed_at ? 'Student confirmed — finalize below' : 'Awaiting student confirmation'}
                </span>
            );
        }
        if (lessonStatus === 'CANCELLED') {
            return <span className={`${pill} bg-gray-50 text-gray-600 border-gray-200`}>Cancelled</span>;
        }
        if (lessonStatus === 'COMPLETED') {
            return <span className={`${pill} bg-green-50 text-green-700 border-green-200`}>Completed</span>;
        }
        if (lessonStatus === 'MISSED') {
            return <span className={`${pill} bg-red-50 text-red-700 border-red-200`}>Missed</span>;
        }
        if (billing === 'FREE_INTRO') {
            return <span className={`${pill} bg-green-50 text-green-700 border-green-200`}>Free Intro</span>;
        }
        if (billing === 'FREE_TRIAL') {
            return <span className={`${pill} bg-blue-50 text-blue-700 border-blue-200`}>Free Trial</span>;
        }
        if (ps === 'paid') {
            return <span className={`${pill} bg-emerald-50 text-emerald-700 border-emerald-200`}>Paid</span>;
        }
        if (ps === 'failed') {
            return <span className={`${pill} bg-red-50 text-red-700 border-red-200`}>Payment Failed</span>;
        }
        return <span className={`${pill} bg-amber-50 text-amber-700 border-amber-200`}>Payment Pending</span>;
    };

    return (
        <DashboardLayout>
            <div className="w-full">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-[#4A1D96]" />
                            <h1 className="text-3xl font-bold text-gray-900">Sessions</h1>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Your upcoming and past sessions.</p>
                    </div>
                    <Link to="/students"><Button variant="outline" className="flex items-center gap-2"><Users className="w-4 h-4" />Students</Button></Link>
                </div>

                <div className="flex gap-2 mb-4">
                    <Button variant={tab === 'upcoming' ? 'primary' : 'outline'} onClick={() => setTab('upcoming')}>Upcoming</Button>
                    <Button variant={tab === 'past' ? 'primary' : 'outline'} onClick={() => setTab('past')}>Past</Button>
                </div>

                {loading ? (
                    <Card className="p-6">
                        <div className="text-sm text-gray-600">Loading sessions...</div>
                    </Card>
                ) : loadError ? (
                    <Card className="p-6">
                        <div className="text-sm text-red-700 font-semibold">{loadError}</div>
                    </Card>
                ) : sorted.length === 0 ? (
                    <Card className="p-6">
                        <div className="text-sm text-gray-700 font-semibold">
                            {tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">Sessions will appear here after students book with you.</div>
                    </Card>
                ) : (
                    <div className="space-y-5">
                        {sorted.map((l) => {
                            const studentName = l.student?.username || 'Student';
                            const booked = l.created_at || l.booking?.created_at;
                            return (
                                <SessionListCard
                                    key={l.id}
                                    otherPersonName={studentName}
                                    personRoleLabel="Student"
                                    dateRowValue={formatDateLong(l.start_time)}
                                    timeRowValue={formatTimeOnlyRange(l.start_time, l.end_time)}
                                    durationMinutes={durationMinutes(l.start_time, l.end_time)}
                                    badge={mapPaymentBadge(l)}
                                    bookedOnLine={booked ? formatBookedOn(booked) : null}
                                    onCardClick={() => navigate(`/sessions/${l.id}`)}
                                    actions={
                                        <>
                                            {(() => {
                                                const status = l.status.toUpperCase();
                                                if (['COMPLETED', 'CANCELLED', 'MISSED'].includes(status)) return null;
                                                const startMs = new Date(l.start_time).getTime();
                                                const endMs = new Date(l.end_time).getTime();
                                                const nowMs = Date.now();
                                                const isJoinable = nowMs >= startMs - 15 * 60 * 1000 && nowMs <= endMs + 15 * 60 * 1000;
                                                if (!isJoinable) return null;
                                                return (
                                                    <>
                                                        <Button
                                                            className="flex items-center gap-2"
                                                            disabled={joinBusyId === l.id}
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                try {
                                                                    setJoinBusyId(l.id);
                                                                    const res = await api.get(`/lessons/${l.id}/join`);
                                                                    const url = res.data?.meeting_link as string | undefined;
                                                                    if (url) window.open(url, '_blank');
                                                                    else setNotice({ title: 'Meeting link not ready', message: 'The Google Meet link is not available yet. Please try again in a minute.' });
                                                                } catch (err) {
                                                                    setNotice({ title: 'Error', message: apiError(err, 'Unable to join session. Please try again.') });
                                                                } finally {
                                                                    setJoinBusyId(null);
                                                                }
                                                            }}
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                            {joinBusyId === l.id ? 'Joining…' : 'Join Session'}
                                                        </Button>
                                                        <a href={`/tutor/whiteboard?lesson=${l.id}`} target="_blank" rel="noreferrer">
                                                            <Button variant="outline" className="flex items-center gap-2">
                                                                <ExternalLink className="w-4 h-4" />
                                                                Open Whiteboard
                                                            </Button>
                                                        </a>
                                                    </>
                                                );
                                            })()}
                                            {(() => {
                                                const status = l.status.toUpperCase();
                                                if (['COMPLETED', 'CANCELLED', 'MISSED'].includes(status)) return null;
                                                if (Date.now() > new Date(l.end_time).getTime() + 15 * 60 * 1000) return null;
                                                return (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            className="flex items-center gap-2"
                                                            disabled={linkBusyId === l.id}
                                                            onClick={(e) => { e.stopPropagation(); void copyMeetingLink(l); }}
                                                        >
                                                            {copiedId === l.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                                            {copiedId === l.id ? 'Link copied' : linkBusyId === l.id ? 'Preparing link…' : 'Copy Meet link'}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            className="flex items-center gap-2"
                                                            disabled={sendBusyId === l.id}
                                                            onClick={(e) => { e.stopPropagation(); void sendMeetingLink(l); }}
                                                        >
                                                            <Send className="w-4 h-4" />
                                                            {sendBusyId === l.id ? 'Sending…' : 'Send link to student'}
                                                        </Button>
                                                    </>
                                                );
                                            })()}
                                            {(l.status || '').toUpperCase() === 'BOOKED' && Date.now() > new Date(l.end_time).getTime() && !l.student_confirmed_at ? (
                                                <span className="inline-flex items-center px-3 py-2 rounded-lg text-xs bg-gray-50 text-gray-600 border border-gray-200 max-w-xs">
                                                    Student confirms first — auto-completes {graceHours}h after the session if unconfirmed
                                                </span>
                                            ) : null}
                                            {(l.status || '').toUpperCase() === 'BOOKED' && Date.now() > new Date(l.end_time).getTime() && l.student_confirmed_at && !l.tutor_confirmed_at ? (
                                                <Button
                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                    disabled={confirmBusyId === l.id}
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            setConfirmBusyId(l.id);
                                                            const res = await api.post(`/lessons/${l.id}/confirm-complete`);
                                                            const upd = res.data?.lesson;
                                                            setLessons((prev) => prev.map((x) => (x.id === l.id
                                                                ? { ...x, status: upd?.status || 'COMPLETED', tutor_confirmed_at: upd?.tutor_confirmed_at || new Date().toISOString() }
                                                                : x)));
                                                        } catch (err) {
                                                            setNotice({ title: 'Error', message: apiError(err, 'Unable to confirm completion.') });
                                                        } finally {
                                                            setConfirmBusyId(null);
                                                        }
                                                    }}
                                                >
                                                    {confirmBusyId === l.id ? 'Confirming…' : 'Confirm completion'}
                                                </Button>
                                            ) : null}
                                            {l.google_calendar_html_link ? (
                                                <a href={l.google_calendar_html_link} target="_blank" rel="noreferrer">
                                                    <Button variant="outline">Open in Calendar</Button>
                                                </a>
                                            ) : null}
                                        </>
                                    }
                                />
                            );
                        })}
                    </div>
                )}
            </div>
            <Modal isOpen={!!notice} onClose={() => setNotice(null)} title={notice?.title || ''}>
                <p className="text-sm text-gray-700 break-words">{notice?.message}</p>
            </Modal>
        </DashboardLayout>
    );
};

export default TutorSessionsPage;
