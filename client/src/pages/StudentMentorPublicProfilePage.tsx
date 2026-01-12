import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

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

    const [profileTab, setProfileTab] = useState<'EXPERIENCE' | 'EDUCATION' | 'CERTIFICATIONS'>('EXPERIENCE');

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

    const availableDayKeys = useMemo(() => new Set(Array.from(slotsByDay.keys())), [slotsByDay]);

    const calendarMeta = useMemo(() => {
        if (!mentor) return null;
        const tz = mentor.timezone || 'UTC';

        const base = new Date();
        const firstOfMonthLocal = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1, 12, 0, 0);
        const monthLabel = new Intl.DateTimeFormat(undefined, { timeZone: tz, month: 'long', year: 'numeric' }).format(firstOfMonthLocal);

        const year = firstOfMonthLocal.getFullYear();
        const monthIndex = firstOfMonthLocal.getMonth();
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const startWeekday = new Date(year, monthIndex, 1).getDay();

        const cells: Array<{ day: number | null; dayKey: string | null }> = [];
        for (let i = 0; i < startWeekday; i++) cells.push({ day: null, dayKey: null });

        for (let day = 1; day <= daysInMonth; day++) {
            const noonUtc = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
            const key = formatDayKey(noonUtc.toISOString(), tz);
            cells.push({ day, dayKey: key });
        }

        while (cells.length % 7 !== 0) cells.push({ day: null, dayKey: null });

        return { tz, monthLabel, cells };
    }, [mentor, monthOffset]);

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

                const dayKeys = (() => {
                    const s = new Set<string>();
                    for (const slot of fetched) s.add(formatDayKey(slot.start, mentor.timezone || 'UTC'));
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

                                    <div className="flex gap-3">
                                        <Link to={`/student/mentors?frequency=${encodeURIComponent(frequency)}`}>
                                            <Button variant="outline">Back</Button>
                                        </Link>
                                        {!isPreview && (
                                            <Button
                                                onClick={() => {
                                                    const qs = new URLSearchParams();
                                                    qs.set('frequency', frequency);
                                                    navigate(`/student/book/${mentor.id}?${qs.toString()}`);
                                                }}
                                            >
                                                Book Session
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
                                        <div className="text-xs text-gray-500">per 50 min</div>
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
                                        <div className="font-semibold text-gray-900">No Reviews Yet</div>
                                        <div className="text-sm text-gray-600 mt-1">
                                            {tab === 'REVIEWS'
                                                ? 'This tutor doesn\'t have any reviews yet.'
                                                : 'No external reviews available yet.'}
                                        </div>
                                    </div>
                                </Card>

                                <Card className="p-6">
                                    <h2 className="text-lg font-bold text-gray-900 mb-3">{isPreview ? 'Availability' : 'Book a Session'}</h2>
                                    <div className="text-sm text-gray-600 mb-4">Select a date to see available times (shown in tutor timezone: {mentor.timezone}).</div>

                                    {slotsBusy ? (
                                        <div className="text-sm text-gray-600">Loading availability...</div>
                                    ) : !calendarMeta ? null : (
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
                                                    const isSelected = selectedDayKey === c.dayKey;
                                                    return (
                                                        <button
                                                            key={`${c.dayKey}-${idx}`}
                                                            type="button"
                                                            disabled={!isAvailable}
                                                            onClick={() => setSelectedDayKey(c.dayKey || '')}
                                                            className={`h-10 rounded-lg text-sm border transition-colors ${!isAvailable
                                                                ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                                                : isSelected
                                                                    ? 'bg-purple-600 text-white border-purple-600'
                                                                    : 'bg-white text-gray-900 border-green-300 hover:bg-green-50'}`}
                                                        >
                                                            {c.day}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-gray-600 mt-4">
                                                <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded border border-green-400 bg-white" /> Available</div>
                                                <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded border border-gray-200 bg-gray-50" /> Not available</div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedDayKey && (slotsByDay.get(selectedDayKey) || []).length > 0 && (
                                        <div className="mt-4">
                                            <div className="text-sm font-bold text-gray-900 mb-2">Available times</div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {(slotsByDay.get(selectedDayKey) || []).slice(0, 12).map((s) => (
                                                    <button
                                                        key={s.start}
                                                        type="button"
                                                        className={`px-3 py-2 rounded-lg text-sm border border-gray-200 ${isPreview ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
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
                                                        {formatTimeLabel(s.start, mentor.timezone || 'UTC')}
                                                    </button>
                                                ))}
                                            </div>
                                            {!isPreview && (
                                                <div className="mt-4">
                                                    <Button
                                                        onClick={() => {
                                                            const qs = new URLSearchParams();
                                                            qs.set('frequency', frequency);
                                                            if (selectedDayKey) qs.set('day', selectedDayKey);
                                                            navigate(`/student/book/${mentor.id}?${qs.toString()}`);
                                                        }}
                                                    >
                                                        Continue to Booking
                                                    </Button>
                                                </div>
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
                    </>
                )}
            </div>
        </DashboardLayout>
    );
};

export default StudentMentorPublicProfilePage;
