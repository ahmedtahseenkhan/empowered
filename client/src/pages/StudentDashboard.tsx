import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle, BookOpen, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
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
    <Card className="p-6 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-3">
            {icon}
        </div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
    </Card>
);

const StudentDashboard: React.FC = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [lessons, setLessons] = useState<Lesson[]>([]);
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

    const now = new Date();

    const completedSessions = useMemo(() => {
        return lessons.filter(l => l.status === 'COMPLETED').length;
    }, [lessons]);

    const upcomingSessions = useMemo(() => {
        return lessons
            .filter(l => new Date(l.start_time) > now && (l.status === 'BOOKED' || l.status === 'PENDING'))
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }, [lessons, now]);

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
            <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-8">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
                            <p className="text-sm text-gray-600 mt-1">Track your sessions, mentors, and courses.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => navigate('/student/mentors')}>Find a Mentor</Button>
                            <Button onClick={() => navigate('/student/mentors')}>Browse Mentors</Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatsCard icon={<CheckCircle className="w-5 h-5" />} label="Completed Sessions" value={completedSessions} />
                        <StatsCard icon={<Calendar className="w-5 h-5" />} label="Upcoming Sessions" value={upcomingSessions.length} />
                        <StatsCard icon={<BookOpen className="w-5 h-5" />} label="Total Courses" value={totalCourses} />
                    </div>




                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Calendar</h2>
                                <p className="text-sm text-gray-500">Month-wise view of your booked and upcoming sessions.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant={calendarView === 'month' ? 'primary' : 'outline'}
                                    onClick={() => setCalendarView('month')}
                                >
                                    Month
                                </Button>
                                <Button
                                    variant={calendarView === 'week' ? 'primary' : 'outline'}
                                    onClick={() => setCalendarView('week')}
                                >
                                    Week
                                </Button>
                            </div>
                        </div>

                        {calendarView === 'month' ? (
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                                    <div className="font-semibold text-gray-900">
                                        {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const d = new Date(monthCursor);
                                                d.setMonth(d.getMonth() - 1);
                                                setMonthCursor(d);
                                            }}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Prev
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const d = new Date(monthCursor);
                                                d.setMonth(d.getMonth() + 1);
                                                setMonthCursor(d);
                                            }}
                                        >
                                            Next
                                            <ChevronRight className="w-4 h-4" />
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
                                                            {new Date(l.start_time).toLocaleTimeString()} — {new Date(l.end_time).toLocaleTimeString()}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {l.meeting_link && (
                                                            <Button variant="outline" onClick={() => window.open(l.meeting_link as string, '_blank')}>Join</Button>
                                                        )}
                                                        {l.google_calendar_html_link && (
                                                            <Button variant="outline" onClick={() => window.open(l.google_calendar_html_link as string, '_blank')}>Calendar</Button>
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
                                            const label = new Date(new Date().setHours(hour, 0, 0, 0)).toLocaleTimeString(undefined, { hour: 'numeric' });
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

                <div className="w-full lg:w-80 space-y-6">
                    <Card className="p-6">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Quick Actions</p>
                                <div className="mt-2 space-y-2">
                                    <Button variant="outline" className="w-full" onClick={() => navigate('/student/my-courses')}>My Courses</Button>
                                    <Button variant="outline" className="w-full" onClick={() => navigate('/student/my-mentors')}>My Mentors</Button>
                                    <Button className="w-full" onClick={() => navigate('/student/mentors')}>Find a Mentor</Button>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-sm font-bold text-gray-900">Upcoming Sessions</h2>
                            </div>
                        </div>

                        {busy ? (
                            <div className="text-xs text-gray-600">Loading...</div>
                        ) : upcomingSessions.length === 0 ? (
                            <div className="text-xs text-gray-600">No upcoming sessions yet.</div>
                        ) : (
                            <div className="space-y-3">
                                {upcomingSessions.slice(0, 3).map((l) => (
                                    <div key={l.id} className="border border-gray-200 rounded-lg px-3 py-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="text-sm font-semibold text-gray-900">{l.tutor?.username || 'Mentor'}</div>
                                                <div className="text-xs text-gray-600">
                                                    {new Date(l.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {new Date(l.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            {l.meeting_link && (
                                                <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => window.open(l.meeting_link as string, '_blank')}>Join</Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card className="p-6">
                        <div className="text-sm font-bold text-gray-900 mb-2">Recent Courses</div>
                        {courses.length === 0 ? (
                            <div className="text-sm text-gray-600">No courses purchased yet.</div>
                        ) : (
                            <div className="space-y-3">
                                {courses.slice(0, 3).map((p) => (
                                    <div key={p.id} className="border border-gray-200 rounded-lg px-3 py-2">
                                        <div className="text-sm font-semibold text-gray-900 truncate">{p.course.title}</div>
                                        <div className="text-xs text-gray-600">by {p.course.tutor?.username || 'Mentor'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default StudentDashboard;
