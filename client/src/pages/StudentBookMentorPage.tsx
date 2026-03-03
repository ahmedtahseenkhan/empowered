import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';

type PublicTutorLite = {
    id: string;
    username: string;
    tagline: string | null;
    hourly_rate: number;
    rating: number;
    review_count: number;
    is_verified: boolean;
    timezone: string;
};

type Frequency = 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY';

const requiredWeeklySlotsForFrequency = (frequency: Frequency) => {
    if (frequency === 'TWICE_WEEKLY') return 2;
    if (frequency === 'THRICE_WEEKLY') return 3;
    return 1;
};

const PLATFORM_FEE_PERCENTAGE = 0.1;

const StudentBookMentorPage: React.FC = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [mentor, setMentor] = useState<PublicTutorLite | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [slotsBusy, setSlotsBusy] = useState(false);
    const [slots, setSlots] = useState<Array<{ start: string; end: string }>>([]);
    const [selectedDay, setSelectedDay] = useState<string>('');
    const [selectedSlotStarts, setSelectedSlotStarts] = useState<string[]>([]);
    const [frequency, setFrequency] = useState<Frequency>((searchParams.get('frequency') as Frequency) || 'WEEKLY');

    const mentorTimezone = mentor?.timezone || 'UTC';
    const studentTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

    const formatDayKey = (iso: string, tz: string) => {
        const d = new Date(iso);
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
        return fmt.format(d);
    };

    const formatDayLabel = (dayKey: string, tz: string) => {
        const [y, m, d] = dayKey.split('-').map(Number);
        const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
        return new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(dt);
    };

    const formatTimeLabel = (iso: string, tz: string) => {
        const d = new Date(iso);
        return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
    };

    const slotsByDay = useMemo(() => {
        if (!mentor) return new Map<string, Array<{ start: string; end: string }>>();
        const map = new Map<string, Array<{ start: string; end: string }>>();
        for (const s of slots) {
            const key = formatDayKey(s.start, studentTimezone);
            map.set(key, [...(map.get(key) || []), s]);
        }
        for (const [k, arr] of map.entries()) {
            arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            map.set(k, arr);
        }
        return map;
    }, [slots, mentor, studentTimezone]);

    const availableDays = useMemo(() => Array.from(slotsByDay.keys()).sort(), [slotsByDay]);

    const [monthOffset, setMonthOffset] = useState(0);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const calendarMeta = useMemo(() => {
        if (!mentor) return null;
        const base = new Date();
        const firstOfMonthLocal = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1, 12, 0, 0);
        const monthLabel = new Intl.DateTimeFormat(undefined, { timeZone: studentTimezone, month: 'long', year: 'numeric' }).format(firstOfMonthLocal);
        const year = firstOfMonthLocal.getFullYear();
        const monthIndex = firstOfMonthLocal.getMonth();
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const startWeekday = new Date(year, monthIndex, 1).getDay();
        const cells: Array<{ day: number | null; dayKey: string | null }> = [];
        for (let i = 0; i < startWeekday; i++) cells.push({ day: null, dayKey: null });
        for (let day = 1; day <= daysInMonth; day++) {
            const noonLocal = new Date(year, monthIndex, day, 12, 0, 0);
            const key = formatDayKey(noonLocal.toISOString(), studentTimezone);
            cells.push({ day, dayKey: key });
        }
        while (cells.length % 7 !== 0) cells.push({ day: null, dayKey: null });
        return { monthLabel, cells };
    }, [mentor, monthOffset, studentTimezone]);

    const availableDayKeys = useMemo(() => new Set(availableDays), [availableDays]);

    const requiredWeeklySlots = useMemo(() => requiredWeeklySlotsForFrequency(frequency), [frequency]);

    useEffect(() => {
        const fetchMentor = async () => {
            try {
                setLoading(true);
                setError('');
                const res = await api.get(`/tutor/public/${id}`);
                const m = res.data.mentor;
                setMentor({
                    id: m.id,
                    username: m.username,
                    tagline: m.tagline,
                    hourly_rate: m.hourly_rate,
                    rating: m.rating,
                    review_count: m.review_count,
                    is_verified: m.is_verified,
                    timezone: m.timezone || 'UTC',
                });
            } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to load mentor');
            } finally {
                setLoading(false);
            }
        };
        fetchMentor();
    }, [id]);

    useEffect(() => {
        const fetchSlots = async () => {
            if (!mentor) return;
            try {
                setSlotsBusy(true);
                const from = new Date();
                from.setSeconds(0, 0);
                const to = new Date(from);
                to.setDate(to.getDate() + 21);

                const res = await api.get(`/availability/tutor/${mentor.id}/slots`, {
                    params: {
                        from: from.toISOString(),
                        to: to.toISOString(),
                        durationMinutes: 60,
                        stepMinutes: 60,
                    }
                });

                const fetched = res.data?.slots || [];
                setSlots(fetched);

                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
                const paramDay = (searchParams.get('day') || '').trim();
                const paramSlotStart = (searchParams.get('slotStart') || '').trim();

                const dayKeys = (() => {
                    const s = new Set<string>();
                    for (const slot of fetched) s.add(formatDayKey(slot.start, tz));
                    return Array.from(s).sort();
                })();

                const initialDay = dayKeys[0] || '';
                const resolvedDay = (paramDay && dayKeys.includes(paramDay)) ? paramDay : (selectedDay || initialDay);
                setSelectedDay(resolvedDay);

                if (paramDay && /^\d{4}-\d{2}-\d{2}$/.test(paramDay) && dayKeys.includes(paramDay)) {
                    const [y, m] = paramDay.split('-').map(Number);
                    const base = new Date();
                    const baseYear = base.getFullYear();
                    const baseMonth = base.getMonth();
                    const paramYear = y || baseYear;
                    const paramMonth = (m || 1) - 1;
                    const diffMonths = (paramYear - baseYear) * 12 + (paramMonth - baseMonth);
                    setMonthOffset((prev) => (diffMonths >= -2 && diffMonths <= 2 ? diffMonths : prev));
                }

                setSelectedSlotStarts((prev) => {
                    if (prev.length) return prev;
                    if (paramSlotStart && fetched.some((s: any) => s.start === paramSlotStart)) return [paramSlotStart];
                    const first = fetched
                        .filter((s: any) => formatDayKey(s.start, tz) === resolvedDay)
                        .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())[0]?.start;
                    return first ? [first] : [];
                });
            } catch (e: any) {
                console.error('Failed to fetch availability slots', e);
                setSlots([]);
            } finally {
                setSlotsBusy(false);
            }
        };

        fetchSlots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mentor?.id, searchParams]);

    useEffect(() => {
        // When frequency changes, clamp selected slots to required count.
        setSelectedSlotStarts((prev) => prev.slice(0, requiredWeeklySlotsForFrequency(frequency)));
    }, [frequency]);

    const isSlotSelected = (startIso: string) => selectedSlotStarts.includes(startIso);

    const toggleSlot = (startIso: string) => {
        setSelectedSlotStarts((prev) => {
            if (prev.includes(startIso)) return prev.filter((s) => s !== startIso);
            const required = requiredWeeklySlotsForFrequency(frequency);
            if (prev.length >= required) return prev; // must remove one first
            return [...prev, startIso].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        });
    };

    const removeSelectedSlot = (startIso: string) => {
        setSelectedSlotStarts((prev) => prev.filter((s) => s !== startIso));
    };

    const firstSelectedStart = useMemo(() => {
        const starts = selectedSlotStarts.map((s) => new Date(s)).filter((d) => !Number.isNaN(d.getTime()));
        starts.sort((a, b) => a.getTime() - b.getTime());
        return starts[0] || null;
    }, [selectedSlotStarts]);

    const sessionAmount = useMemo(() => Number(mentor?.hourly_rate || 0), [mentor?.hourly_rate]);
    const platformFee = useMemo(() => sessionAmount * PLATFORM_FEE_PERCENTAGE, [sessionAmount]);
    const totalPayable = useMemo(() => sessionAmount + platformFee, [sessionAmount, platformFee]);

    const onContinue = async () => {
        if (!mentor) return;

        const redirect = `/student/book/${mentor.id}?frequency=${encodeURIComponent(frequency)}`;

        if (!user) {
            navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
            return;
        }

        if (user.role !== 'STUDENT') {
            setError('Please login with a student account to book a mentor.');
            return;
        }

        if (selectedSlotStarts.length !== requiredWeeklySlots) {
            setError(`Please select ${requiredWeeklySlots} weekly time slot${requiredWeeklySlots === 1 ? '' : 's'} to proceed.`);
            return;
        }

        setError('');
        setConfirmOpen(true);
    };

    return (
        <DashboardLayout>
            <div className="w-full">
                {loading && <div className="p-8 text-center">Loading...</div>}
                {!loading && mentor && (
                    <>
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Book a Session</h1>
                            <div className="text-sm text-gray-700">
                                Mentor: <span className="font-semibold">{mentor.username}</span>
                                <span className="text-gray-400"> · </span>
                                <span className="font-semibold">${mentor.hourly_rate}</span>
                                {mentor.is_verified && (
                                    <>
                                        <span className="text-gray-400"> · </span>
                                        <span className="text-green-700 font-semibold">Verified</span>
                                    </>
                                )}
                            </div>
                            {mentor.tagline && <p className="text-gray-600 mt-1">{mentor.tagline}</p>}
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <Card className="p-6 space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                                            value={frequency}
                                            onChange={(e) => setFrequency(e.target.value as Frequency)}
                                        >
                                            <option value="WEEKLY">Once a week (4 Sessions)</option>
                                            <option value="TWICE_WEEKLY">Twice a week (8 Sessions)</option>
                                            <option value="THRICE_WEEKLY">Three times a week (12 Sessions)</option>
                                            <option value="ONCE">One-time session (1 Session)</option>
                                        </select>
                                        <div className="text-xs text-gray-500 mt-2">
                                            Choose {requiredWeeklySlots} day{requiredWeeklySlots === 1 ? '' : 's'} & time{requiredWeeklySlots === 1 ? '' : 's'}. They’ll auto-repeat weekly for 1 month.
                                        </div>
                                    </div>

                                    <div className="rounded-lg bg-[#4A1D96] text-white text-sm font-semibold px-4 py-3">
                                        Times below are in your local timezone ({studentTimezone}). Your mentor is in {mentorTimezone}.
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Choose a day</label>
                                        {!calendarMeta ? null : (
                                            <div className="rounded-xl border border-gray-200 bg-white p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="font-bold text-gray-900">{calendarMeta.monthLabel}</div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            className="h-8 w-8 rounded-lg border border-gray-200 hover:bg-gray-50"
                                                            onClick={() => setMonthOffset((v) => v - 1)}
                                                        >
                                                            {'<'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="h-8 w-8 rounded-lg border border-gray-200 hover:bg-gray-50"
                                                            onClick={() => setMonthOffset((v) => v + 1)}
                                                        >
                                                            {'>'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-7 text-xs text-gray-500 mb-2">
                                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                                                        <div key={d} className="text-center py-1">{d}</div>
                                                    ))}
                                                </div>
                                                <div className="grid grid-cols-7 gap-2">
                                                    {calendarMeta.cells.map((c, idx) => {
                                                        if (!c.day || !c.dayKey) return <div key={idx} className="h-10" />;
                                                        const isAvailable = availableDayKeys.has(c.dayKey);
                                                        const isSelected = selectedDay === c.dayKey;
                                                        return (
                                                            <button
                                                                key={`${c.dayKey}-${idx}`}
                                                                type="button"
                                                                disabled={!isAvailable}
                                                                onClick={() => setSelectedDay(c.dayKey || '')}
                                                                className={`h-10 rounded-lg text-sm border transition-colors ${
                                                                    !isAvailable
                                                                        ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                                                        : isSelected
                                                                        ? 'bg-purple-600 text-white border-purple-600'
                                                                        : 'bg-white text-gray-900 border-purple-200 hover:bg-purple-50'
                                                                }`}
                                                            >
                                                                {c.day}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-gray-600 mt-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-block h-3 w-3 rounded border border-purple-400 bg-white" /> Available
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-block h-3 w-3 rounded border border-gray-200 bg-gray-50" /> Not available
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <div className="text-sm font-medium text-gray-700 mb-2">Available time slots</div>
                                        {slotsBusy ? (
                                            <div className="text-sm text-gray-600">Loading availability...</div>
                                        ) : !selectedDay ? (
                                            <div className="text-sm text-gray-600">Pick a day to see available slots.</div>
                                        ) : (slotsByDay.get(selectedDay) || []).length === 0 ? (
                                            <div className="text-sm text-gray-600">No slots available for this day.</div>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {(slotsByDay.get(selectedDay) || []).map((s) => {
                                                    const active = isSlotSelected(s.start);
                                                    const label = formatTimeLabel(s.start, studentTimezone);
                                                    return (
                                                        <button
                                                            key={s.start}
                                                            type="button"
                                                            onClick={() => toggleSlot(s.start)}
                                                            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${active
                                                                ? 'bg-purple-600 text-white border-purple-600'
                                                                : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'}`}
                                                        >
                                                            {label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-3">
                                        <Button className="flex-1" onClick={onContinue} disabled={selectedSlotStarts.length !== requiredWeeklySlots}>
                                            Continue
                                        </Button>
                                        <Link to={`/student/mentors/${mentor.id}?frequency=${encodeURIComponent(frequency)}`} className="flex-1">
                                            <Button variant="outline" className="w-full">Back</Button>
                                        </Link>
                                    </div>

                                    {!user && (
                                        <div className="text-xs text-gray-500">
                                            You’ll be asked to login or create a student account before confirming your booking.
                                        </div>
                                    )}
                                </Card>
                            </div>

                            <div>
                                <Card className="p-6">
                                    <div className="text-sm font-bold text-gray-900 mb-3">
                                        Selected Time Slots ({selectedSlotStarts.length}/{requiredWeeklySlots})
                                    </div>

                                    {selectedSlotStarts.length === 0 ? (
                                        <div className="text-sm text-gray-600">No slots selected yet.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {selectedSlotStarts.map((s) => (
                                                <div key={s} className="flex items-center justify-between gap-3 border border-purple-100 bg-purple-50/40 rounded-lg p-3">
                                                    <div>
                                                        <div className="text-xs text-gray-600">Every {formatDayLabel(formatDayKey(s, studentTimezone), studentTimezone).split(',')[0]}</div>
                                                        <div className="text-sm font-semibold text-gray-900">{formatTimeLabel(s, studentTimezone)}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeSelectedSlot(s)}
                                                        className="text-gray-400 hover:text-gray-600"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {selectedSlotStarts.length !== requiredWeeklySlots && (
                                        <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg p-3">
                                            Please select {requiredWeeklySlots - selectedSlotStarts.length} more slot{requiredWeeklySlots - selectedSlotStarts.length === 1 ? '' : 's'} to proceed
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>
                    </>
                )}
                {!loading && !mentor && error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
                )}
            </div>

            <Modal
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title="Confirm booking"
            >
                <div className="space-y-4">
                    <p className="text-gray-600">
                        Please confirm your session details. Next you’ll review charges and continue to Stripe.
                    </p>
                    <dl className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex justify-between py-2 border-b border-gray-100">
                            <dt className="text-gray-500">Mentor</dt>
                            <dd className="font-medium text-gray-900">{mentor?.username}</dd>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                            <dt className="text-gray-500">Date</dt>
                            <dd className="font-medium text-gray-900">
                                {firstSelectedStart
                                    ? firstSelectedStart.toLocaleDateString(undefined, { timeZone: studentTimezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                                    : '—'}
                            </dd>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                            <dt className="text-gray-500">Time</dt>
                            <dd className="font-medium text-gray-900">
                                {firstSelectedStart ? formatTimeLabel(firstSelectedStart.toISOString(), studentTimezone) : '—'}
                            </dd>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                            <dt className="text-gray-500">Duration</dt>
                            <dd className="font-medium text-gray-900">60 minutes</dd>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                            <dt className="text-gray-500">Session amount</dt>
                            <dd className="font-medium text-gray-900">${sessionAmount.toFixed(2)}</dd>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                            <dt className="text-gray-500">Platform fee (10%)</dt>
                            <dd className="font-medium text-gray-900">${platformFee.toFixed(2)}</dd>
                        </div>
                        <div className="flex justify-between py-2">
                            <dt className="text-gray-900 font-semibold">Total payable today</dt>
                            <dd className="text-gray-900 font-semibold">${totalPayable.toFixed(2)}</dd>
                        </div>
                    </dl>

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={() => {
                                if (!mentor) return;
                                sessionStorage.setItem('pendingStudentBooking', JSON.stringify({
                                    tutorId: mentor.id,
                                    frequency,
                                    slotStarts: selectedSlotStarts,
                                    durationMinutes: 60,
                                    createdAt: new Date().toISOString(),
                                }));
                                setConfirmOpen(false);
                                navigate('/student/booking/review');
                            }}
                        >
                            Confirm
                        </Button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
};

export default StudentBookMentorPage;
