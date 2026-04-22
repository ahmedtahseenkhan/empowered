import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

type PublicTutorProfile = {
    id: string;
    username: string;
    tagline: string | null;
    about: string | null;
    hourly_rate: number;
    experience_years: number;
    country: string | null;
    timezone: string;
    rating: number;
    review_count: number;
    tier: string;
    is_verified: boolean;
    video_url: string | null;
    key_strengths: string | null;
    certifications: { id: string; name: string; issuer: string; year: number; is_verified: boolean }[];
    education: { id: string; institution: string; degree: string; field_of_study: string; year: number }[];
    experience: { id: string; role: string; company: string; start_year: number; end_year: number | null; description: string | null }[];
    categories: {
        category: {
            id: string;
            name: string;
            parent: null | {
                id: string;
                name: string;
                parent: null | { id: string; name: string };
            };
        };
    }[];
    total_students: number;
    student_levels?: string[];
    free_session_enabled?: boolean;
    reviews?: {
        id: string;
        rating: number;
        comment: string | null;
        created_at: string;
        student: {
            id: string;
            username: string;
            profile_photo: string | null;
        };
    }[];
    external_reviews?: {
        id: string;
        platform: string;
        reviewer: string;
        rating: number;
        comment: string | null;
        date: string | null;
    }[];
};

