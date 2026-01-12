import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageLayout } from '../layouts/PageLayout';
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

const BookMentorPage: React.FC = () => {
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
    const [selectedSlotStart, setSelectedSlotStart] = useState<string>('');
    const [frequency, setFrequency] = useState<Frequency>((searchParams.get('frequency') as Frequency) || 'WEEKLY');

    const formatDayKey = (iso: string, timeZone: string) => {
        const d = new Date(iso);
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
        return fmt.format(d); // YYYY-MM-DD in most runtimes
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
        // sort slots within each day
        for (const [k, arr] of map.entries()) {
            arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            map.set(k, arr);
        }
        return map;
    }, [slots, mentor]);

    const availableDays = useMemo(() => Array.from(slotsByDay.keys()).sort(), [slotsByDay]);

    const weeklyTotal = useMemo(() => {
        if (!mentor) return 0;
        if (frequency === 'ONCE') return mentor.hourly_rate;
        if (frequency === 'WEEKLY') return mentor.hourly_rate;
        if (frequency === 'TWICE_WEEKLY') return mentor.hourly_rate * 2;
        if (frequency === 'THRICE_WEEKLY') return mentor.hourly_rate * 3;
        return mentor.hourly_rate;
    }, [frequency, mentor]);

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
                        durationMinutes: 50,
                        stepMinutes: 30,
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
                    setSelectedSlotStart(paramSlotStart);
                } else {
                    const daySlots = fetched
                        .filter((s: any) => formatDayKey(s.start, mentor.timezone || 'UTC') === resolvedDay)
                        .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
                    setSelectedSlotStart(daySlots[0]?.start || '');
                }
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

    const onContinue = async () => {
        if (!mentor) return;

        const redirect = `/book/${mentor.id}?frequency=${encodeURIComponent(frequency)}`;

        if (!user) {
            navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
            return;
        }

        if (user.role !== 'STUDENT') {
            setError('Please login with a student account to book a mentor.');
            return;
        }

        if (!selectedSlotStart) {
            setError('Please choose an available time slot.');
            return;
        }

        const isoStartDate = selectedSlotStart;

        try {
            setError('');
            const res = await api.post('/bookings', {
                tutorId: mentor.id,
                startDate: isoStartDate,
                durationMinutes: 50,
                frequency,
            });

            navigate(`/booking/confirmation?bookingId=${encodeURIComponent(res.data.booking.id)}`);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create booking');
        }
    };

    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-3xl mx-auto">
                    {loading && <div className="p-8 text-center">Loading...</div>}
                    {!loading && mentor && (
                        <>
                            <div className="mb-6">
                                <h1 className="heading-lg mb-2">Book {mentor.username}</h1>
                                {mentor.tagline && <p className="text-gray-600">{mentor.tagline}</p>}
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
                            )}

                            <Card className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                                            value={frequency}
                                            onChange={(e) => setFrequency(e.target.value as Frequency)}
                                        >
                                            <option value="WEEKLY">Once a week</option>
                                            <option value="TWICE_WEEKLY">Twice a week</option>
                                            <option value="THRICE_WEEKLY">Three times a week</option>
                                            <option value="ONCE">One-time session</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Choose a day</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                                            value={selectedDay}
                                            onChange={(e) => {
                                                const day = e.target.value;
                                                setSelectedDay(day);
                                                const first = (slotsByDay.get(day) || [])[0];
                                                setSelectedSlotStart(first?.start || '');
                                            }}
                                        >
                                            <option value="">Select day</option>
                                            {availableDays.map((d) => (
                                                <option key={d} value={d}>{formatDayLabel(d)}</option>
                                            ))}
                                        </select>
                                        <div className="text-xs text-gray-500 mt-1">Times shown in tutor timezone: {mentor.timezone}</div>
                                    </div>
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
                                                const active = selectedSlotStart === s.start;
                                                const label = formatTimeLabel(s.start, mentor.timezone);
                                                return (
                                                    <button
                                                        key={s.start}
                                                        type="button"
                                                        onClick={() => setSelectedSlotStart(s.start)}
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

                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-gray-600">Weekly total</div>
                                        <div className="text-xl font-extrabold text-gray-900">${weeklyTotal}</div>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-600">
                                        Sessions may only be rescheduled if 24 or more hours remain before the scheduled start time. You can stop upcoming weekly payments before your next billing date.
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Button className="flex-1" onClick={onContinue}>Continue</Button>
                                    <Link to={`/mentors/${mentor.id}?frequency=${encodeURIComponent(frequency)}`} className="flex-1">
                                        <Button variant="outline" className="w-full">Back</Button>
                                    </Link>
                                </div>

                                {!user && (
                                    <div className="text-xs text-gray-500">
                                        You’ll be asked to login or create a student account before confirming your booking.
                                    </div>
                                )}
                            </Card>
                        </>
                    )}
                    {!loading && !mentor && error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
                    )}
                </div>
            </section>
        </PageLayout>
    );
};

export default BookMentorPage;
