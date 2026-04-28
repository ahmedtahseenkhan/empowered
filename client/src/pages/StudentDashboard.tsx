import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import api from '../api/axios';

type Lesson = {
    id: string;
    start_time: string;
    end_time: string;
    status: 'PENDING' | 'BOOKED' | 'COMPLETED' | string;
    meeting_link?: string | null;
    google_calendar_html_link?: string | null;
    tutor?: { username?: string | null };
};

function lessonStatusUpper(l: Lesson) {
    return String(l.status || '').toUpperCase();
}

/** Future sessions that are still on the schedule (not finished or cancelled). */
function isScheduledUpcoming(l: Lesson, nowMs: number) {
    const st = lessonStatusUpper(l);
    if (st === 'CANCELLED' || st === 'COMPLETED' || st === 'MISSED') return false;
    return new Date(l.start_time).getTime() > nowMs;
}

type CoursePurchase = {
    id: string;
    purchased_at: string;
    course: {
        id: string;
        title: string;
        price: string;
        tutor?: { username?: string; rating?: number };
    };
};

const StatsCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
    <Card variant="compact" className="flex flex-row items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
        </div>
    </Card>
);

const StudentDashboard: React.FC = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    /** Wide-range fetch for dashboard stats (not tied to calendar month). */
    const [statsLessons, setStatsLessons] = useState<Lesson[]>([]);
    const [statsLoading, setStatsLoading] = useState(true);
    const [courses, setCourses] = useState<CoursePurchase[]>([]);

    const [calendarView, setCalendarView] = useState<'week' | 'month'>('month');
    const [monthCursor, setMonthCursor] = useState<Date>(() => {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [selectedDayIso, setSelectedDayIso] = useState<string>(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
    });

    const [busy, setBusy] = useState(false);
    const [payBusy, setPayBusy] = useState(false);
    const [payError, setPayError] = useState<string>('');
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [joinBusyId, setJoinBusyId] = useState<string | null>(null);

    const weekStart = useMemo(() => {
        const now = new Date();
        const day = now.getDay();
        const diffToMonday = (day + 6) % 7;
        const start = new Date(now);
        start.setDate(now.getDate() - diffToMonday);
        start.setHours(0, 0, 0, 0);
        return start;
    }, []);

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return d;
        });
    }, [weekStart]);

    useEffect(() => {
        let cancelled = false;
        const fetchStatsLessons = async () => {
            try {
                setStatsLoading(true);
                const from = new Date();
                from.setFullYear(from.getFullYear() - 3);
                from.setHours(0, 0, 0, 0);
                const to = new Date();
                to.setFullYear(to.getFullYear() + 2);
                to.setHours(23, 59, 59, 999);
                const res = await api.get('/lessons/me', {
                    params: { from: from.toISOString(), to: to.toISOString() },
                });
                if (!cancelled) setStatsLessons(res.data?.lessons || []);
            } catch (e) {
                console.error('Failed to load lessons for dashboard stats', e);
                if (!cancelled) setStatsLessons([]);
            } finally {
                if (!cancelled) setStatsLoading(false);
            }
        };
        fetchStatsLessons();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const coursesRes = await api.get('/courses/student/purchased');
                setCourses(coursesRes.data || []);
            } catch (e) {
                console.error('Failed to load student courses', e);
            }
        };

        fetchCourses();
    }, []);

    useEffect(() => {
        const fetchLessonsForMonth = async () => {
            try {
                setBusy(true);

                const first = new Date(monthCursor);
                const gridStart = new Date(first);
                const day = gridStart.getDay();
                const diffToMonday = (day + 6) % 7;
                gridStart.setDate(gridStart.getDate() - diffToMonday);

                const gridEnd = new Date(gridStart);
                gridEnd.setDate(gridEnd.getDate() + 42);

                const from = gridStart;
                const to = gridEnd;

                const selected = new Date(monthCursor);
                selected.setHours(0, 0, 0, 0);
                setSelectedDayIso(selected.toISOString());

                const lessonsRes = await api.get('/lessons/me', {
                    params: { from: from.toISOString(), to: to.toISOString() }
                });

                setLessons(lessonsRes.data?.lessons || []);
            } catch (e) {
                console.error('Failed to load student lessons', e);
            } finally {
                setBusy(false);
                setLoading(false);
            }
        };

        fetchLessonsForMonth();
    }, [monthCursor]);

    const completedSessions = useMemo(() => {
        return statsLessons.filter((l) => lessonStatusUpper(l) === 'COMPLETED').length;
    }, [statsLessons]);

    const upcomingSessions = useMemo(() => {
        const nowMs = Date.now();
        return statsLessons
            .filter((l) => isScheduledUpcoming(l, nowMs))
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }, [statsLessons]);

    const totalCourses = useMemo(() => courses.length, [courses.length]);

    const startHour = 6;
    const endHour = 22;
    const hourHeightPx = 48;
    const minutesToPx = (minutes: number) => (minutes / 60) * hourHeightPx;

    const dayIndexFor = (d: Date) => {
        const start = new Date(weekStart);
        const ms = d.getTime() - start.getTime();
        return Math.floor(ms / (24 * 60 * 60 * 1000));
    };

    const lessonBlocks = useMemo(() => {
        return lessons
            .map(l => {
                const start = new Date(l.start_time);
                const end = new Date(l.end_time);
                const idx = dayIndexFor(start);
                return { ...l, start, end, idx };
            })
            .filter(x => x.idx >= 0 && x.idx < 7);
    }, [lessons, weekStart]);

    const monthDays = useMemo(() => {
        const first = new Date(monthCursor);
        const start = new Date(first);
        const day = start.getDay();
        const diffToMonday = (day + 6) % 7;
        start.setDate(start.getDate() - diffToMonday);

        const days: Date[] = [];
        for (let i = 0; i < 42; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            d.setHours(0, 0, 0, 0);
            days.push(d);
        }
        return days;
    }, [monthCursor]);

    const lessonsByDayIso = useMemo(() => {
        const map = new Map<string, Lesson[]>();
        for (const l of lessons) {
            const d = new Date(l.start_time);
            d.setHours(0, 0, 0, 0);
            const key = d.toISOString();
            const arr = map.get(key) || [];
            arr.push(l);
            map.set(key, arr);
        }
        for (const [key, arr] of map.entries()) {
            arr.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
            map.set(key, arr);
        }
        return map;
    }, [lessons]);

    const selectedDayLessons = useMemo(() => {
        return lessonsByDayIso.get(selectedDayIso) || [];
    }, [lessonsByDayIso, selectedDayIso]);


    if (loading) return <DashboardLayout><div>Loading Dashboard...</div></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">Welcome back</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Track your sessions, mentors, and courses.</p>
                        </div>
                        <Button size="sm" onClick={() => navigate('/student/mentors')}>Find Your Perfect Mentor</Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <StatsCard icon={<CheckCircle className="w-5 h-5" />} label="Completed Sessions" value={statsLoading ? '…' : completedSessions} />
                        <StatsCard icon={<Calendar className="w-5 h-5" />} label="Upcoming Sessions" value={statsLoading ? '…' : upcomingSessions.length} />
                        <StatsCard icon={<BookOpen className="w-5 h-5" />} label="Total Courses" value={totalCourses} />
                    </div>




                    <Card>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-base font-semibold text-gray-900">Calendar</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Your booked and upcoming sessions.</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    size="sm"
                                    variant={calendarView === 'month' ? 'primary' : 'outline'}
                                    onClick={() => setCalendarView('month')}
                                >
                                    Month
                                </Button>
                                <Button
                                    size="sm"
                                    variant={calendarView === 'week' ? 'primary' : 'outline'}
                                    onClick={() => setCalendarView('week')}
                                >
                                    Week
                                </Button>
                            </div>
                        </div>

                        {calendarView === 'month' ? (
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
                                    <span className="text-sm font-semibold text-gray-900">
                                        {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Button size="xs" variant="outline" onClick={() => {
                                            const d = new Date(monthCursor);
                                            d.setMonth(d.getMonth() - 1);
                                            setMonthCursor(d);
                                        }}>
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button size="xs" variant="outline" onClick={() => {
                                            const d = new Date(monthCursor);
                                            d.setMonth(d.getMonth() + 1);
                                            setMonthCursor(d);
                                        }}>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-7 border-b border-gray-200">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                                        <div key={d} className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-r border-gray-100 last:border-r-0">
                                            {d}
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7">
                                    {monthDays.map((d) => {
                                        const iso = d.toISOString();
                                        const inMonth = d.getMonth() === monthCursor.getMonth();
                                        const isToday = (() => {
                                            const t = new Date();
                                            t.setHours(0, 0, 0, 0);
                                            return t.toISOString() === iso;
                                        })();
                                        const isSelected = selectedDayIso === iso;
                                        const dayLessons = lessonsByDayIso.get(iso) || [];
                                        const count = dayLessons.length;

                                        return (
                                            <button
                                                key={iso}
                                                type="button"
                                                onClick={() => setSelectedDayIso(iso)}
                                                className={`h-24 p-2 text-left border-r border-b border-gray-100 last:border-r-0 hover:bg-purple-50 transition-colors ${inMonth ? 'bg-white' : 'bg-gray-50'} ${isSelected ? 'ring-2 ring-purple-400 ring-inset' : ''}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className={`text-xs font-semibold ${inMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                                                        {d.getDate()}
                                                    </div>
                                                    {isToday && (
                                                        <div className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Today</div>
                                                    )}
                                                </div>

                                                {count > 0 && (
                                                    <div className="mt-2">
                                                        <div className="inline-flex items-center text-[10px] px-2 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-800">
                                                            {count} session{count === 1 ? '' : 's'}
                                                        </div>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="p-4 border-t border-gray-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="font-semibold text-gray-900">
                                            {new Date(selectedDayIso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                        </div>
                                        {busy && <div className="text-xs text-gray-500">Loading...</div>}
                                    </div>

                                    {selectedDayLessons.length === 0 ? (
                                        <div className="text-sm text-gray-600">No sessions on this day.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedDayLessons.map((l) => (
                                                <div key={l.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2">
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">{l.tutor?.username || 'Mentor'}</div>
                                                        <div className="text-xs text-gray-600">
                                                            {new Date(l.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })} — {new Date(l.end_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1.5 shrink-0">
                                                        {l.meeting_link && (() => {
                                                            const startMs = new Date(l.start_time).getTime();
                                                            const nowMs = Date.now();
                                                            return nowMs >= startMs - 15 * 60 * 1000 && nowMs <= startMs + 50 * 60 * 1000;
                                                        })() && (
                                                            <Button
                                                                variant="outline"
                                                                size="xs"
                                                                disabled={joinBusyId === l.id}
                                                                onClick={async () => {
                                                                    try {
                                                                        setJoinBusyId(l.id);
                                                                        setPayError('');
                                                                        const res = await api.get(`/lessons/${l.id}/join`);
                                                                        const url = res.data?.meeting_link as string | undefined;
                                                                        if (url) {
                                                                            window.open(url, '_blank');
                                                                        } else {
                                                                            setPayError('Meeting link is not available yet.');
                                                                            setErrorModalOpen(true);
                                                                        }
                                                                    } catch (e: any) {
                                                                        setPayError(e?.response?.data?.error || 'Unable to join session.');
                                                                        setErrorModalOpen(true);
                                                                    } finally {
                                                                        setJoinBusyId(null);
                                                                    }
                                                                }}
                                                            >
                                                                {joinBusyId === l.id ? '…' : 'Join'}
                                                            </Button>
                                                        )}
                                                        {l.google_calendar_html_link && (
                                                            <Button variant="outline" size="xs" onClick={() => window.open(l.google_calendar_html_link as string, '_blank')}>
                                                                Calendar
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                <div className="grid" style={{ gridTemplateColumns: `90px repeat(7, minmax(0, 1fr))` }}>
                                    <div className="bg-gray-50 border-b border-gray-200"></div>
                                    {weekDays.map((d, idx) => (
                                        <div key={idx} className="bg-gray-50 border-b border-gray-200 px-3 py-2">
                                            <div className="text-xs font-semibold text-gray-900">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                                            <div className="text-xs text-gray-500">{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid" style={{ gridTemplateColumns: `90px repeat(7, minmax(0, 1fr))` }}>
                                    <div className="border-r border-gray-200">
                                        {Array.from({ length: endHour - startHour }).map((_, i) => {
                                            const hour = startHour + i;
                                            const label = new Date(new Date().setHours(hour, 0, 0, 0)).toLocaleTimeString(undefined, { hour: 'numeric', hour12: true });
                                            return (
                                                <div key={hour} className="h-12 border-b border-gray-100 px-2 flex items-start justify-end">
                                                    <span className="text-[10px] text-gray-500 mt-1">{label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {weekDays.map((_, dayIdx) => (
                                        <div key={dayIdx} className="relative border-r border-gray-100" style={{ height: (endHour - startHour) * hourHeightPx }}>
                                            {Array.from({ length: endHour - startHour }).map((__, i) => (
                                                <div key={i} className="h-12 border-b border-gray-100"></div>
                                            ))}

                                            {lessonBlocks
                                                .filter(l => l.idx === dayIdx)
                                                .map((l) => {
                                                    const startMinutes = (l.start.getHours() - startHour) * 60 + l.start.getMinutes();
                                                    const endMinutes = (l.end.getHours() - startHour) * 60 + l.end.getMinutes();
                                                    const top = minutesToPx(startMinutes);
                                                    const height = Math.max(12, minutesToPx(endMinutes - startMinutes));
                                                    if (startMinutes < 0 || endMinutes > (endHour - startHour) * 60) return null;

                                                    return (
                                                        <div
                                                            key={l.id}
                                                            className="absolute left-1 right-1 rounded-md bg-purple-50 border border-purple-200 text-purple-900 px-2 py-1 text-[10px]"
                                                            style={{ top, height }}
                                                            title={`${l.tutor?.username || 'Mentor'} (${l.status})`}
                                                        >
                                                            <div className="font-semibold truncate">Session</div>
                                                            <div className="truncate">{l.tutor?.username || 'Mentor'}</div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                <div className="w-full lg:w-72 space-y-4">
                    <Card variant="compact">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Shortcuts</h3>
                        <div className="space-y-1">
                            <button type="button" onClick={() => navigate('/student/my-courses')} className="w-full text-left text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50/50 rounded-lg px-3 py-2 transition-colors">
                                My Courses
                            </button>
                            <button type="button" onClick={() => navigate('/student/my-mentors')} className="w-full text-left text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50/50 rounded-lg px-3 py-2 transition-colors">
                                My Mentors
                            </button>
                        </div>
                    </Card>

                    <Card variant="compact">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-900">Upcoming Sessions</h3>
                            <Button
                                size="xs"
                                variant="outline"
                                disabled={payBusy}
                                onClick={async () => {
                                    try {
                                        setPayBusy(true);
                                        setPayError('');
                                        const baseUrl = window.location.origin;
                                        const successUrl = `${baseUrl}/student/sessions`;
                                        const cancelUrl = `${baseUrl}/student/sessions`;

                                        const res = await api.post('/payments/student/booking/pay-next', {
                                            successUrl,
                                            cancelUrl,
                                        });

                                        if (res.data?.url) {
                                            window.location.href = res.data.url;
                                        } else {
                                            setPayError('Failed to start payment – please try again.');
                                            setErrorModalOpen(true);
                                        }
                                    } catch (e: any) {
                                        setPayError(e?.response?.data?.error || 'No due session payment found.');
                                        setErrorModalOpen(true);
                                    } finally {
                                        setPayBusy(false);
                                    }
                                }}
                            >
                                {payBusy ? '…' : 'Pay next'}
                            </Button>
                        </div>

                        {busy ? (
                            <div className="text-xs text-gray-600">Loading...</div>
                        ) : upcomingSessions.length === 0 ? (
                            <div className="text-xs text-gray-600">No upcoming sessions yet.</div>
                        ) : (
                            <div className="space-y-3">
                                {upcomingSessions.slice(0, 3).map((l) => (
                                    <div
                                        key={l.id}
                                        className="border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:border-primary-300 transition-colors"
                                        onClick={() => navigate(`/student/sessions/${l.id}`)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="text-sm font-semibold text-gray-900">{l.tutor?.username || 'Mentor'}</div>
                                                <div className="text-xs text-gray-600">
                                                    {new Date(l.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {new Date(l.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="xs"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/student/sessions/${l.id}`);
                                                }}
                                            >
                                                View
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card variant="compact">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Recent Courses</h3>
                        {courses.length === 0 ? (
                            <p className="text-xs text-gray-500">No courses yet.</p>
                        ) : (
                            <ul className="space-y-2">
                                {courses.slice(0, 3).map((p) => (
                                    <li key={p.id} className="text-sm text-gray-700 truncate" title={p.course.title}>
                                        {p.course.title}
                                        <span className="text-xs text-gray-500 block">by {p.course.tutor?.username || 'Mentor'}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>
            <Modal
                isOpen={errorModalOpen}
                onClose={() => setErrorModalOpen(false)}
                title="Error"
            >
                <p>{payError}</p>
            </Modal>
        </DashboardLayout>
    );
};

export default StudentDashboard;