const StudentMentorPublicProfilePage: React.FC = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const frequency = searchParams.get('frequency') || 'WEEKLY';
    const isPreview = searchParams.get('preview') === '1';

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [mentor, setMentor] = useState<PublicTutorProfile | null>(null);

    const [tab, setTab] = useState<'REVIEWS' | 'EXTERNAL'>('REVIEWS');

    const [slotsBusy, setSlotsBusy] = useState(false);
    const [slots, setSlots] = useState<Array<{ start: string; end: string }>>([]);
    const [monthOffset, setMonthOffset] = useState(0);
    const [selectedDayKey, setSelectedDayKey] = useState<string>('');

    const [freeSlotsBusy, setFreeSlotsBusy] = useState(false);
    const [freeSlots, setFreeSlots] = useState<Array<{ start: string; end: string }>>([]);
    const [freeMonthOffset, setFreeMonthOffset] = useState(0);
    const [freeSelectedDayKey, setFreeSelectedDayKey] = useState<string>('');
    const [freeBookingBusy, setFreeBookingBusy] = useState(false);
    const [freeConfirmSlot, setFreeConfirmSlot] = useState<{ start: string; end: string } | null>(null);

    const [freeEligibilityBusy, setFreeEligibilityBusy] = useState(false);
    const [freeEligible, setFreeEligible] = useState<boolean>(true);

    const [profileTab, setProfileTab] = useState<'EXPERIENCE' | 'EDUCATION' | 'CERTIFICATIONS'>('EXPERIENCE');
    const [mentorCourses, setMentorCourses] = useState<Array<{
        id: string; title: string; description: string | null; duration: string | null;
        category: string | null; thumbnail_url: string | null; price: string;
        _count: { purchases: number };
    }>>([]);

    const studentTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

    useEffect(() => {
        const fetchMentor = async () => {
            try {
                setLoading(true);
                setError('');
                const res = await api.get(`/tutor/public/${id}`);
                setMentor(res.data.mentor);
            } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to load mentor profile');
            } finally {
                setLoading(false);
            }
        };
        fetchMentor();
    }, [id]);

    useEffect(() => {
        if (!mentor?.id) return;
        api.get(`/courses/tutor/${mentor.id}/public`)
            .then(res => setMentorCourses(res.data || []))
            .catch(() => {});
    }, [mentor?.id]);

    useEffect(() => {
        const fetchEligibility = async () => {
            if (!mentor?.id || isPreview) return;
            if (!mentor.free_session_enabled) {
                setFreeEligible(false);
                return;
            }

            try {
                setFreeEligibilityBusy(true);
                const res = await api.get('/bookings/free-session/eligibility', { params: { tutorId: mentor.id } });
                setFreeEligible(!!res.data?.eligible);
            } catch (e) {
                // Fail open on eligibility check so we don't incorrectly hide free sessions.
                setFreeEligible(true);
            } finally {
                setFreeEligibilityBusy(false);
            }
        };

        fetchEligibility();
    }, [mentor?.id, mentor?.free_session_enabled, isPreview]);

    const strengths = useMemo(() => {
        if (!mentor?.key_strengths) return [];
        return mentor.key_strengths.split(',').map(s => s.trim()).filter(Boolean);
    }, [mentor?.key_strengths]);

    const categoryGroups = useMemo(() => {
        if (!mentor?.categories?.length) return [] as Array<{ group: string; subs: Array<{ sub: string; items: string[] }> }>;

        const groupMap = new Map<string, Map<string, Set<string>>>();

        for (const tc of mentor.categories) {
            const c = tc.category;
            const p1 = c.parent;
            const p2 = p1?.parent;

            const group = p2?.name || p1?.name || c.name;
            const sub = p2 ? (p1?.name || 'No Category') : (p1 ? c.name : 'No Category');
            const leaf = p2 ? c.name : (p1 ? c.name : c.name);

            const bySub = groupMap.get(group) || new Map<string, Set<string>>();
            const items = bySub.get(sub) || new Set<string>();
            items.add(leaf);
            bySub.set(sub, items);
            groupMap.set(group, bySub);
        }

        return Array.from(groupMap.entries())
            .map(([group, bySub]) => ({
                group,
                subs: Array.from(bySub.entries())
                    .map(([sub, items]) => ({ sub, items: Array.from(items).sort() }))
                    .sort((a, b) => a.sub.localeCompare(b.sub)),
            }))
            .sort((a, b) => a.group.localeCompare(b.group));
    }, [mentor?.categories]);

    const formatDayKey = (iso: string, timeZone: string) => {
        const d = new Date(iso);
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
        return fmt.format(d);
    };

    const formatTimeLabel = (iso: string, timeZone: string) => {
        const d = new Date(iso);
        return new Intl.DateTimeFormat(undefined, { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
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

    const availableDayKeys = useMemo(() => new Set(Array.from(slotsByDay.keys())), [slotsByDay]);

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

    const freeSlotsByDay = useMemo(() => {
        if (!mentor) return new Map<string, Array<{ start: string; end: string }>>();
        const map = new Map<string, Array<{ start: string; end: string }>>();
        for (const s of freeSlots) {
            const key = formatDayKey(s.start, studentTimezone);
            map.set(key, [...(map.get(key) || []), s]);
        }
        for (const [k, arr] of map.entries()) {
            arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            map.set(k, arr);
        }
        return map;
    }, [freeSlots, mentor, studentTimezone]);

    const freeCalendarMeta = useMemo(() => {
        if (!mentor) return null;
        const base = new Date();
        const firstOfMonthLocal = new Date(base.getFullYear(), base.getMonth() + freeMonthOffset, 1, 12, 0, 0);
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
        return { monthLabel, cells, year, monthIndex };
    }, [mentor, freeMonthOffset, studentTimezone]);

    const freeCurrentMonthDayKeys = useMemo(() => {
        if (!freeCalendarMeta) return new Set<string>();
        const set = new Set<string>();
        freeCalendarMeta.cells.forEach((c) => {
            if (c.dayKey) set.add(c.dayKey);
        });
        return set;
    }, [freeCalendarMeta]);

    const freeHasSlotsInCurrentMonth = useMemo(() => {
        for (const dayKey of freeCurrentMonthDayKeys) {
            if ((freeSlotsByDay.get(dayKey) || []).length > 0) return true;
        }
        return false;
    }, [freeCurrentMonthDayKeys, freeSlotsByDay]);

    const freeSelectedDayInViewedMonth = freeSelectedDayKey && freeCurrentMonthDayKeys.has(freeSelectedDayKey);

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
                const dayKeys = (() => {
                    const s = new Set<string>();
                    for (const slot of fetched) s.add(formatDayKey(slot.start, tz));
                    return Array.from(s).sort();
                })();

                setSelectedDayKey((prev) => prev || dayKeys[0] || '');
            } catch (e: any) {
                console.error('Failed to fetch availability slots', e);
                setSlots([]);
            } finally {
                setSlotsBusy(false);
            }
        };

        fetchSlots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mentor?.id]);

    useEffect(() => {
        const fetchFreeSlots = async () => {
            if (!mentor?.id || !mentor?.free_session_enabled) return;
            if (!freeEligible) {
                setFreeSlots([]);
                setFreeSelectedDayKey('');
                return;
            }
            try {
                setFreeSlotsBusy(true);
                const from = new Date();
                from.setSeconds(0, 0);
                const to = new Date(from);
                to.setDate(to.getDate() + 60);
                const res = await api.get(`/availability/tutor/${mentor.id}/slots`, {
                    params: { from: from.toISOString(), to: to.toISOString(), type: 'free' },
                });
                const list = res.data?.slots || [];
                setFreeSlots(list);
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
                const base = new Date();
                const year = base.getFullYear();
                const month = base.getMonth();
                const firstDayThisMonth = new Set<string>();
                for (let d = 1; d <= 31; d++) {
                    const noon = new Date(year, month, d, 12, 0, 0);
                    if (noon.getMonth() !== month) break;
                    firstDayThisMonth.add(formatDayKey(noon.toISOString(), tz));
                }
                if (list.length > 0) {
                    const firstKey = formatDayKey(list[0].start, tz);
                    setFreeSelectedDayKey(firstDayThisMonth.has(firstKey) ? firstKey : '');
                } else {
                    setFreeSelectedDayKey('');
                }
            } catch (e) {
                console.error('Failed to fetch free session slots', e);
                setFreeSlots([]);
                setFreeSelectedDayKey('');
            } finally {
                setFreeSlotsBusy(false);
            }
        };
        fetchFreeSlots();
    }, [mentor?.id, mentor?.free_session_enabled, freeEligible]);

    useEffect(() => {
        if (!freeCalendarMeta || !freeCurrentMonthDayKeys.size) return;
        if (freeSelectedDayKey && freeCurrentMonthDayKeys.has(freeSelectedDayKey)) return;
        const firstAvailableInMonth = Array.from(freeCurrentMonthDayKeys).sort().find((dayKey) => (freeSlotsByDay.get(dayKey) || []).length > 0);
        setFreeSelectedDayKey(firstAvailableInMonth || '');
    }, [freeMonthOffset, freeCalendarMeta, freeCurrentMonthDayKeys, freeSlotsByDay]);

    const freeTodayKey = useMemo(() => {
        const d = new Date();
        return formatDayKey(d.toISOString(), studentTimezone);
    }, [studentTimezone]);

    return (
        <DashboardLayout>
            <div className="w-full">
                {loading && <div className="p-8 text-center">Loading profile...</div>}
                {!loading && error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
                )}

                {!loading && !error && mentor && (
                    <>
                        <div className="rounded-2xl overflow-hidden mb-8 border border-purple-100">
                            <div className="bg-gradient-to-r from-purple-700 to-purple-600 px-6 py-7">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h1 className="text-2xl md:text-3xl font-extrabold text-white">{mentor.username}</h1>
                                            {mentor.is_verified && (
                                                <span className="text-[10px] bg-white/20 text-white border border-white/30 px-2 py-0.5 rounded-full">Verified</span>
                                            )}
                                            <span className="text-[10px] bg-white/15 text-white border border-white/20 px-2 py-0.5 rounded-full">{mentor.tier}</span>
                                        </div>
                                        {mentor.tagline && <div className="text-purple-50 mt-2">{mentor.tagline}</div>}
                                        <div className="text-sm text-purple-100 mt-1">{mentor.country || 'Remote'} • Tutor timezone: {mentor.timezone}</div>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        {isPreview ? (
                                            <Link to="/dashboard">
                                                <Button variant="outline">Back to Dashboard</Button>
                                            </Link>
                                        ) : (
                                            <Link to={`/student/mentors?frequency=${encodeURIComponent(frequency)}`}>
                                                <Button variant="outline">Back</Button>
                                            </Link>
                                        )}
                                        {!isPreview && mentor.free_session_enabled && freeEligible && !freeEligibilityBusy && (
                                            <Button
                                                variant="outline"
                                                className="border-green-500 text-green-700 hover:bg-green-50"
                                                onClick={() => document.getElementById('free-session-card')?.scrollIntoView({ behavior: 'smooth' })}
                                            >
                                                Book a Free intro Session
                                            </Button>
                                        )}
                                        {!isPreview && (
                                            <Button
                                                onClick={() => {
                                                    const qs = new URLSearchParams();
                                                    qs.set('frequency', frequency);
                                                    navigate(`/student/book/${mentor.id}?${qs.toString()}`);
                                                }}
                                            >
                                                Start Weekly Sessions
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white px-6 py-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                                        <div className="text-xs text-gray-600">Rating</div>
                                        <div className="text-lg font-extrabold text-gray-900">{mentor.rating || 0}</div>
                                        <div className="text-xs text-gray-500">({mentor.review_count} reviews)</div>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                                        <div className="text-xs text-gray-600">Experience</div>
                                        <div className="text-lg font-extrabold text-gray-900">{mentor.experience_years || 0}</div>
                                        <div className="text-xs text-gray-500">years</div>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                                        <div className="text-xs text-gray-600">Price</div>
                                        <div className="text-lg font-extrabold text-gray-900">${mentor.hourly_rate}</div>
                                        <div className="text-xs text-gray-500">per 60 min</div>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                                        <div className="text-xs text-gray-600">Students</div>
                                        <div className="text-lg font-extrabold text-gray-900">{mentor.total_students || 0}</div>
                                        <div className="text-xs text-gray-500">taught</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                <Card className="p-6">
                                    <h2 className="text-lg font-bold text-gray-900 mb-3">About Me</h2>
                                    <div className="text-gray-700 text-sm whitespace-pre-line">
                                        {mentor.about || 'No description added yet.'}
                                    </div>

                                    {strengths.length > 0 && (
                                        <div className="mt-5">
                                            <div className="text-sm font-bold text-gray-900 mb-2">Key Strengths</div>
                                            <div className="flex flex-wrap gap-2">
                                                {strengths.map((s) => (
                                                    <span key={s} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </Card>

                                <Card className="p-6">
                                    <div className="flex items-center justify-between gap-4 mb-4">
                                        <h2 className="text-lg font-bold text-gray-900">Reviews</h2>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setTab('REVIEWS')}
                                                className={`text-sm px-3 py-1.5 rounded-lg border ${tab === 'REVIEWS'
                                                    ? 'bg-purple-600 text-white border-purple-600'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                Reviews
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTab('EXTERNAL')}
                                                className={`text-sm px-3 py-1.5 rounded-lg border ${tab === 'EXTERNAL'
                                                    ? 'bg-purple-600 text-white border-purple-600'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                External Reviews
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center">
                                        {tab === 'REVIEWS' ? (
                                            <div className="space-y-4">
                                                {mentor.reviews && mentor.reviews.length > 0 ? (
                                                    mentor.reviews.map((review: any) => (
                                                        <div key={review.id} className="border-b border-gray-200 pb-4 last:border-0 text-left">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700">
                                                                        {review.student?.username?.charAt(0)?.toUpperCase()}
                                                                    </div>
                                                                    <div className="text-sm font-semibold text-gray-900">{review.student?.username}</div>
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {new Date(review.created_at).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 mb-2">
                                                                {[...Array(5)].map((_, i) => (
                                                                    <span key={i} className={`text-sm ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                                                                ))}
                                                            </div>
                                                            {review.comment && (
                                                                <p className="text-sm text-gray-700">{review.comment}</p>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-center py-4">
                                                        <div className="font-semibold text-gray-900">No Reviews Yet</div>
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            This tutor doesn't have any reviews yet.
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {mentor.external_reviews && mentor.external_reviews.length > 0 ? (
                                                    mentor.external_reviews.map((review: any) => (
                                                        <div key={review.id} className="border-b border-gray-200 pb-4 last:border-0 text-left">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-600">
                                                                        {review.reviewer?.charAt(0)?.toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-semibold text-gray-900">{review.reviewer}</div>
                                                                        <div className="text-[10px] text-gray-500">via {review.platform}</div>
                                                                    </div>
                                                                </div>
                                                                {review.date && (
                                                                    <div className="text-xs text-gray-500">
                                                                        {new Date(review.date).toLocaleDateString()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1 mb-2">
                                                                {[...Array(5)].map((_, i) => (
                                                                    <span key={i} className={`text-sm ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                                                                ))}
                                                            </div>
                                                            {review.comment && (
                                                                <p className="text-sm text-gray-700">{review.comment}</p>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-center py-4">
                                                        <div className="font-semibold text-gray-900">No External Reviews</div>
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            No external reviews available yet.
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </Card>

                                {mentor.free_session_enabled && freeEligible && !freeEligibilityBusy && (
                                    <Card id="free-session-card" className="p-6 border-green-200 bg-green-50/30">
                                        <h2 className="text-lg font-bold text-gray-900 mb-1">Free 25-min introductory session</h2>
                                        <p className="text-sm text-gray-600 mb-4">Try a short session with this mentor at no cost. Select a time below to book.</p>
                                        {freeSlotsBusy ? (
                                            <div className="text-sm text-gray-600">Loading free session times...</div>
                                        ) : freeCalendarMeta ? (
                                            <>
                                                <div className="rounded-xl border border-gray-200 bg-white p-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="font-bold text-gray-900">{freeCalendarMeta.monthLabel}</div>
                                                        <div className="flex items-center gap-2">
                                                            <button type="button" className="h-8 w-8 rounded-lg border border-gray-200 hover:bg-gray-50" onClick={() => setFreeMonthOffset((v) => v - 1)}>{'<'}</button>
                                                            <button type="button" className="h-8 w-8 rounded-lg border border-gray-200 hover:bg-gray-50" onClick={() => setFreeMonthOffset((v) => v + 1)}>{'>'}</button>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-7 text-xs text-gray-500 mb-2">
                                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (<div key={d} className="text-center py-1">{d}</div>))}
                                                    </div>
                                                    <div className="grid grid-cols-7 gap-2">
                                                        {freeCalendarMeta.cells.map((c, idx) => {
                                                            if (!c.day || !c.dayKey) return <div key={idx} className="h-10" />;
                                                            const isPast = c.dayKey < freeTodayKey;
                                                            const hasFree = !isPast && (freeSlotsByDay.get(c.dayKey) || []).length > 0;
                                                            const isSelected = freeSelectedDayKey === c.dayKey;
                                                            return (
                                                                <button
                                                                    key={`${c.dayKey}-${idx}`}
                                                                    type="button"
                                                                    disabled={!hasFree}
                                                                    onClick={() => setFreeSelectedDayKey(c.dayKey || '')}
                                                                    className={`h-10 rounded-lg text-sm border transition-colors ${!hasFree ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' : isSelected ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-900 border-green-300 hover:bg-green-50'}`}
                                                                >
                                                                    {c.day}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                {!freeHasSlotsInCurrentMonth && (
                                                    <div className="mt-4 py-4 text-center text-sm text-gray-600 rounded-lg bg-gray-50 border border-gray-100">
                                                        No free sessions available this month. Try another month.
                                                    </div>
                                                )}
                                                {freeSelectedDayInViewedMonth && (freeSlotsByDay.get(freeSelectedDayKey) || []).length > 0 && (
                                                    <div className="mt-4">
                                                        <div className="text-sm font-bold text-gray-900 mb-2">Available times (25 min)</div>
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                            {(freeSlotsByDay.get(freeSelectedDayKey) || []).map((s) => (
                                                                <button
                                                                    key={s.start}
                                                                    type="button"
                                                                    disabled={freeBookingBusy || isPreview}
                                                                    onClick={() => {
                                                                        if (isPreview || freeBookingBusy) return;
                                                                        setFreeConfirmSlot(s);
                                                                    }}
                                                                    className="px-3 py-2 rounded-lg text-sm border border-green-300 bg-white hover:bg-green-50 text-gray-900 disabled:opacity-50"
                                                                >
                                                                    {formatTimeLabel(s.start, studentTimezone)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {freeBookingBusy && <div className="text-sm text-gray-600 mt-2">Booking...</div>}
                                                    </div>
                                                )}
                                                {freeSelectedDayInViewedMonth && (freeSlotsByDay.get(freeSelectedDayKey) || []).length === 0 && freeHasSlotsInCurrentMonth && (
                                                    <div className="mt-4 text-sm text-gray-600">No free slots on this day. Pick another date.</div>
                                                )}
                                                {freeSelectedDayKey && !freeSelectedDayInViewedMonth && freeHasSlotsInCurrentMonth && (
                                                    <div className="mt-4 text-sm text-gray-600">Select a date in the calendar above to see available times.</div>
                                                )}
                                            </>
                                        ) : null}
                                    </Card>
                                )}

                                {mentor.free_session_enabled && (
                                    <Modal
                                        isOpen={!!freeConfirmSlot}
                                        onClose={() => setFreeConfirmSlot(null)}
                                        title="Confirm free session"
                                    >
                                        {freeConfirmSlot && (
                                            <div className="space-y-4">
                                                <p className="text-gray-600">Please confirm your free 25-minute introductory session:</p>
                                                <dl className="grid grid-cols-1 gap-2 text-sm">
                                                    <div className="flex justify-between py-2 border-b border-gray-100">
                                                        <dt className="text-gray-500">Mentor</dt>
                                                        <dd className="font-medium text-gray-900">{mentor.username}</dd>
                                                    </div>
                                                    <div className="flex justify-between py-2 border-b border-gray-100">
                                                        <dt className="text-gray-500">Date</dt>
                                                        <dd className="font-medium text-gray-900">
                                                            {new Date(freeConfirmSlot.start).toLocaleDateString(undefined, { timeZone: studentTimezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between py-2 border-b border-gray-100">
                                                        <dt className="text-gray-500">Time</dt>
                                                        <dd className="font-medium text-gray-900">{formatTimeLabel(freeConfirmSlot.start, studentTimezone)}</dd>
                                                    </div>
                                                    <div className="flex justify-between py-2 border-b border-gray-100">
                                                        <dt className="text-gray-500">Duration</dt>
                                                        <dd className="font-medium text-gray-900">25 minutes</dd>
                                                    </div>
                                                    <div className="flex justify-between py-2">
                                                        <dt className="text-gray-500">Cost</dt>
                                                        <dd className="font-medium text-green-600">Free</dd>
                                                    </div>
                                                </dl>
                                                <div className="flex gap-3 pt-4">
                                                    <Button variant="outline" className="flex-1" onClick={() => setFreeConfirmSlot(null)} disabled={freeBookingBusy}>
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                                        disabled={freeBookingBusy}
                                                        onClick={async () => {
                                                            if (!freeConfirmSlot) return;
                                                            setFreeBookingBusy(true);
                                                            try {
                                                                const res = await api.post('/bookings/free-session', { tutorId: mentor.id, slotStart: freeConfirmSlot.start, clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
                                                                const bookingId = res.data?.booking?.id;
                                                                setFreeConfirmSlot(null);
                                                                if (bookingId) navigate(`/student/booking/confirmation?bookingId=${encodeURIComponent(bookingId)}`);
                                                                else setError('Booking could not be completed.');
                                                            } catch (err: any) {
                                                                setError(err.response?.data?.error || 'Failed to book free session.');
                                                            } finally {
                                                                setFreeBookingBusy(false);
                                                            }
                                                        }}
                                                    >
                                                        {freeBookingBusy ? 'Booking...' : 'Confirm'}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </Modal>
                                )}

                                <Card className="p-4">
                                    <h2 className="text-base font-bold text-gray-900 mb-2">{isPreview ? 'Availability' : 'Book a Session'}</h2>
                                    <p className="text-xs text-gray-500 mb-3">Select a date (your timezone: {studentTimezone})</p>

                                    {slotsBusy ? (
                                        <div className="text-xs text-gray-500 py-2">Loading...</div>
                                    ) : !calendarMeta ? null : (
                                        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-semibold text-gray-800">{calendarMeta.monthLabel}</span>
                                                <div className="flex items-center gap-1">
                                                    <button type="button" className="h-7 w-7 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm" onClick={() => setMonthOffset((v) => v - 1)}>{'<'}</button>
                                                    <button type="button" className="h-7 w-7 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm" onClick={() => setMonthOffset((v) => v + 1)}>{'>'}</button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-7 text-[10px] text-gray-500 mb-1">
                                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-center">{d}</div>)}
                                            </div>
                                            <div className="grid grid-cols-7 gap-1">
                                                {calendarMeta.cells.map((c, idx) => {
                                                    if (!c.day || !c.dayKey) return <div key={idx} className="h-7" />;
                                                    const isAvailable = availableDayKeys.has(c.dayKey);
                                                    const isSelected = selectedDayKey === c.dayKey;
                                                    return (
                                                        <button
                                                            key={`${c.dayKey}-${idx}`}
                                                            type="button"
                                                            disabled={!isAvailable}
                                                            onClick={() => setSelectedDayKey(c.dayKey || '')}
                                                            className={`h-7 min-w-0 rounded text-xs font-medium transition-colors ${!isAvailable ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : isSelected ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'}`}
                                                        >
                                                            {c.day}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Available</span>
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" /> Unavailable</span>
                                            </div>
                                        </div>
                                    )}

                                    {selectedDayKey && (slotsByDay.get(selectedDayKey) || []).length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                            <p className="text-xs font-semibold text-gray-700 mb-2">Available times</p>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                                {(slotsByDay.get(selectedDayKey) || []).slice(0, 8).map((s) => (
                                                    <button
                                                        key={s.start}
                                                        type="button"
                                                        className="px-2 py-1.5 rounded-md text-xs font-medium border border-gray-200 bg-white hover:bg-purple-50 hover:border-purple-200 text-gray-700 disabled:opacity-50"
                                                        disabled={isPreview}
                                                        onClick={() => {
                                                            if (isPreview) return;
                                                            const qs = new URLSearchParams();
                                                            qs.set('frequency', frequency);
                                                            qs.set('day', selectedDayKey);
                                                            qs.set('slotStart', s.start);
                                                            navigate(`/student/book/${mentor.id}?${qs.toString()}`);
                                                        }}
                                                    >
                                                        {formatTimeLabel(s.start, studentTimezone)}
                                                    </button>
                                                ))}
                                            </div>
                                            {!isPreview && (
                                                <Button size="sm" className="mt-3 w-full" onClick={() => { const qs = new URLSearchParams(); qs.set('frequency', frequency); if (selectedDayKey) qs.set('day', selectedDayKey); navigate(`/student/book/${mentor.id}?${qs.toString()}`); }}>
                                                    Continue to Booking
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </Card>

                                <Card className="p-6">
                                    <div className="flex items-center justify-center gap-6 mb-5">
                                        <button
                                            type="button"
                                            onClick={() => setProfileTab('EXPERIENCE')}
                                            className={`text-sm font-bold px-2 pb-2 border-b-2 ${profileTab === 'EXPERIENCE' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                                        >
                                            Professional experience
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setProfileTab('EDUCATION')}
                                            className={`text-sm font-bold px-2 pb-2 border-b-2 ${profileTab === 'EDUCATION' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                                        >
                                            Education
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setProfileTab('CERTIFICATIONS')}
                                            className={`text-sm font-bold px-2 pb-2 border-b-2 ${profileTab === 'CERTIFICATIONS' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                                        >
                                            Certifications
                                        </button>
                                    </div>

                                    {profileTab === 'EXPERIENCE' && (
                                        <div className="space-y-4">
                                            {mentor.experience?.length ? mentor.experience
                                                .slice()
                                                .sort((a, b) => b.start_year - a.start_year)
                                                .map((e) => (
                                                    <div key={e.id} className="rounded-xl border border-gray-200 bg-white p-4">
                                                        <div className="font-semibold text-gray-900">{e.role || 'Not Added Yet'}</div>
                                                        <div className="text-sm text-gray-600">{e.company || 'Not Added Yet'} • {e.start_year}{e.end_year ? ` - ${e.end_year}` : ' - Present'}</div>
                                                        {e.description && <div className="text-sm text-gray-700 mt-2 whitespace-pre-line">{e.description}</div>}
                                                    </div>
                                                )) : (
                                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">Not Added Yet</div>
                                            )}
                                        </div>
                                    )}

                                    {profileTab === 'EDUCATION' && (
                                        <div className="space-y-4">
                                            {mentor.education?.length ? mentor.education
                                                .slice()
                                                .sort((a, b) => (b.year || 0) - (a.year || 0))
                                                .map((ed) => (
                                                    <div key={ed.id} className="rounded-xl border border-gray-200 bg-white p-4">
                                                        <div className="text-sm text-gray-600">Institution</div>
                                                        <div className="font-semibold text-gray-900">{ed.institution || 'Not Added Yet'}</div>
                                                        <div className="mt-3 text-sm text-gray-600">Degree</div>
                                                        <div className="font-semibold text-gray-900">{ed.degree || 'Not Added Yet'}{ed.field_of_study ? ` • ${ed.field_of_study}` : ''}</div>
                                                        <div className="mt-3 text-sm text-gray-600">Graduation Year</div>
                                                        <div className="font-semibold text-gray-900">{ed.year || 'Not Added Yet'}</div>
                                                    </div>
                                                )) : (
                                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">Not Added Yet</div>
                                            )}
                                        </div>
                                    )}

                                    {profileTab === 'CERTIFICATIONS' && (
                                        <div className="space-y-3">
                                            {mentor.certifications?.length ? mentor.certifications.map((c) => (
                                                <div key={c.id} className="flex items-start justify-between gap-4 p-4 bg-white border border-gray-200 rounded-xl">
                                                    <div>
                                                        <div className="font-semibold text-gray-900">{c.name}</div>
                                                        <div className="text-sm text-gray-600">{c.issuer} ({c.year})</div>
                                                    </div>
                                                    <div>
                                                        {c.is_verified ? (
                                                            <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Verified</span>
                                                        ) : (
                                                            <span className="text-[10px] bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded-full">Pending</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">Not Added Yet</div>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            </div>

                            <div className="space-y-6">
                                <Card className="p-6">
                                    <h2 className="text-lg font-bold text-gray-900 mb-3">Pricing</h2>
                                    <div className="text-sm text-gray-600">50-minute lesson rate</div>
                                    <div className="text-3xl font-extrabold text-gray-900">${mentor.hourly_rate}</div>
                                    <div className="mt-4 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                        You will be charged weekly based on your selected time slots. You can stop upcoming weekly payments before your next billing date.
                                    </div>
                                </Card>

                                <Card className="p-6">
                                    <h2 className="text-lg font-bold text-gray-900 mb-3">Approved Categories</h2>
                                    {categoryGroups.length ? (
                                        <div className="space-y-4">
                                            {categoryGroups.map((g) => (
                                                <div key={g.group} className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4">
                                                    <div className="text-lg font-extrabold text-purple-800">{g.group}</div>
                                                    <div className="mt-3 space-y-3">
                                                        {g.subs.map((s) => (
                                                            <div key={`${g.group}-${s.sub}`}>
                                                                <div className="text-sm font-bold text-purple-700">{s.sub}</div>
                                                                <div className="flex flex-wrap gap-2 mt-2">
                                                                    {s.items.map((i) => (
                                                                        <span key={i} className="text-xs bg-white text-gray-800 border border-gray-200 px-3 py-1 rounded-full">{i}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-600">No categories added yet.</div>
                                    )}
                                </Card>

                                {mentor.student_levels && mentor.student_levels.length > 0 && (
                                    <Card className="p-6">
                                        <h2 className="text-lg font-bold text-gray-900 mb-2">Student Levels</h2>
                                        <div className="text-sm text-gray-700">
                                            {(mentor.student_levels as string[]).map((id) => {
                                                const labels: Record<string, string> = {
                                                    ELEMENTARY_SCHOOL: 'Elementary School',
                                                    MIDDLE_SCHOOL: 'Middle School',
                                                    HIGH_SCHOOL: 'High School',
                                                    COLLEGE_ADULT: 'College & Adult Learners',
                                                };
                                                return labels[id] || id;
                                            }).join(' • ')}
                                        </div>
                                    </Card>
                                )}

                                {mentor.certifications?.length > 0 && (
                                    <Card className="p-6">
                                        <h2 className="text-lg font-bold text-gray-900 mb-3">Certifications</h2>
                                        <div className="space-y-3">
                                            {mentor.certifications.map((c) => (
                                                <div key={c.id} className="flex items-start justify-between gap-4 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                                                    <div>
                                                        <div className="font-semibold text-gray-900">{c.name}</div>
                                                        <div className="text-sm text-gray-600">{c.issuer} ({c.year})</div>
                                                    </div>
                                                    <div>
                                                        {c.is_verified ? (
                                                            <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Verified</span>
                                                        ) : (
                                                            <span className="text-[10px] bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded-full">Pending</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}
                            </div>
                        </div>

                        {/* Courses offered by this mentor */}
                        {mentorCourses.length > 0 && (
                            <div className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900 mb-5">Courses by this Mentor</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {mentorCourses.map(course => (
                                        <div
                                            key={course.id}
                                            onClick={() => navigate(`/student/courses/${course.id}`)}
                                            className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer overflow-hidden flex group"
                                        >
                                            <div className="w-28 h-28 shrink-0 bg-gradient-to-br from-purple-500 to-purple-900 flex items-center justify-center overflow-hidden">
                                                {course.thumbnail_url ? (
                                                    <img loading="lazy" decoding="async" src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-3xl">🎓</span>
                                                )}
                                            </div>
                                            <div className="p-4 flex flex-col justify-between flex-1">
                                                <div>
                                                    {course.category && (
                                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{course.category}</span>
                                                    )}
                                                    <h3 className="font-bold text-gray-900 text-sm mt-1 leading-snug line-clamp-2">{course.title}</h3>
                                                </div>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-[#4A1D96] font-extrabold">${Number(course.price).toFixed(2)}</span>
                                                    <span className="text-xs text-purple-700 font-semibold group-hover:underline">View →</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    );
};

export default StudentMentorPublicProfilePage;
