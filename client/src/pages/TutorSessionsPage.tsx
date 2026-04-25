import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Users, ExternalLink } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import SessionListCard from '../components/sessions/SessionListCard';
import api from '../api/axios';

type Lesson = {
    id: string;
    student_id?: string;
    start_time: string;
    end_time: string;
    created_at?: string;
    status: string;
    billing_type?: 'FREE_TRIAL' | 'FREE_INTRO' | 'PAID';
    payment_status?: 'paid' | 'pending' | 'failed' | 'not_required' | 'unknown';
    meeting_link?: string | null;
    google_calendar_html_link?: string | null;
    student?: { username?: string | null };
    booking?: { frequency?: string; created_at?: string } | null;
};

const TutorSessionsPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

    const studentId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const v = params.get('studentId');
        return v && v.trim() ? v.trim() : null;
    }, [location.search]);

    useEffect(() => {
        const fetchLessons = async () => {
            try {
                const from = new Date();
                from.setDate(from.getDate() - 60);
                from.setHours(0, 0, 0, 0);

                const to = new Date();
                to.setDate(to.getDate() + 120);
                to.setHours(23, 59, 59, 999);

                const res = await api.get('/lessons/me', {
                    params: { from: from.toISOString(), to: to.toISOString() },
                });

                setLessons(res.data?.lessons || []);
            } catch (e) {
                console.error('Failed to fetch tutor lessons', e);
                setLessons([]);
            } finally {
                setLoading(false);
            }
        };

        fetchLessons();
    }, []);

    const nowMs = Date.now();

    const filtered = useMemo(() => {
        const base = lessons
            .map((l) => ({
                ...l,
                startMs: new Date(l.start_time).getTime(),
            }))
            .filter((l) => !Number.isNaN(l.startMs));

        const tabbed = tab === 'upcoming'
            ? base.filter((l) => l.startMs >= nowMs)
            : base.filter((l) => l.startMs < nowMs);

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
                ) : sorted.length === 0 ? (
                    <Card className="p-6">
                        <div className="text-sm text-gray-700 font-semibold">No sessions</div>
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
                                            {l.meeting_link && !['COMPLETED', 'CANCELLED', 'MISSED'].includes(l.status.toUpperCase()) ? (
                                                <a href={l.meeting_link} target="_blank" rel="noreferrer">
                                                    <Button className="flex items-center gap-2">
                                                        <ExternalLink className="w-4 h-4" />
                                                        Join Session
                                                    </Button>
                                                </a>
                                            ) : l.meeting_link ? (
                                                <Button disabled>Join Session</Button>
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
        </DashboardLayout>
    );
};

export default TutorSessionsPage;
