import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Users, ExternalLink, ChevronRight } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
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

    const formatRange = (startIso: string, endIso: string) => {
        const s = new Date(startIso);
        const e = new Date(endIso);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—';
        const datePart = s.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
        const startTime = s.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
        const endTime = e.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${datePart}, ${startTime} – ${endTime}`;
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

        if (lessonStatus === 'CANCELLED') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-600 border border-gray-200">
                    Cancelled
                </span>
            );
        }
        if (lessonStatus === 'COMPLETED') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                    Completed
                </span>
            );
        }
        if (lessonStatus === 'MISSED') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                    Missed
                </span>
            );
        }
        if (billing === 'FREE_INTRO') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                    Free Intro
                </span>
            );
        }
        if (billing === 'FREE_TRIAL') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Free Trial
                </span>
            );
        }
        if (ps === 'paid') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Paid
                </span>
            );
        }
        if (ps === 'failed') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                    Payment Failed
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Payment Pending
            </span>
        );
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
                    <div className="space-y-4">
                        {sorted.map((l) => (
                            <Card
                                key={l.id}
                                className="p-6 cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => navigate(`/sessions/${l.id}`)}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {mapPaymentBadge(l)}
                                        </div>
                                        <div className="text-lg font-bold text-gray-900 mt-1">{l.student?.username || 'Student'}</div>
                                        <div className="text-sm text-gray-700 mt-2">{formatRange(l.start_time, l.end_time)}</div>
                                        {(l.created_at || l.booking?.created_at) ? (
                                            <div className="text-xs text-gray-500 mt-1">
                                                Booked on {formatBookedOn(l.created_at || l.booking?.created_at || '')}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="flex gap-2 sm:flex-col items-center">
                                        {l.meeting_link ? (
                                            <a href={l.meeting_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                                <Button className="w-full flex items-center gap-2"><ExternalLink className="w-4 h-4" />Join</Button>
                                            </a>
                                        ) : (
                                            <Button className="w-full" disabled onClick={(e) => e.stopPropagation()}>Join</Button>
                                        )}
                                        {l.google_calendar_html_link ? (
                                            <a href={l.google_calendar_html_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                                <Button variant="outline" className="w-full">Calendar</Button>
                                            </a>
                                        ) : null}
                                        <ChevronRight className="w-5 h-5 text-gray-400 hidden sm:block" />
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default TutorSessionsPage;
