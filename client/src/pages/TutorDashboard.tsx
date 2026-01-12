import React, { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Users, Clock, Calendar, AlertCircle, CreditCard, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

const StatsCard = ({ icon, label, value, subLabel }: { icon: React.ReactNode, label: string, value: string | number, subLabel?: string }) => (
    <Card className="p-6 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-3">
            {icon}
        </div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
        {subLabel && <p className="text-xs text-gray-400 mt-1">{subLabel}</p>}
    </Card>
);

const TutorDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [calendarBusy, setCalendarBusy] = useState(false);
    const [availabilitySlots, setAvailabilitySlots] = useState<Array<{ start: string; end: string }>>([]);
    const [lessonsBusy, setLessonsBusy] = useState(false);
    const [lessons, setLessons] = useState<Array<{ id: string; start_time: string; end_time: string; status: string; meeting_link?: string | null; google_calendar_html_link?: string | null; student?: { username?: string | null } }>>([]);
    const [blocksBusy, setBlocksBusy] = useState(false);
    const [timeBlocks, setTimeBlocks] = useState<Array<{ id: string; start_time: string; end_time: string; reason?: string | null }>>([]);

    const [studentsBusy, setStudentsBusy] = useState(false);
    const [studentsCount, setStudentsCount] = useState(0);

    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
        const now = new Date();
        const day = now.getDay();
        const diffToMonday = (day + 6) % 7;
        const start = new Date(now);
        start.setDate(now.getDate() - diffToMonday);
        start.setHours(0, 0, 0, 0);
        return start;
    });
    const [monthCursor, setMonthCursor] = useState<Date>(() => {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    });

    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [editingBlock, setEditingBlock] = useState<{ id: string; start: string; end: string; reason: string } | null>(null);

    const [isSelecting, setIsSelecting] = useState(false);
    const [selectDayIdx, setSelectDayIdx] = useState<number | null>(null);
    const [selectStartMin, setSelectStartMin] = useState<number | null>(null);
    const [selectEndMin, setSelectEndMin] = useState<number | null>(null);

    const toDateTimeLocalValue = (iso: string) => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    // Checklist State
    const [checklist, setChecklist] = useState({
        photo: false,
        tagline: false,
        about: false,
        country: false,
        strengths: false,
        pricing: false,
        services: false
    });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/tutor/me');
                setProfile(res.data);

                // Calculate Checklist
                const newChecklist = {
                    photo: !!res.data.profile_photo,
                    tagline: !!res.data.tagline,
                    about: !!res.data.about,
                    country: !!res.data.country,
                    education: res.data.education && res.data.education.length > 0,
                    strengths: !!res.data.key_strengths,
                    pricing: !!res.data.hourly_rate,
                    services: res.data.categories && res.data.categories.length > 0
                };
                setChecklist(newChecklist);

            } catch (err) {
                console.error("Failed to fetch dashboard data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        const fetchStudentsCount = async () => {
            try {
                setStudentsBusy(true);
                const res = await api.get('/tutor/me/students');
                const students = res.data?.students || [];
                setStudentsCount(Array.isArray(students) ? students.length : 0);
            } catch (e) {
                console.error('Failed to fetch tutor students count', e);
                setStudentsCount(0);
            } finally {
                setStudentsBusy(false);
            }
        };

        fetchStudentsCount();
    }, []);

    const weekStartMs = weekStartDate.getTime();
    const monthCursorMs = monthCursor.getTime();

    const refreshCalendarData = useCallback(async () => {
        try {
            if (!profile?.id) return;

            const from = viewMode === 'week' ? new Date(weekStartDate) : new Date(monthCursor);
            const to = new Date(from);
            if (viewMode === 'week') {
                to.setDate(from.getDate() + 7);
            } else {
                to.setMonth(from.getMonth() + 1);
            }

            setLessonsBusy(true);
            setBlocksBusy(true);
            if (viewMode === 'week') setCalendarBusy(true);

            const [lessonsRes, blocksRes, availabilityRes] = await Promise.all([
                api.get('/lessons/me', { params: { from: from.toISOString(), to: to.toISOString() } }),
                api.get('/scheduling/me/blocks', { params: { from: from.toISOString(), to: to.toISOString() } }),
                viewMode === 'week'
                    ? api.get(`/availability/tutor/${profile.id}/slots`, {
                        params: {
                            from: from.toISOString(),
                            to: to.toISOString(),
                            durationMinutes: 50,
                            stepMinutes: 30,
                        }
                    })
                    : Promise.resolve({ data: { slots: [] } } as any)
            ]);

            setLessons(lessonsRes.data?.lessons || []);
            setTimeBlocks(blocksRes.data?.blocks || []);
            setAvailabilitySlots(availabilityRes.data?.slots || []);
        } catch (e) {
            console.error('Failed to refresh calendar data', e);
        } finally {
            setLessonsBusy(false);
            setBlocksBusy(false);
            setCalendarBusy(false);
        }
    }, [profile?.id, viewMode, weekStartMs, monthCursorMs]);

    useEffect(() => {
        refreshCalendarData();
    }, [refreshCalendarData]);

    const handleConnectGoogleCalendar = async () => {
        try {
            const res = await api.get('/google-calendar/connect');
            const authUrl = res.data?.authUrl;
            if (authUrl) {
                window.location.href = authUrl;
            }
        } catch (e) {
            console.error('Failed to start Google Calendar connect', e);
        }
    };

    const handleDisconnectGoogleCalendar = async () => {
        try {
            await api.post('/google-calendar/disconnect');
            const res = await api.get('/tutor/me');
            setProfile(res.data);
        } catch (e) {
            console.error('Failed to disconnect Google Calendar', e);
        }
    };

    const completedCount = Object.values(checklist).filter(Boolean).length;
    const totalCount = Object.keys(checklist).length;
    const completionPercentage = Math.round((completedCount / totalCount) * 100);

    const checklistItems = [
        { label: 'Upload a profile photo', done: checklist.photo, link: '/tutor-onboarding?section=bio' },
        { label: 'Add a tagline', done: checklist.tagline, link: '/tutor-onboarding?section=bio' },
        { label: 'Add a bio/about section', done: checklist.about, link: '/tutor-onboarding?section=bio' },
        { label: 'Add your country', done: checklist.country, link: '/tutor-onboarding?section=bio' },
        { label: 'Add key strengths', done: checklist.strengths, link: '/tutor-onboarding?section=education' },
        { label: 'Select your services', done: checklist.services, link: '/tutor-onboarding?section=services' },
        { label: 'Set your lesson pricing', done: checklist.pricing, link: '/tutor-onboarding?section=pricing' },
    ];

    const isDashboardLoading = loading;

    const weekStart = new Date(weekStartDate);

    const weekDays = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    const startHour = 6;
    const endHour = 22;
    const hourHeightPx = 48;
    const minutesToPx = (minutes: number) => (minutes / 60) * hourHeightPx;
    const dayIndexFor = (d: Date) => {
        const start = new Date(weekStart);
        const ms = d.getTime() - start.getTime();
        const idx = Math.floor(ms / (24 * 60 * 60 * 1000));
        return idx;
    };

    const slotBlocks = availabilitySlots
        .map(s => {
            const start = new Date(s.start);
            const end = new Date(s.end);
            const idx = dayIndexFor(start);
            return { start, end, idx };
        })
        .filter(x => x.idx >= 0 && x.idx < 7);

    const lessonBlocks = lessons
        .map(l => {
            const start = new Date(l.start_time);
            const end = new Date(l.end_time);
            const idx = dayIndexFor(start);
            return { ...l, start, end, idx };
        })
        .filter(x => x.idx >= 0 && x.idx < 7);

    const blockedBlocks = timeBlocks
        .map(b => {
            const start = new Date(b.start_time);
            const end = new Date(b.end_time);
            const idx = dayIndexFor(start);
            return { ...b, start, end, idx };
        })
        .filter(x => x.idx >= 0 && x.idx < 7);

    const openEditBlock = (b: { id: string; start_time: string; end_time: string; reason?: string | null }) => {
        setEditingBlock({
            id: b.id,
            start: toDateTimeLocalValue(b.start_time),
            end: toDateTimeLocalValue(b.end_time),
            reason: b.reason || '',
        });
        setIsBlockModalOpen(true);
    };

    const saveBlockEdits = async () => {
        if (!editingBlock) return;
        try {
            await api.put(`/scheduling/me/blocks/${editingBlock.id}`, {
                start_time: new Date(editingBlock.start).toISOString(),
                end_time: new Date(editingBlock.end).toISOString(),
                reason: editingBlock.reason || undefined,
            });
            setIsBlockModalOpen(false);
            setEditingBlock(null);
            await refreshCalendarData();
        } catch (e) {
            console.error('Failed to update block', e);
        }
    };

    const deleteEditingBlock = async () => {
        if (!editingBlock) return;
        try {
            await api.delete(`/scheduling/me/blocks/${editingBlock.id}`);
            setIsBlockModalOpen(false);
            setEditingBlock(null);
            await refreshCalendarData();
        } catch (e) {
            console.error('Failed to delete block', e);
        }
    };

    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    const roundTo = (v: number, step: number) => Math.round(v / step) * step;

    const pointerToMinuteOfDay = (clientY: number, container: HTMLDivElement | null) => {
        if (!container) return null;
        const rect = container.getBoundingClientRect();
        const y = clientY - rect.top;
        const minutesFromStartHour = (y / hourHeightPx) * 60;
        const minuteOfDay = startHour * 60 + minutesFromStartHour;
        const rounded = roundTo(minuteOfDay, 15);
        return clamp(Math.floor(rounded), startHour * 60, endHour * 60);
    };

    const minuteToDateForDay = (dayIdx: number, minuteOfDay: number) => {
        const d = new Date(weekDays[dayIdx]);
        const h = Math.floor(minuteOfDay / 60);
        const m = minuteOfDay % 60;
        d.setHours(h, m, 0, 0);
        return d;
    };

    const createBlockFromSelection = useCallback(async () => {
        if (selectDayIdx === null || selectStartMin === null || selectEndMin === null) return;
        try {
            const startMin = Math.min(selectStartMin, selectEndMin);
            let endMin = Math.max(selectStartMin, selectEndMin);

            if (endMin === startMin) {
                endMin = clamp(startMin + 60, startHour * 60, endHour * 60);
            }

            const start = minuteToDateForDay(selectDayIdx, startMin);
            const end = minuteToDateForDay(selectDayIdx, endMin);

            await api.post('/scheduling/me/blocks', {
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                reason: 'Blocked',
            });

            await refreshCalendarData();
        } catch (e) {
            console.error('Failed to create block', e);
        }
    }, [selectDayIdx, selectStartMin, selectEndMin, startHour, endHour, refreshCalendarData]);

    useEffect(() => {
        const onMouseUp = async () => {
            if (!isSelecting) return;
            setIsSelecting(false);
            await createBlockFromSelection();
            setSelectDayIdx(null);
            setSelectStartMin(null);
            setSelectEndMin(null);
        };

        window.addEventListener('mouseup', onMouseUp);
        return () => window.removeEventListener('mouseup', onMouseUp);
    }, [isSelecting, createBlockFromSelection]);

    const selectionOverlay = (() => {
        if (!isSelecting || selectDayIdx === null || selectStartMin === null || selectEndMin === null) return null;
        const startMinutes = (Math.min(selectStartMin, selectEndMin) - startHour * 60);
        const endMinutes = (Math.max(selectStartMin, selectEndMin) - startHour * 60);
        const top = minutesToPx(startMinutes);
        const height = Math.max(12, minutesToPx(endMinutes - startMinutes));
        return { top, height };
    })();

    const monthLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const weekLabel = `${weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

    const monthGrid = (() => {
        const first = new Date(monthCursor);
        const firstDayOfWeek = first.getDay();
        const gridStart = new Date(first);
        gridStart.setDate(first.getDate() - firstDayOfWeek);
        gridStart.setHours(0, 0, 0, 0);

        return Array.from({ length: 42 }).map((_, i) => {
            const d = new Date(gridStart);
            d.setDate(gridStart.getDate() + i);
            return d;
        });
    })();

    const blocksByDayKey = (() => {
        const map = new Map<string, number>();
        for (const b of timeBlocks) {
            const d = new Date(b.start_time);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            map.set(key, (map.get(key) || 0) + 1);
        }
        return map;
    })();

    const lessonsByDayKey = (() => {
        const map = new Map<string, number>();
        for (const l of lessons) {
            const d = new Date(l.start_time);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            map.set(key, (map.get(key) || 0) + 1);
        }
        return map;
    })();

    const setWeekFromDate = (d: Date) => {
        const day = d.getDay();
        const diffToMonday = (day + 6) % 7;
        const start = new Date(d);
        start.setDate(d.getDate() - diffToMonday);
        start.setHours(0, 0, 0, 0);
        setWeekStartDate(start);
    };

    if (isDashboardLoading) return <DashboardLayout><div>Loading Dashboard...</div></DashboardLayout>;

    const now = new Date();
    const totalSessions = lessons.length;
    const pendingSessions = lessons.filter(l => new Date(l.start_time) > now && (l.status === 'PENDING' || l.status === 'BOOKED')).length;

    return (
        <DashboardLayout>
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left Column: Stats & Main Actions */}
                <div className="flex-1 space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatsCard icon={<Users className="w-5 h-5" />} label="Total Students" value={studentsBusy ? '…' : studentsCount} />
                        <StatsCard icon={<Users className="w-5 h-5" />} label="Active Students" value={studentsBusy ? '…' : studentsCount} />
                        <StatsCard icon={<Calendar className="w-5 h-5" />} label="Total Sessions" value={lessonsBusy ? '…' : totalSessions} />
                        <StatsCard icon={<Clock className="w-5 h-5" />} label="Pending Sessions" value={lessonsBusy ? '…' : pendingSessions} />
                    </div>

                    {/* Google Calendar Authorization Mock */}
                    <Card className="p-8 border-dashed border-2 bg-gray-50 flex flex-col gap-4 min-h-[300px]">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold text-gray-900">Calendar & Availability</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {profile?.google_calendar_connection?.sync_enabled
                                        ? 'Google Calendar connected (busy times will be blocked).'
                                        : 'Connect Google Calendar to block out your busy times automatically.'}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {profile?.google_calendar_connection?.sync_enabled ? (
                                    <Button variant="outline" onClick={handleDisconnectGoogleCalendar}>
                                        Disconnect
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        onClick={handleConnectGoogleCalendar}
                                        className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                                    >
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" className="w-5 h-5" />
                                        Connect Google Calendar
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-gray-200 pt-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant={viewMode === 'week' ? 'primary' : 'outline'}
                                        onClick={() => setViewMode('week')}
                                    >
                                        Week
                                    </Button>
                                    <Button
                                        variant={viewMode === 'month' ? 'primary' : 'outline'}
                                        onClick={() => setViewMode('month')}
                                    >
                                        Month
                                    </Button>
                                </div>

                                {viewMode === 'week' ? (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const d = new Date(weekStartDate);
                                                d.setDate(d.getDate() - 7);
                                                setWeekStartDate(d);
                                            }}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <div className="text-sm font-semibold text-gray-900">{weekLabel}</div>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const d = new Date(weekStartDate);
                                                d.setDate(d.getDate() + 7);
                                                setWeekStartDate(d);
                                            }}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const d = new Date(monthCursor);
                                                d.setMonth(d.getMonth() - 1);
                                                d.setDate(1);
                                                setMonthCursor(d);
                                            }}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <div className="text-sm font-semibold text-gray-900">{monthLabel}</div>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const d = new Date(monthCursor);
                                                d.setMonth(d.getMonth() + 1);
                                                d.setDate(1);
                                                setMonthCursor(d);
                                            }}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {(calendarBusy || lessonsBusy || blocksBusy) ? (
                                <div className="text-sm text-gray-600">Loading calendar...</div>
                            ) : viewMode === 'month' ? (
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                                            <div key={d} className="px-3 py-2 text-xs font-semibold text-gray-700">{d}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7">
                                        {monthGrid.map((d, i) => {
                                            const inMonth = d.getMonth() === monthCursor.getMonth();
                                            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                                            const blockCount = blocksByDayKey.get(key) || 0;
                                            const lessonCount = lessonsByDayKey.get(key) || 0;
                                            return (
                                                <button
                                                    key={i}
                                                    className={`border-r border-b border-gray-100 p-2 text-left h-20 hover:bg-gray-50 ${inMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}`}
                                                    onClick={() => {
                                                        setWeekFromDate(d);
                                                        setViewMode('week');
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-xs font-semibold">{d.getDate()}</div>
                                                    </div>
                                                    <div className="mt-1 space-y-1">
                                                        {lessonCount > 0 && (
                                                            <div className="text-[10px] bg-purple-50 border border-purple-100 text-purple-800 rounded px-1.5 py-0.5 inline-block">
                                                                {lessonCount} session{lessonCount > 1 ? 's' : ''}
                                                            </div>
                                                        )}
                                                        {blockCount > 0 && (
                                                            <div className="text-[10px] bg-gray-100 border border-gray-200 text-gray-800 rounded px-1.5 py-0.5 inline-block">
                                                                {blockCount} block{blockCount > 1 ? 's' : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
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
                                            <div
                                                key={dayIdx}
                                                className="relative border-r border-gray-100"
                                                style={{ height: (endHour - startHour) * hourHeightPx }}
                                                onMouseDown={(e) => {
                                                    const minute = pointerToMinuteOfDay(e.clientY, e.currentTarget);
                                                    if (minute === null) return;
                                                    setIsSelecting(true);
                                                    setSelectDayIdx(dayIdx);
                                                    setSelectStartMin(minute);
                                                    setSelectEndMin(minute);
                                                }}
                                                onMouseMove={(e) => {
                                                    if (!isSelecting || selectDayIdx !== dayIdx) return;
                                                    const minute = pointerToMinuteOfDay(e.clientY, e.currentTarget);
                                                    if (minute === null) return;
                                                    setSelectEndMin(minute);
                                                }}
                                            >
                                                {Array.from({ length: endHour - startHour }).map((__, i) => (
                                                    <div key={i} className="h-12 border-b border-gray-100"></div>
                                                ))}

                                                {selectionOverlay && selectDayIdx === dayIdx && (
                                                    <div
                                                        className="absolute left-1 right-1 rounded-md bg-gray-200/60 border border-gray-300"
                                                        style={{ top: selectionOverlay.top, height: selectionOverlay.height }}
                                                    />
                                                )}

                                                {slotBlocks
                                                    .filter(s => s.idx === dayIdx)
                                                    .map((s, i) => {
                                                        const startMinutes = (s.start.getHours() - startHour) * 60 + s.start.getMinutes();
                                                        const endMinutes = (s.end.getHours() - startHour) * 60 + s.end.getMinutes();
                                                        const top = minutesToPx(startMinutes);
                                                        const height = Math.max(10, minutesToPx(endMinutes - startMinutes));
                                                        if (startMinutes < 0 || endMinutes > (endHour - startHour) * 60) return null;

                                                        return (
                                                            <div
                                                                key={`slot-${i}`}
                                                                className="absolute left-1 right-1 rounded-md bg-green-50 border border-green-200 text-green-800 px-2 py-1 text-[10px]"
                                                                style={{ top, height }}
                                                                title={`${s.start.toLocaleString()} - ${s.end.toLocaleTimeString()}`}
                                                            >
                                                                Available
                                                            </div>
                                                        );
                                                    })}

                                                {blockedBlocks
                                                    .filter(b => b.idx === dayIdx)
                                                    .map((b) => {
                                                        const startMinutes = (b.start.getHours() - startHour) * 60 + b.start.getMinutes();
                                                        const endMinutes = (b.end.getHours() - startHour) * 60 + b.end.getMinutes();
                                                        const top = minutesToPx(startMinutes);
                                                        const height = Math.max(12, minutesToPx(endMinutes - startMinutes));
                                                        if (startMinutes < 0 || endMinutes > (endHour - startHour) * 60) return null;

                                                        return (
                                                            <div
                                                                key={b.id}
                                                                className="absolute left-1 right-1 rounded-md bg-gray-100 border border-gray-200 text-gray-800 px-2 py-1 text-[10px] cursor-pointer hover:bg-gray-200"
                                                                style={{ top, height }}
                                                                title={b.reason || 'Blocked'}
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openEditBlock({ id: b.id, start_time: b.start_time, end_time: b.end_time, reason: b.reason });
                                                                }}
                                                            >
                                                                <div className="font-semibold truncate">Blocked</div>
                                                                <div className="truncate">{b.reason || ''}</div>
                                                            </div>
                                                        );
                                                    })}

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
                                                                title={`${l.student?.username || 'Student'} (${l.status})`}
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                            >
                                                                <div className="font-semibold truncate">Session</div>
                                                                <div className="truncate">{l.student?.username || 'Student'}</div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {viewMode === 'week' && !calendarBusy && !lessonsBusy && !blocksBusy && availabilitySlots.length === 0 && lessonBlocks.length === 0 && blockedBlocks.length === 0 && (
                                <div className="text-sm text-gray-600 mt-3">
                                    No slots or sessions for this week. Add weekly availability in your profile to show open time.
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                <Modal
                    isOpen={isBlockModalOpen}
                    onClose={() => {
                        setIsBlockModalOpen(false);
                        setEditingBlock(null);
                    }}
                    title="Edit Blocked Time"
                >
                    {!editingBlock ? null : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Start</label>
                                <Input
                                    type="datetime-local"
                                    value={editingBlock.start}
                                    onChange={(e) => setEditingBlock(prev => prev ? ({ ...prev, start: e.target.value }) : prev)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">End</label>
                                <Input
                                    type="datetime-local"
                                    value={editingBlock.end}
                                    onChange={(e) => setEditingBlock(prev => prev ? ({ ...prev, end: e.target.value }) : prev)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                                <Input
                                    value={editingBlock.reason}
                                    onChange={(e) => setEditingBlock(prev => prev ? ({ ...prev, reason: e.target.value }) : prev)}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="outline" onClick={deleteEditingBlock}>Delete (Unblock)</Button>
                                <Button onClick={saveBlockEdits}>Save</Button>
                            </div>
                        </div>
                    )}
                </Modal>

                {/* Right Column: Profile Status Checklist */}
                <div className="w-full lg:w-80 space-y-6">
                    <Card className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-900">Profile Status</h3>
                            {completionPercentage === 100 ? (
                                <span className="flex items-center gap-1 text-xs text-green-500 font-medium bg-green-50 px-2 py-1 rounded-full">
                                    <CheckCircle className="w-3 h-3" /> Live
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs text-red-500 font-medium bg-red-50 px-2 py-1 rounded-full">
                                    <AlertCircle className="w-3 h-3" /> Incomplete
                                </span>
                            )}
                        </div>

                        <div className="mb-6">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-600">Profile Completion</span>
                                <span className="font-bold text-gray-900">{completionPercentage}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all duration-500 ${completionPercentage === 100 ? 'bg-green-500' : 'bg-red-500'}`}
                                    style={{ width: `${completionPercentage}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className={`${completionPercentage === 100 ? 'bg-green-50' : 'bg-red-50'} rounded-lg p-4 mb-6`}>
                            <h4 className={`text-sm font-bold ${completionPercentage === 100 ? 'text-green-700' : 'text-red-700'} mb-2`}>
                                {completionPercentage === 100 ? 'All set! You are visible to students.' : 'Complete these requirements to go live:'}
                            </h4>
                            <ul className="space-y-2">
                                {checklistItems.map((item, idx) => (
                                    <li key={idx} className={`flex items-start gap-2 text-xs ${item.done ? 'text-green-600' : 'text-red-600'}`}>
                                        <span className="mt-0.5">{item.done ? '✓' : '•'}</span>
                                        <span className={item.done ? 'line-through opacity-70' : ''}>{item.label}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <Button
                            className="w-full bg-[#4A1D96] hover:bg-[#3b1778] text-white"
                            onClick={() => navigate('/tutor-onboarding')}
                        >
                            {completionPercentage === 100 ? 'Edit Profile' : 'Complete Profile'}
                        </Button>
                    </Card>

                    {/* Current Plan Widget */}
                    <Card className="p-6">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Current Plan</p>
                                <h4 className="font-bold text-[#635BFF]">{profile?.tier || 'STANDARD'} Plan</h4>
                                <span className="inline-block mt-1 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Free Trial</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default TutorDashboard;
