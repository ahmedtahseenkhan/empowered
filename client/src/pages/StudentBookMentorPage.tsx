import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

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

    const formatDayKey = (iso: string, timeZone: string) => {
        const d = new Date(iso);
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
        return fmt.format(d);
    };

    const formatDayLabel = (dayKey: string) => {
        const [y, m, d] = dayKey.split('-').map(Number);
        const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
        return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const formatTimeLabel = (iso: string, timeZone: string) => {
        const d = new Date(iso);
        return new Intl.DateTimeFormat(undefined, { timeZone, hour: 'numeric', minute: '2-digit' }).format(d);
    };

    const slotsByDay = useMemo(() => {
        if (!mentor) return new Map<string, Array<{ start: string; end: string }>>();
        const map = new Map<string, Array<{ start: string; end: string }>>();
        for (const s of slots) {
            const key = formatDayKey(s.start, mentor.timezone || 'UTC');
            map.set(key, [...(map.get(key) || []), s]);
        }
        for (const [k, arr] of map.entries()) {
            arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            map.set(k, arr);
        }
        return map;
    }, [slots, mentor]);

    const availableDays = useMemo(() => Array.from(slotsByDay.keys()).sort(), [slotsByDay]);

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

                const paramDay = (searchParams.get('day') || '').trim();
                const paramSlotStart = (searchParams.get('slotStart') || '').trim();

                const dayKeys = (() => {
                    const s = new Set<string>();
                    for (const slot of fetched) s.add(formatDayKey(slot.start, mentor.timezone || 'UTC'));
                    return Array.from(s).sort();
                })();

                const initialDay = dayKeys[0] || '';
                const resolvedDay = (paramDay && dayKeys.includes(paramDay)) ? paramDay : (selectedDay || initialDay);
                setSelectedDay(resolvedDay);

                if (paramSlotStart && fetched.some((s: any) => s.start === paramSlotStart)) {
                } else {
                    const daySlots = fetched
                        .filter((s: any) => formatDayKey(s.start, mentor.timezone || 'UTC') === resolvedDay)
                        .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
                    void daySlots;
                }

                setSelectedSlotStarts((prev) => {
                    if (prev.length) return prev;
                    if (paramSlotStart && fetched.some((s: any) => s.start === paramSlotStart)) return [paramSlotStart];
                    const first = fetched
                        .filter((s: any) => formatDayKey(s.start, mentor.timezone || 'UTC') === resolvedDay)
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

        const isoStartDate = selectedSlotStarts[0];

        try {
            setError('');
            const res = await api.post('/bookings', {
                tutorId: mentor.id,
                startDate: isoStartDate,
                slotStarts: selectedSlotStarts,
                durationMinutes: 60,
                frequency,
            });

            navigate(`/student/booking/confirmation?bookingId=${encodeURIComponent(res.data.booking.id)}`);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create booking');
        }
    };

    return (
        <DashboardLayout>
            <div className="w-full">
                {loading && <div className="p-8 text-center">Loading...</div>}
                {!loading && mentor && (
                    <>
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Book a Session</h1>
                            {mentor.tagline && <p className="text-gray-600">{mentor.tagline}</p>}
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
                                        View your mentor's available days and times below.
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Choose a day</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                                            value={selectedDay}
                                            onChange={(e) => {
                                                const day = e.target.value;
                                                setSelectedDay(day);
                                            }}
                                        >
                                            <option value="">Select day</option>
                                            {availableDays.map((d) => (
                                                <option key={d} value={d}>{formatDayLabel(d)}</option>
                                            ))}
                                        </select>
                                        <div className="text-xs text-gray-500 mt-1">Times shown in tutor timezone: {mentor.timezone}</div>
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
                                                    const label = formatTimeLabel(s.start, mentor.timezone);
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
                                                        <div className="text-xs text-gray-600">Every {formatDayLabel(formatDayKey(s, mentor.timezone)).split(',')[0]}</div>
                                                        <div className="text-sm font-semibold text-gray-900">{formatTimeLabel(s, mentor.timezone)}</div>
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
        </DashboardLayout>
    );
};

export default StudentBookMentorPage;
