import React, { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../components/ui/Button';
import {
    ChevronLeft, ChevronRight,
    CheckCircle2, Circle, ArrowRight, Zap,
    FileText, BookOpen, Upload, CreditCard, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({
    label, value, accent, wide, subtext, onClick,
}: {
    label: string; value: string | number; accent: string;
    wide?: boolean; subtext?: string; onClick?: () => void;
}) => (
    <div
        onClick={onClick}
        className={`relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1 overflow-hidden
            ${wide ? 'col-span-2 sm:col-span-1' : ''}
            ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
        <div className={`absolute left-0 inset-y-0 w-1 rounded-l-2xl ${accent}`} />
        <span className="text-xs font-medium text-gray-500 pl-1">{label}</span>
        <span className="text-3xl font-bold text-gray-900 pl-1">{value}</span>
        {subtext && <span className="text-xs text-amber-600 font-medium pl-1 flex items-center gap-1"><ArrowRight className="w-3 h-3" />{subtext}</span>}
    </div>
);

// ─── Profile Progress Ring ────────────────────────────────────────────────────
const ProgressRing = ({ pct }: { pct: number }) => {
    const r = 20; const circ = 2 * Math.PI * r;
    const filled = ((100 - pct) / 100) * circ;
    const color = pct === 100 ? '#16a34a' : '#f59e0b';
    return (
        <svg width="52" height="52" className="-rotate-90">
            <circle cx="26" cy="26" r={r} fill="none" stroke="#f3f4f6" strokeWidth="4" />
            <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4"
                strokeDasharray={circ} strokeDashoffset={filled} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
        </svg>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const TutorDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [availabilitySlots, setAvailabilitySlots] = useState<Array<{ start: string; end: string }>>([]);
    const [calendarBusy, setCalendarBusy] = useState(false);
    const [lessonsBusy, setLessonsBusy] = useState(false);
    const [lessons, setLessons] = useState<Array<{
        id: string; start_time: string; end_time: string; status: string;
        billing_type?: 'FREE_TRIAL' | 'FREE_INTRO' | 'PAID';
        payment_status?: 'paid' | 'pending' | 'failed' | 'not_required' | 'unknown';
        meeting_link?: string | null; google_calendar_html_link?: string | null;
        student?: { username?: string | null };
    }>>([]);
    const [statsLessons, setStatsLessons] = useState<Array<{
        id: string; start_time: string; end_time: string; status: string;
        payment_status?: 'paid' | 'pending' | 'failed' | 'not_required' | 'unknown';
    }>>([]);
    const [statsLessonsBusy, setStatsLessonsBusy] = useState(true);
    const [blocksBusy, setBlocksBusy] = useState(false);
    const [timeBlocks, setTimeBlocks] = useState<Array<{ id: string; start_time: string; end_time: string; reason?: string | null }>>([]);
    const [studentsBusy, setStudentsBusy] = useState(false);
    const [students, setStudents] = useState<Array<{ nextSessionStart: string | null }>>([]);
    const [activityBusy, setActivityBusy] = useState(false);
    const [activityItems, setActivityItems] = useState<Array<{ type: 'NOTE' | 'TASK' | 'SUBMISSION'; created_at: string; data: any }>>([]);

    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
        const now = new Date(); const day = now.getDay();
        const diff = (day + 6) % 7; const start = new Date(now);
        start.setDate(now.getDate() - diff); start.setHours(0, 0, 0, 0); return start;
    });
    const [monthCursor, setMonthCursor] = useState<Date>(() => {
        const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
    });

    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [editingBlock, setEditingBlock] = useState<{ id: string; start: string; end: string; reason: string } | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectDayIdx, setSelectDayIdx] = useState<number | null>(null);
    const [selectStartMin, setSelectStartMin] = useState<number | null>(null);
    const [selectEndMin, setSelectEndMin] = useState<number | null>(null);

    const [checklist, setChecklist] = useState({
        photo: false, tagline: false, about: false, country: false,
        strengths: false, pricing: false, services: false,
    });

    const toDateTimeLocalValue = (iso: string) => {
        const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    // ─── Data fetching ──────────────────────────────────────────────────────────
    useEffect(() => {
        api.get('/tutor/me').then(res => {
            setProfile(res.data);
            setChecklist({
                photo: !!res.data.profile_photo, tagline: !!res.data.tagline,
                about: !!res.data.about, country: !!res.data.country,
                strengths: !!res.data.key_strengths, pricing: !!res.data.hourly_rate,
                services: res.data.categories?.length > 0,
            });
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        setStudentsBusy(true);
        api.get('/tutor/me/students')
            .then(res => setStudents(Array.isArray(res.data?.students) ? res.data.students : []))
            .catch(() => setStudents([]))
            .finally(() => setStudentsBusy(false));
    }, []);

    useEffect(() => {
        if (!profile?.id) return;
        setStatsLessonsBusy(true);
        const from = new Date(); from.setFullYear(from.getFullYear() - 3); from.setHours(0, 0, 0, 0);
        const to = new Date(); to.setFullYear(to.getFullYear() + 2); to.setHours(23, 59, 59, 999);
        api.get('/lessons/me', { params: { from: from.toISOString(), to: to.toISOString() } })
            .then(res => setStatsLessons(res.data?.lessons || []))
            .catch(() => setStatsLessons([]))
            .finally(() => setStatsLessonsBusy(false));
    }, [profile?.id]);

    useEffect(() => {
        setActivityBusy(true);
        api.get('/progress/tutor/activity', { params: { limit: 10 } })
            .then(res => setActivityItems(res.data?.items || []))
            .catch(() => setActivityItems([]))
            .finally(() => setActivityBusy(false));
    }, []);

    const weekStartMs = weekStartDate.getTime();
    const monthCursorMs = monthCursor.getTime();

    const refreshCalendarData = useCallback(async () => {
        if (!profile?.id) return;
        const from = viewMode === 'week' ? new Date(weekStartDate) : new Date(monthCursor);
        const to = new Date(from);
        if (viewMode === 'week') to.setDate(from.getDate() + 7);
        else to.setMonth(from.getMonth() + 1);

        setLessonsBusy(true); setBlocksBusy(true);
        if (viewMode === 'week') setCalendarBusy(true);

        const [lessonsRes, blocksRes, availabilityRes] = await Promise.all([
            api.get('/lessons/me', { params: { from: from.toISOString(), to: to.toISOString() } }),
            api.get('/scheduling/me/blocks', { params: { from: from.toISOString(), to: to.toISOString() } }),
            viewMode === 'week'
                ? api.get(`/availability/tutor/${profile.id}/slots`, { params: { from: from.toISOString(), to: to.toISOString(), durationMinutes: 60, stepMinutes: 60 } })
                : Promise.resolve({ data: { slots: [] } } as any),
        ]).catch(() => [{ data: { lessons: [] } }, { data: { blocks: [] } }, { data: { slots: [] } }]);

        setLessons((lessonsRes as any).data?.lessons || []);
        setTimeBlocks((blocksRes as any).data?.blocks || []);
        setAvailabilitySlots((availabilityRes as any).data?.slots || []);
        setLessonsBusy(false); setBlocksBusy(false); setCalendarBusy(false);
    }, [profile?.id, viewMode, weekStartMs, monthCursorMs]);

    useEffect(() => { refreshCalendarData(); }, [refreshCalendarData]);

    const handleConnectGoogleCalendar = async () => {
        try {
            const res = await api.get('/google-calendar/connect');
            if (res.data?.authUrl) window.location.href = res.data.authUrl;
        } catch (e) { console.error(e); }
    };

    const handleDisconnectGoogleCalendar = async () => {
        try {
            await api.post('/google-calendar/disconnect');
            const res = await api.get('/tutor/me'); setProfile(res.data);
        } catch (e) { console.error(e); }
    };

    // ─── Computed values ────────────────────────────────────────────────────────
    const completedCount = Object.values(checklist).filter(Boolean).length;
    const totalCount = Object.keys(checklist).length;
    const completionPct = Math.round((completedCount / totalCount) * 100);

    const checklistItems = [
        { label: 'Upload a profile photo', done: checklist.photo, link: '/tutor-onboarding?section=bio', icon: Upload },
        { label: 'Add a tagline', done: checklist.tagline, link: '/tutor-onboarding?section=bio', icon: FileText },
        { label: 'Add a bio/about section', done: checklist.about, link: '/tutor-onboarding?section=bio', icon: FileText },
        { label: 'Add your country', done: checklist.country, link: '/tutor-onboarding?section=bio', icon: FileText },
        { label: 'Add key strengths', done: checklist.strengths, link: '/tutor-onboarding?section=education', icon: Zap },
        { label: 'Select your services', done: checklist.services, link: '/tutor-onboarding?section=services', icon: BookOpen },
        { label: 'Set your lesson pricing', done: checklist.pricing, link: '/tutor-onboarding?section=pricing', icon: CreditCard },
    ];

    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.nextSessionStart != null && String(s.nextSessionStart).trim() !== '').length;
    const totalSessions = statsLessons.filter(l => String(l.status || '').toUpperCase() !== 'CANCELLED').length;
    const pendingSessions = (() => {
        const nowMs = Date.now();
        return statsLessons.filter(l => {
            const st = String(l.status || '').toUpperCase();
            if (st === 'CANCELLED' || st === 'COMPLETED' || st === 'MISSED') return false;
            if (new Date(l.start_time).getTime() <= nowMs) return false;
            if (st === 'PENDING') return true;
            return l.payment_status === 'pending' || l.payment_status === 'failed';
        }).length;
    })();

    const subscriptionDaysLeft = (() => {
        if (!profile?.subscription_end_date) return null;
        const diff = new Date(profile.subscription_end_date).getTime() - Date.now();
        return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
    })();

    const nextLesson = (() => {
        const nowMs = Date.now();
        return [...lessons]
            .filter(l => {
                const st = String(l.status || '').toUpperCase();
                return st !== 'CANCELLED' && st !== 'COMPLETED' && st !== 'MISSED' && new Date(l.start_time).getTime() > nowMs;
            })
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0] || null;
    })();

    // ─── Calendar helpers ───────────────────────────────────────────────────────
    const startHour = 6; const endHour = 22; const hourHeightPx = 48;
    const minutesToPx = (m: number) => (m / 60) * hourHeightPx;
    const weekDays = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(weekStartDate); d.setDate(weekStartDate.getDate() + i); return d;
    });
    const dayIndexFor = (d: Date) => Math.floor((d.getTime() - weekStartDate.getTime()) / (24 * 60 * 60 * 1000));

    const slotBlocks = availabilitySlots.map(s => ({ start: new Date(s.start), end: new Date(s.end), idx: dayIndexFor(new Date(s.start)) })).filter(x => x.idx >= 0 && x.idx < 7);
    const lessonBlocks = lessons.map(l => ({ ...l, start: new Date(l.start_time), end: new Date(l.end_time), idx: dayIndexFor(new Date(l.start_time)) })).filter(x => x.idx >= 0 && x.idx < 7);
    const blockedBlocks = timeBlocks.map(b => ({ ...b, start: new Date(b.start_time), end: new Date(b.end_time), idx: dayIndexFor(new Date(b.start_time)) })).filter(x => x.idx >= 0 && x.idx < 7);

    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    const roundTo = (v: number, step: number) => Math.round(v / step) * step;
    const pointerToMinuteOfDay = (clientY: number, container: HTMLDivElement | null) => {
        if (!container) return null;
        const rect = container.getBoundingClientRect();
        const minuteOfDay = startHour * 60 + ((clientY - rect.top) / hourHeightPx) * 60;
        return clamp(Math.floor(roundTo(minuteOfDay, 15)), startHour * 60, endHour * 60);
    };
    const minuteToDateForDay = (dayIdx: number, minuteOfDay: number) => {
        const d = new Date(weekDays[dayIdx]);
        d.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0); return d;
    };

    const selectionOverlay = (() => {
        if (!isSelecting || selectDayIdx === null || selectStartMin === null || selectEndMin === null) return null;
        const startMinutes = Math.min(selectStartMin, selectEndMin) - startHour * 60;
        const endMinutes = Math.max(selectStartMin, selectEndMin) - startHour * 60;
        return { top: minutesToPx(startMinutes), height: Math.max(12, minutesToPx(endMinutes - startMinutes)) };
    })();

    const createBlockFromSelection = useCallback(async () => {
        if (selectDayIdx === null || selectStartMin === null || selectEndMin === null) return;
        const startMin = Math.min(selectStartMin, selectEndMin);
        let endMin = Math.max(selectStartMin, selectEndMin);
        if (endMin === startMin) endMin = clamp(startMin + 60, startHour * 60, endHour * 60);
        await api.post('/scheduling/me/blocks', {
            start_time: minuteToDateForDay(selectDayIdx, startMin).toISOString(),
            end_time: minuteToDateForDay(selectDayIdx, endMin).toISOString(),
            reason: 'Blocked',
        }).catch(console.error);
        await refreshCalendarData();
    }, [selectDayIdx, selectStartMin, selectEndMin, refreshCalendarData]);

    useEffect(() => {
        const onMouseUp = async () => {
            if (!isSelecting) return;
            setIsSelecting(false);
            await createBlockFromSelection();
            setSelectDayIdx(null); setSelectStartMin(null); setSelectEndMin(null);
        };
        window.addEventListener('mouseup', onMouseUp);
        return () => window.removeEventListener('mouseup', onMouseUp);
    }, [isSelecting, createBlockFromSelection]);

    const openEditBlock = (b: { id: string; start_time: string; end_time: string; reason?: string | null }) => {
        setEditingBlock({ id: b.id, start: toDateTimeLocalValue(b.start_time), end: toDateTimeLocalValue(b.end_time), reason: b.reason || '' });
        setIsBlockModalOpen(true);
    };
    const saveBlockEdits = async () => {
        if (!editingBlock) return;
        await api.put(`/scheduling/me/blocks/${editingBlock.id}`, {
            start_time: new Date(editingBlock.start).toISOString(),
            end_time: new Date(editingBlock.end).toISOString(),
            reason: editingBlock.reason || undefined,
        }).catch(console.error);
        setIsBlockModalOpen(false); setEditingBlock(null); await refreshCalendarData();
    };
    const deleteEditingBlock = async () => {
        if (!editingBlock) return;
        await api.delete(`/scheduling/me/blocks/${editingBlock.id}`).catch(console.error);
        setIsBlockModalOpen(false); setEditingBlock(null); await refreshCalendarData();
    };

    // Month view helpers
    const monthGrid = (() => {
        const first = new Date(monthCursor);
        const gridStart = new Date(first);
        gridStart.setDate(first.getDate() - first.getDay());
        gridStart.setHours(0, 0, 0, 0);
        return Array.from({ length: 42 }).map((_, i) => {
            const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d;
        });
    })();
    const blocksByDayKey = new Map<string, number>();
    for (const b of timeBlocks) {
        const d = new Date(b.start_time);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        blocksByDayKey.set(key, (blocksByDayKey.get(key) || 0) + 1);
    }
    const lessonsByDayKey = new Map<string, { total: number; free: number; paid: number }>();
    for (const l of lessons) {
        const d = new Date(l.start_time);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const cur = lessonsByDayKey.get(key) || { total: 0, free: 0, paid: 0 };
        cur.total += 1;
        if (l.billing_type === 'FREE_INTRO' || l.billing_type === 'FREE_TRIAL') cur.free += 1;
        else cur.paid += 1;
        lessonsByDayKey.set(key, cur);
    }
    const setWeekFromDate = (d: Date) => {
        const diff = (d.getDay() + 6) % 7;
        const start = new Date(d); start.setDate(d.getDate() - diff); start.setHours(0, 0, 0, 0);
        setWeekStartDate(start);
    };

    const weekLabel = `${weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    const monthLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    if (loading) return (
        <DashboardLayout>
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
            </div>
        </DashboardLayout>
    );

    const hour12 = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

    return (
        <DashboardLayout>
            <div className="space-y-6">

                {/* ── Header strip ─────────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.username?.split(' ')[0] || 'Mentor'} 👋
                        </h1>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs font-semibold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full">
                                {profile?.tier || 'STANDARD'}
                            </span>
                            {profile?.subscription_status === 'trialing' && (
                                <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full">Free trial</span>
                            )}
                            {profile?.is_founding_mentor && (
                                <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">⭐ Founding Mentor</span>
                            )}
                            {subscriptionDaysLeft !== null && subscriptionDaysLeft <= 14 && (
                                <span className="text-xs font-medium bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full">
                                    {subscriptionDaysLeft}d left
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => navigate('/tutor-onboarding')}>
                            {completionPct === 100 ? 'Edit Profile' : 'Complete Profile'}
                        </Button>
                        <Button size="sm" onClick={() => navigate('/profile/preview')}>
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />View Profile
                        </Button>
                    </div>
                </div>

                {/* ── Stats row ────────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Total Students" value={studentsBusy ? '…' : totalStudents} accent="bg-purple-500" />
                    <StatCard label="Active Students" value={studentsBusy ? '…' : activeStudents} accent="bg-blue-500" />
                    <StatCard label="Total Sessions" value={statsLessonsBusy ? '…' : totalSessions} accent="bg-green-500" />
                    <StatCard
                        label="Pending Sessions"
                        value={statsLessonsBusy ? '…' : pendingSessions}
                        accent="bg-amber-500"
                        subtext={!statsLessonsBusy && pendingSessions > 0 ? 'View sessions' : undefined}
                        onClick={!statsLessonsBusy && pendingSessions > 0 ? () => navigate('/sessions') : undefined}
                    />
                </div>

                {/* ── Main content ──────────────────────────────────────────────── */}
                <div className="flex flex-col lg:flex-row gap-6">

                    {/* Left: Calendar */}
                    <div className="flex-1 space-y-6 min-w-0">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Calendar header */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
                                <div>
                                    <h2 className="text-base font-semibold text-gray-900">Calendar & Availability</h2>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {profile?.google_calendar_connection?.sync_enabled
                                            ? 'Google Calendar synced — busy times auto-blocked.'
                                            : 'Drag on the grid below to block time. Connect Google to auto-sync.'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {profile?.google_calendar_connection?.sync_enabled ? (
                                        <Button size="sm" variant="outline" onClick={handleDisconnectGoogleCalendar}>Disconnect</Button>
                                    ) : (
                                        <Button size="sm" variant="outline" onClick={handleConnectGoogleCalendar} className="inline-flex items-center gap-1.5">
                                            <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="" className="w-3.5 h-3.5" />
                                            Connect Google
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* View toggle + nav */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3 bg-gray-50/60 border-b border-gray-100">
                                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
                                    {(['week', 'month'] as const).map(v => (
                                        <button key={v} onClick={() => setViewMode(v)}
                                            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                            {v.charAt(0).toUpperCase() + v.slice(1)}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button onClick={() => {
                                        if (viewMode === 'week') { const d = new Date(weekStartDate); d.setDate(d.getDate() - 7); setWeekStartDate(d); }
                                        else { const d = new Date(monthCursor); d.setMonth(d.getMonth() - 1); d.setDate(1); setMonthCursor(d); }
                                    }} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                                        <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                                    </button>
                                    <span className="text-sm font-semibold text-gray-900 min-w-[150px] text-center">
                                        {viewMode === 'week' ? weekLabel : monthLabel}
                                    </span>
                                    <button onClick={() => {
                                        if (viewMode === 'week') { const d = new Date(weekStartDate); d.setDate(d.getDate() + 7); setWeekStartDate(d); }
                                        else { const d = new Date(monthCursor); d.setMonth(d.getMonth() + 1); d.setDate(1); setMonthCursor(d); }
                                    }} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                                        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                                    </button>
                                </div>
                            </div>

                            {/* Calendar grid */}
                            {(calendarBusy || lessonsBusy || blocksBusy) ? (
                                <div className="flex items-center justify-center h-48 text-sm text-gray-400">Loading calendar…</div>
                            ) : viewMode === 'month' ? (
                                <>
                                    <div className="grid grid-cols-7 border-b border-gray-100">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                            <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{d}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7">
                                        {monthGrid.map((d, i) => {
                                            const inMonth = d.getMonth() === monthCursor.getMonth();
                                            const isToday = d.toDateString() === new Date().toDateString();
                                            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                                            const blockCount = blocksByDayKey.get(key) || 0;
                                            const lessonInfo = lessonsByDayKey.get(key) || { total: 0, free: 0, paid: 0 };
                                            return (
                                                <button key={i} onClick={() => { setWeekFromDate(d); setViewMode('week'); }}
                                                    className={`border-r border-b border-gray-50 p-2 text-left h-20 transition-colors
                                                        ${inMonth ? 'bg-white hover:bg-purple-50/50' : 'bg-gray-50/50'}
                                                        ${isToday ? 'ring-2 ring-inset ring-purple-300' : ''}`}>
                                                    <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-purple-700' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}>
                                                        {d.getDate()}
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        {lessonInfo.total > 0 && (
                                                            <div className="text-[10px] bg-purple-100 text-purple-800 rounded px-1.5 py-0.5 inline-block font-medium">
                                                                {lessonInfo.total} session{lessonInfo.total > 1 ? 's' : ''}
                                                            </div>
                                                        )}
                                                        {blockCount > 0 && (
                                                            <div className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 inline-block">
                                                                {blockCount} blocked
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: '64px repeat(7, minmax(0, 1fr))' }}>
                                        <div className="bg-gray-50/60" />
                                        {weekDays.map((d, idx) => {
                                            const isToday = d.toDateString() === new Date().toDateString();
                                            return (
                                                <div key={idx} className={`py-2.5 px-2 text-center border-l border-gray-100 ${isToday ? 'bg-purple-50' : 'bg-gray-50/60'}`}>
                                                    <div className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? 'text-purple-700' : 'text-gray-400'}`}>
                                                        {d.toLocaleDateString(undefined, { weekday: 'short' })}
                                                    </div>
                                                    <div className={`text-sm font-bold mt-0.5 ${isToday ? 'text-purple-700' : 'text-gray-700'}`}>
                                                        {d.getDate()}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="grid overflow-y-auto" style={{ gridTemplateColumns: '64px repeat(7, minmax(0, 1fr))', maxHeight: 520 }}>
                                        {/* Hour labels */}
                                        <div className="border-r border-gray-100">
                                            {Array.from({ length: endHour - startHour }).map((_, i) => {
                                                const hour = startHour + i;
                                                const label = new Date(new Date().setHours(hour, 0, 0, 0)).toLocaleTimeString(undefined, { hour: 'numeric', hour12: true });
                                                return (
                                                    <div key={hour} className="h-12 border-b border-gray-50 pr-2 flex items-start justify-end">
                                                        <span className="text-[10px] text-gray-400 mt-1">{label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {weekDays.map((_, dayIdx) => (
                                            <div key={dayIdx} className="relative border-l border-gray-100 select-none"
                                                style={{ height: (endHour - startHour) * hourHeightPx }}
                                                onMouseDown={e => {
                                                    const minute = pointerToMinuteOfDay(e.clientY, e.currentTarget);
                                                    if (minute === null) return;
                                                    setIsSelecting(true); setSelectDayIdx(dayIdx);
                                                    setSelectStartMin(minute); setSelectEndMin(minute);
                                                }}
                                                onMouseMove={e => {
                                                    if (!isSelecting || selectDayIdx !== dayIdx) return;
                                                    const minute = pointerToMinuteOfDay(e.clientY, e.currentTarget);
                                                    if (minute !== null) setSelectEndMin(minute);
                                                }}>
                                                {Array.from({ length: endHour - startHour }).map((__, i) => (
                                                    <div key={i} className="h-12 border-b border-gray-50" />
                                                ))}

                                                {selectionOverlay && selectDayIdx === dayIdx && (
                                                    <div className="absolute left-0.5 right-0.5 rounded-md bg-purple-100/70 border border-purple-300 pointer-events-none"
                                                        style={{ top: selectionOverlay.top, height: selectionOverlay.height }} />
                                                )}

                                                {slotBlocks.filter(s => s.idx === dayIdx).map((s, i) => {
                                                    const sm = (s.start.getHours() - startHour) * 60 + s.start.getMinutes();
                                                    const em = (s.end.getHours() - startHour) * 60 + s.end.getMinutes();
                                                    if (sm < 0 || em > (endHour - startHour) * 60) return null;
                                                    return (
                                                        <div key={`slot-${i}`} className="absolute left-0.5 right-0.5 rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] text-emerald-700 font-medium"
                                                            style={{ top: minutesToPx(sm), height: Math.max(10, minutesToPx(em - sm)) }}>
                                                            Available
                                                        </div>
                                                    );
                                                })}

                                                {blockedBlocks.filter(b => b.idx === dayIdx).map(b => {
                                                    const sm = (b.start.getHours() - startHour) * 60 + b.start.getMinutes();
                                                    const em = (b.end.getHours() - startHour) * 60 + b.end.getMinutes();
                                                    if (sm < 0 || em > (endHour - startHour) * 60) return null;
                                                    return (
                                                        <div key={b.id} className="absolute left-0.5 right-0.5 rounded-md bg-gray-100 border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors"
                                                            style={{ top: minutesToPx(sm), height: Math.max(12, minutesToPx(em - sm)) }}
                                                            onMouseDown={e => e.stopPropagation()}
                                                            onClick={e => { e.stopPropagation(); openEditBlock({ id: b.id, start_time: b.start_time, end_time: b.end_time, reason: b.reason }); }}>
                                                            <div className="font-semibold truncate">Blocked</div>
                                                            {b.reason && <div className="truncate opacity-70">{b.reason}</div>}
                                                        </div>
                                                    );
                                                })}

                                                {lessonBlocks.filter(l => l.idx === dayIdx).map(l => {
                                                    const sm = (l.start.getHours() - startHour) * 60 + l.start.getMinutes();
                                                    const em = (l.end.getHours() - startHour) * 60 + l.end.getMinutes();
                                                    if (sm < 0 || em > (endHour - startHour) * 60) return null;
                                                    const isFree = l.billing_type === 'FREE_INTRO';
                                                    const isPending = l.status === 'PENDING' || l.status === 'BOOKED' || l.billing_type === 'FREE_TRIAL';
                                                    const blockCls = isFree
                                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                                        : isPending
                                                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                                                            : 'bg-purple-50 border-purple-300 text-purple-900';
                                                    return (
                                                        <div key={l.id} className={`absolute left-0.5 right-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${blockCls}`}
                                                            style={{ top: minutesToPx(sm), height: Math.max(12, minutesToPx(em - sm)) }}
                                                            onMouseDown={e => e.stopPropagation()}>
                                                            <div className="font-semibold truncate">{l.student?.username || 'Student'}</div>
                                                            <div className="truncate opacity-70">{isFree ? 'Free intro' : isPending ? 'Pending' : 'Paid'}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {viewMode === 'week' && !calendarBusy && !lessonsBusy && !blocksBusy
                                && availabilitySlots.length === 0 && lessonBlocks.length === 0 && blockedBlocks.length === 0 && (
                                    <div className="text-sm text-gray-400 text-center py-6">
                                        No slots or sessions this week. Add weekly availability in your profile.
                                    </div>
                                )}
                        </div>

                        {/* Activity feed */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-base font-semibold text-gray-900">Recent Notes & Homework</h2>
                                <button onClick={() => navigate('/tutor/notes')} className="text-xs font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-colors">
                                    View all <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                            {activityBusy ? (
                                <div className="text-sm text-gray-400">Loading…</div>
                            ) : activityItems.length === 0 ? (
                                <div className="text-sm text-gray-400">No recent activity yet.</div>
                            ) : (
                                <div className="space-y-2">
                                    {activityItems.slice(0, 5).map(it => {
                                        const typeColors: Record<string, string> = {
                                            NOTE: 'bg-blue-50 text-blue-700',
                                            TASK: 'bg-amber-50 text-amber-700',
                                            SUBMISSION: 'bg-emerald-50 text-emerald-700',
                                        };
                                        return (
                                            <div key={`${it.type}:${it.data?.id || it.created_at}`}
                                                className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${typeColors[it.type] || 'bg-gray-100 text-gray-600'}`}>
                                                    {it.type === 'NOTE' ? 'Note' : it.type === 'TASK' ? 'HW' : 'Sub'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-semibold text-gray-700 truncate">
                                                            {it.data?.student?.username || it.data?.title || 'Activity'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 shrink-0">
                                                            {new Date(it.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                                        {it.type === 'NOTE' ? it.data?.body : it.type === 'TASK' ? it.data?.title : it.data?.task?.title || 'Submission'}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
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
                                    <p className="text-sm text-gray-400">No upcoming sessions scheduled.</p>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-base font-bold text-gray-900">{nextLesson.student?.username || 'Student'}</p>
                                            <p className="text-sm text-gray-500 mt-0.5">
                                                {new Date(nextLesson.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </p>
                                            <p className="text-sm font-semibold text-purple-700 mt-0.5">
                                                {hour12(new Date(nextLesson.start_time))} — {hour12(new Date(nextLesson.end_time))}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {nextLesson.meeting_link && (() => {
                                                const startMs = new Date(nextLesson.start_time).getTime();
                                                const canJoin = Date.now() >= startMs - 15 * 60 * 1000 && Date.now() <= startMs + 50 * 60 * 1000;
                                                return canJoin ? (
                                                    <button onClick={() => window.open(nextLesson.meeting_link!, '_blank')}
                                                        className="flex-1 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold py-2 rounded-xl transition-colors">
                                                        Join Session
                                                    </button>
                                                ) : null;
                                            })()}
                                            <button onClick={() => navigate(`/sessions/${nextLesson.id}`)}
                                                className="flex-1 border border-gray-200 hover:border-purple-300 text-gray-700 text-xs font-semibold py-2 rounded-xl transition-colors">
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Profile status */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-900">Profile Status</h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${completionPct === 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {completionPct === 100 ? 'Live ✓' : 'Incomplete'}
                                </span>
                            </div>
                            <div className="p-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <ProgressRing pct={completionPct} />
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{completionPct}%</p>
                                        <p className="text-xs text-gray-500">{completedCount}/{totalCount} complete</p>
                                    </div>
                                </div>
                                <ul className="space-y-1.5 mb-4">
                                    {checklistItems.map((item, idx) => (
                                        <li key={idx}>
                                            {item.done ? (
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                                    <span className="line-through">{item.label}</span>
                                                </div>
                                            ) : (
                                                <button onClick={() => navigate(item.link)}
                                                    className="flex items-center gap-2 text-xs text-amber-700 hover:text-amber-900 w-full text-left group transition-colors">
                                                    <Circle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                    <span className="group-hover:underline">{item.label}</span>
                                                    <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                <Button size="sm" className="w-full" variant={completionPct === 100 ? 'outline' : 'primary'} onClick={() => navigate('/tutor-onboarding')}>
                                    {completionPct === 100 ? 'Edit Profile' : 'Complete Profile'}
                                </Button>
                            </div>
                        </div>

                        {/* Subscription */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                                <h3 className="text-sm font-semibold text-gray-900">Subscription</h3>
                            </div>
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-base font-bold text-gray-900">{profile?.tier || 'STANDARD'}</span>
                                    {profile?.subscription_status === 'trialing' && (
                                        <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Trial</span>
                                    )}
                                </div>
                                {subscriptionDaysLeft !== null && (
                                    <p className={`text-xs font-medium mb-3 ${subscriptionDaysLeft <= 7 ? 'text-red-600' : subscriptionDaysLeft <= 14 ? 'text-amber-600' : 'text-gray-500'}`}>
                                        {subscriptionDaysLeft === 0 ? 'Expired' : `${subscriptionDaysLeft} days remaining`}
                                    </p>
                                )}
                                <button onClick={() => navigate('/subscription-settings')}
                                    className="w-full text-xs font-semibold text-purple-700 hover:text-purple-900 border border-purple-200 hover:border-purple-400 py-2 rounded-xl transition-colors">
                                    Manage subscription
                                </button>
                            </div>
                        </div>

                        {/* Help */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">Need help?</h3>
                            <p className="text-xs text-gray-400 mb-3">Our support team is here for you.</p>
                            <button onClick={() => navigate('/help')}
                                className="w-full text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-300 py-2 rounded-xl transition-colors">
                                Help & Support
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit block modal */}
            <Modal isOpen={isBlockModalOpen} onClose={() => { setIsBlockModalOpen(false); setEditingBlock(null); }} title="Edit Blocked Time">
                {editingBlock && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Start</label>
                            <Input type="datetime-local" value={editingBlock.start}
                                onChange={e => setEditingBlock(prev => prev ? ({ ...prev, start: e.target.value }) : prev)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">End</label>
                            <Input type="datetime-local" value={editingBlock.end}
                                onChange={e => setEditingBlock(prev => prev ? ({ ...prev, end: e.target.value }) : prev)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
                            <Input value={editingBlock.reason}
                                onChange={e => setEditingBlock(prev => prev ? ({ ...prev, reason: e.target.value }) : prev)} />
                        </div>
                        <div className="flex justify-end gap-3 pt-1">
                            <Button variant="outline" onClick={deleteEditingBlock}>Delete Block</Button>
                            <Button onClick={saveBlockEdits}>Save Changes</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </DashboardLayout>
    );
};

export default TutorDashboard;
