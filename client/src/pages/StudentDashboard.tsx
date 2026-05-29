import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, CheckCircle, BookOpen, ChevronLeft, ChevronRight,
    ArrowRight, CreditCard, Users, Video, ExternalLink,
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

type Lesson = {
    id: string;
    start_time: string;
    end_time: string;
    status: 'PENDING' | 'BOOKED' | 'COMPLETED' | string;
    meeting_link?: string | null;
    google_calendar_html_link?: string | null;
    payment_status?: string;
    tutor?: { username?: string | null; id?: string };
};

type CoursePurchase = {
    id: string;
    purchased_at: string;
    course: {
        id: string;
        title: string;
        price: string;
        course_url?: string;
        tutor?: { username?: string; id?: string };
    };
};

type MentorEntry = {
    tutor: {
        id: string;
        username: string;
        profile_photo?: string | null;
    };
    nextSessionStart?: string | null;
};

function isUpcoming(l: Lesson, nowMs: number) {
    const st = String(l.status || '').toUpperCase();
    return st !== 'CANCELLED' && st !== 'COMPLETED' && st !== 'MISSED' && new Date(l.start_time).getTime() > nowMs;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string }) => (
    <div className={`relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 overflow-hidden`}>
        <div className={`absolute left-0 inset-y-0 w-1 rounded-l-2xl ${accent}`} />
        <div className="flex items-center gap-3 pl-1">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent.replace('bg-', 'bg-').replace('-500', '-50')} `}
                style={{ backgroundColor: 'transparent' }}>
                <div className={`${accent.replace('bg-', 'text-')}`}>{icon}</div>
            </div>
            <div>
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 leading-none mt-0.5">{value}</p>
            </div>
        </div>
    </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const StudentDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [statsLessons, setStatsLessons] = useState<Lesson[]>([]);
    const [statsLoading, setStatsLoading] = useState(true);
    const [courses, setCourses] = useState<CoursePurchase[]>([]);
    const [mentors, setMentors] = useState<MentorEntry[]>([]);

    const [monthCursor, setMonthCursor] = useState<Date>(() => {
        const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
    });
    const [selectedDayIso, setSelectedDayIso] = useState<string>(() => {
        const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
    });

    const [busy, setBusy] = useState(false);
    const [payBusy, setPayBusy] = useState(false);
    const [payError, setPayError] = useState('');
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [joinBusyId, setJoinBusyId] = useState<string | null>(null);

    // ─── Data fetching ──────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const from = new Date(); from.setFullYear(from.getFullYear() - 3); from.setHours(0, 0, 0, 0);
        const to = new Date(); to.setFullYear(to.getFullYear() + 2); to.setHours(23, 59, 59, 999);
        setStatsLoading(true);
        api.get('/lessons/me', { params: { from: from.toISOString(), to: to.toISOString() } })
            .then(res => { if (!cancelled) setStatsLessons(res.data?.lessons || []); })
            .catch(() => { if (!cancelled) setStatsLessons([]); })
            .finally(() => { if (!cancelled) setStatsLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        api.get('/courses/student/purchased')
            .then(res => setCourses(res.data || []))
            .catch(() => setCourses([]));
    }, []);

    useEffect(() => {
        api.get('/student/mentors')
            .then(res => setMentors(res.data?.mentors || res.data || []))
            .catch(() => setMentors([]));
    }, []);

    useEffect(() => {
        setBusy(true);
        const first = new Date(monthCursor);
        const gridStart = new Date(first);
        const day = gridStart.getDay();
        gridStart.setDate(gridStart.getDate() - ((day + 6) % 7));
        const gridEnd = new Date(gridStart); gridEnd.setDate(gridEnd.getDate() + 42);

        const selected = new Date(monthCursor); selected.setHours(0, 0, 0, 0);
        setSelectedDayIso(selected.toISOString());

        api.get('/lessons/me', { params: { from: gridStart.toISOString(), to: gridEnd.toISOString() } })
            .then(res => setLessons(res.data?.lessons || []))
            .catch(() => setLessons([]))
            .finally(() => { setBusy(false); setLoading(false); });
    }, [monthCursor]);

    // ─── Derived ────────────────────────────────────────────────────────────────
    const nowMs = Date.now();

    const completedSessions = useMemo(() => statsLessons.filter(l => String(l.status || '').toUpperCase() === 'COMPLETED').length, [statsLessons]);
    const upcomingSessions = useMemo(() =>
        statsLessons.filter(l => isUpcoming(l, nowMs)).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
        [statsLessons]);

    const nextLesson = upcomingSessions[0] || null;

    const paymentDue = useMemo(() => {
        return statsLessons.find(l => {
            const st = String(l.status || '').toUpperCase();
            const ps = String((l as any).payment_status || '').toLowerCase();
            return (st === 'BOOKED' || st === 'PENDING') && (ps === 'pending' || ps === 'failed') && new Date(l.start_time).getTime() > nowMs;
        }) || null;
    }, [statsLessons]);

    const monthDays = useMemo(() => {
        const first = new Date(monthCursor);
        const start = new Date(first);
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
        return Array.from({ length: 42 }).map((_, i) => {
            const d = new Date(start); d.setDate(start.getDate() + i); d.setHours(0, 0, 0, 0); return d;
        });
    }, [monthCursor]);

    const lessonsByDayIso = useMemo(() => {
        const map = new Map<string, Lesson[]>();
        for (const l of lessons) {
            const d = new Date(l.start_time); d.setHours(0, 0, 0, 0);
            const key = d.toISOString();
            const arr = map.get(key) || []; arr.push(l); map.set(key, arr);
        }
        for (const [key, arr] of map.entries()) {
            arr.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
            map.set(key, arr);
        }
        return map;
    }, [lessons]);

    const selectedDayLessons = useMemo(() => lessonsByDayIso.get(selectedDayIso) || [], [lessonsByDayIso, selectedDayIso]);

    const handlePayNext = async () => {
        try {
            setPayBusy(true); setPayError('');
            const baseUrl = window.location.origin;
            const res = await api.post('/payments/student/booking/pay-next', {
                successUrl: `${baseUrl}/student/sessions`,
                cancelUrl: `${baseUrl}/student/sessions`,
            });
            if (res.data?.url) window.location.href = res.data.url;
            else { setPayError('Failed to start payment – please try again.'); setErrorModalOpen(true); }
        } catch (e: any) {
            setPayError(e?.response?.data?.error || 'No due session payment found.');
            setErrorModalOpen(true);
        } finally { setPayBusy(false); }
    };

    const handleJoin = async (l: Lesson) => {
        try {
            setJoinBusyId(l.id); setPayError('');
            const res = await api.get(`/lessons/${l.id}/join`);
            const url = res.data?.meeting_link as string | undefined;
            if (url) window.open(url, '_blank');
            else { setPayError('Meeting link is not available yet.'); setErrorModalOpen(true); }
        } catch (e: any) {
            setPayError(e?.response?.data?.error || 'Unable to join session.');
            setErrorModalOpen(true);
        } finally { setJoinBusyId(null); }
    };

    const canJoin = (l: Lesson) => {
        if (!l.meeting_link) return false;
        const startMs = new Date(l.start_time).getTime();
        return Date.now() >= startMs - 15 * 60 * 1000 && Date.now() <= startMs + 50 * 60 * 1000;
    };

    const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString(undefined, opts);
    const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

    if (loading) return (
        <DashboardLayout>
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
            <div className="space-y-6">

                {/* ── Header ───────────────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Welcome back, {user?.username?.split(' ')[0] || 'there'} 👋
                        </h1>
                        <p className="text-sm text-gray-400 mt-0.5">Track your sessions, mentors, and courses.</p>
                    </div>
                    <Button size="sm" onClick={() => navigate('/student/mentors')} className="shrink-0">
                        Find a Mentor <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                </div>

                {/* ── Stats row ────────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Sessions Completed" value={statsLoading ? '…' : completedSessions} accent="bg-green-500" />
                    <StatCard icon={<Calendar className="w-5 h-5" />} label="Upcoming Sessions" value={statsLoading ? '…' : upcomingSessions.length} accent="bg-purple-500" />
                    <StatCard icon={<BookOpen className="w-5 h-5" />} label="Courses" value={courses.length} accent="bg-blue-500" />
                </div>

                {/* ── Main layout ───────────────────────────────────────────────── */}
                <div className="flex flex-col lg:flex-row gap-6">

                    {/* Left: Calendar + Courses */}
                    <div className="flex-1 min-w-0 space-y-6">

                        {/* Calendar */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Cal header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                                <div>
                                    <h2 className="text-base font-semibold text-gray-900">My Calendar</h2>
                                    <p className="text-xs text-gray-400 mt-0.5">Click a day to see sessions.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => { const d = new Date(monthCursor); d.setMonth(d.getMonth() - 1); d.setDate(1); setMonthCursor(d); }}
                                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                                        <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                                    </button>
                                    <span className="text-sm font-semibold text-gray-900 min-w-[130px] text-center">
                                        {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button onClick={() => { const d = new Date(monthCursor); d.setMonth(d.getMonth() + 1); d.setDate(1); setMonthCursor(d); }}
                                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                                        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                                    </button>
                                </div>
                            </div>

                            {/* Day labels */}
                            <div className="grid grid-cols-7 border-b border-gray-100">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                    <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50/60">{d}</div>
                                ))}
                            </div>

                            {/* Day grid */}
                            <div className="grid grid-cols-7">
                                {monthDays.map(d => {
                                    const iso = d.toISOString();
                                    const inMonth = d.getMonth() === monthCursor.getMonth();
                                    const isToday = d.toDateString() === new Date().toDateString();
                                    const isSelected = selectedDayIso === iso;
                                    const dayLessons = lessonsByDayIso.get(iso) || [];
                                    const count = dayLessons.length;
                                    return (
                                        <button key={iso} type="button" onClick={() => setSelectedDayIso(iso)}
                                            className={`h-14 sm:h-[72px] p-1.5 sm:p-2 text-left border-r border-b border-gray-50 last:border-r-0 transition-colors
                                                ${inMonth ? 'bg-white hover:bg-purple-50/40' : 'bg-gray-50/50'}
                                                ${isSelected ? 'ring-2 ring-inset ring-purple-400 bg-purple-50/30' : ''}
                                                ${isToday && !isSelected ? 'ring-2 ring-inset ring-purple-200' : ''}`}>
                                            <div className={`text-xs font-bold mb-1 ${isToday ? 'text-purple-700' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}>
                                                {d.getDate()}
                                            </div>
                                            {count > 0 && (
                                                <div className={`inline-flex items-center text-[10px] px-1 sm:px-1.5 py-0.5 rounded-md font-semibold
                                                    ${count === 1 ? 'bg-purple-100 text-purple-800' : 'bg-purple-200 text-purple-900'}`}>
                                                    {count}<span className="hidden sm:inline">&nbsp;{count === 1 ? 'session' : 'sessions'}</span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Selected day detail */}
                            <div className="border-t border-gray-100 px-5 py-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-gray-800">
                                        {new Date(selectedDayIso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </h3>
                                    {busy && <span className="text-xs text-gray-400">Loading…</span>}
                                </div>
                                {selectedDayLessons.length === 0 ? (
                                    <p className="text-sm text-gray-400">No sessions on this day.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedDayLessons.map(l => (
                                            <div key={l.id} className="flex items-center justify-between gap-3 bg-gray-50 hover:bg-purple-50/50 rounded-xl px-4 py-3 transition-colors">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">{l.tutor?.username || 'Mentor'}</p>
                                                    <p className="text-xs text-gray-500">{fmtTime(l.start_time)} — {fmtTime(l.end_time)}</p>
                                                </div>
                                                <div className="flex gap-1.5 shrink-0">
                                                    {canJoin(l) && (
                                                        <button disabled={joinBusyId === l.id} onClick={() => handleJoin(l)}
                                                            className="text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                                                            {joinBusyId === l.id ? '…' : 'Join'}
                                                        </button>
                                                    )}
                                                    {l.google_calendar_html_link && (
                                                        <button onClick={() => window.open(l.google_calendar_html_link!, '_blank')}
                                                            className="text-xs font-semibold text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => navigate(`/student/sessions/${l.id}`)}
                                                        className="text-xs font-semibold text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors">
                                                        View
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* My Courses */}
                        {courses.length > 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                                    <h2 className="text-base font-semibold text-gray-900">My Courses</h2>
                                    <button onClick={() => navigate('/student/my-courses')}
                                        className="text-xs font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-colors">
                                        View all <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {courses.slice(0, 3).map(p => (
                                        <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                                            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                                                <BookOpen className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 truncate">{p.course.title}</p>
                                                <p className="text-xs text-gray-400">by {p.course.tutor?.username || 'Mentor'}</p>
                                            </div>
                                            {p.course.course_url && (
                                                <a href={p.course.course_url} target="_blank" rel="noopener noreferrer"
                                                    className="shrink-0 text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1">
                                                    Open <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right sidebar */}
                    <div className="w-full lg:w-72 space-y-4 shrink-0">

                        {/* Next session */}
                        <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${nextLesson ? 'border-purple-200' : 'border-gray-100'}`}>
                            <div className={`px-4 py-3 border-b ${nextLesson ? 'bg-purple-50 border-purple-100' : 'bg-gray-50 border-gray-100'}`}>
                                <h3 className="text-sm font-semibold text-gray-900">Next Session</h3>
                            </div>
                            <div className="p-4">
                                {!nextLesson ? (
                                    <div className="text-center py-2">
                                        <p className="text-sm text-gray-400 mb-3">No upcoming sessions yet.</p>
                                        <button onClick={() => navigate('/student/mentors')}
                                            className="text-xs font-semibold text-purple-700 hover:text-purple-900 border border-purple-200 hover:border-purple-400 px-4 py-2 rounded-xl transition-colors">
                                            Find a Mentor
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-base font-bold text-gray-900">{nextLesson.tutor?.username || 'Mentor'}</p>
                                            <p className="text-sm text-gray-500 mt-0.5">
                                                {fmt(nextLesson.start_time, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </p>
                                            <p className="text-sm font-semibold text-purple-700 mt-0.5">
                                                {fmtTime(nextLesson.start_time)} — {fmtTime(nextLesson.end_time)}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {canJoin(nextLesson) && (
                                                <button disabled={joinBusyId === nextLesson.id} onClick={() => handleJoin(nextLesson)}
                                                    className="flex-1 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50">
                                                    <Video className="w-3.5 h-3.5" />
                                                    {joinBusyId === nextLesson.id ? '…' : 'Join'}
                                                </button>
                                            )}
                                            <button onClick={() => navigate(`/student/sessions/${nextLesson.id}`)}
                                                className="flex-1 border border-gray-200 hover:border-purple-300 text-gray-700 text-xs font-semibold py-2 rounded-xl transition-colors">
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payment due */}
                        {paymentDue && (
                            <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-amber-200 bg-amber-100/60 flex items-center gap-2">
                                    <CreditCard className="w-3.5 h-3.5 text-amber-700" />
                                    <h3 className="text-sm font-semibold text-amber-800">Payment Due</h3>
                                </div>
                                <div className="p-4">
                                    <p className="text-xs text-amber-700 mb-1">Session with <strong>{paymentDue.tutor?.username || 'your mentor'}</strong></p>
                                    <p className="text-xs text-amber-600 mb-3">
                                        {fmt(paymentDue.start_time, { weekday: 'short', month: 'short', day: 'numeric' })} · {fmtTime(paymentDue.start_time)}
                                    </p>
                                    <button onClick={handlePayNext} disabled={payBusy}
                                        className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60">
                                        {payBusy ? 'Redirecting…' : 'Pay Now'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* My Mentors */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5 text-gray-400" /> My Mentors
                                </h3>
                                <button onClick={() => navigate('/student/my-mentors')}
                                    className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors">
                                    View all
                                </button>
                            </div>
                            <div className="p-3">
                                {mentors.length === 0 ? (
                                    <div className="text-center py-2">
                                        <p className="text-xs text-gray-400 mb-2">No mentors yet.</p>
                                        <button onClick={() => navigate('/student/mentors')}
                                            className="text-xs font-semibold text-purple-700 hover:text-purple-900 transition-colors">
                                            Find a mentor →
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {mentors.slice(0, 4).map(m => (
                                            <div key={m.tutor.id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors group">
                                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold shrink-0 overflow-hidden">
                                                    {m.tutor.profile_photo
                                                        ? <img src={m.tutor.profile_photo} alt={m.tutor.username} className="w-full h-full object-cover" />
                                                        : m.tutor.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-gray-800 truncate">{m.tutor.username}</p>
                                                    {m.nextSessionStart && (
                                                        <p className="text-[10px] text-gray-400">
                                                            Next: {new Date(m.nextSessionStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </p>
                                                    )}
                                                </div>
                                                <button onClick={() => navigate('/student/sessions')}
                                                    className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-purple-600 transition-opacity">
                                                    Sessions →
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Upcoming sessions list */}
                        {upcomingSessions.length > 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                                    <h3 className="text-sm font-semibold text-gray-900">Upcoming Sessions</h3>
                                    <button onClick={() => navigate('/student/sessions')}
                                        className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors">
                                        View all
                                    </button>
                                </div>
                                <div className="p-3 space-y-1">
                                    {upcomingSessions.slice(0, 3).map(l => (
                                        <button key={l.id} onClick={() => navigate(`/student/sessions/${l.id}`)}
                                            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left group">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-gray-800 truncate">{l.tutor?.username || 'Mentor'}</p>
                                                <p className="text-[10px] text-gray-400">
                                                    {fmt(l.start_time, { month: 'short', day: 'numeric' })} · {fmtTime(l.start_time)}
                                                </p>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-purple-500 transition-colors shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick links */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Quick Links</h3>
                            <div className="space-y-1">
                                {[
                                    { label: 'My Sessions', path: '/student/sessions', icon: Calendar },
                                    { label: 'My Mentors', path: '/student/my-mentors', icon: Users },
                                    { label: 'My Courses', path: '/student/my-courses', icon: BookOpen },
                                    { label: 'Find a Mentor', path: '/student/mentors', icon: ArrowRight },
                                ].map(({ label, path, icon: Icon }) => (
                                    <button key={path} onClick={() => navigate(path)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-600 hover:text-purple-700 hover:bg-purple-50/60 transition-colors text-left">
                                        <Icon className="w-4 h-4 shrink-0" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Modal isOpen={errorModalOpen} onClose={() => setErrorModalOpen(false)} title="Error">
                <p className="text-sm text-gray-700">{payError}</p>
            </Modal>
        </DashboardLayout>
    );
};

export default StudentDashboard;
