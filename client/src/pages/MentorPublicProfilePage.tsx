import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Star, MapPin, Clock, Users, BadgeCheck, Briefcase, GraduationCap, Award,
    Share2, Check, ChevronLeft, ChevronRight, Calendar, BookOpen, Zap, Video
} from 'lucide-react';
import { PageLayout } from '../layouts/PageLayout';
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
    marketing_video_url: string | null;
    profile_photo: string | null;
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
    external_reviews?: {
        id: string;
        platform: string;
        reviewer: string;
        rating: number;
        comment: string | null;
        date: string | null;
    }[];
};

const MentorPublicProfilePage: React.FC = () => {
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

    const [reviews, setReviews] = useState<any[]>([]);

    useEffect(() => {
        const fetchMentor = async () => {
            try {
                setLoading(true);
                setError('');
                const res = await api.get(`/tutor/public/${id}`);
                setMentor(res.data.mentor);

                // Fetch Reviews
                const reviewRes = await api.get(`/reviews/tutor/${id}`);
                setReviews(reviewRes.data.reviews || []);
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
        return new Intl.DateTimeFormat(undefined, { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
    };

    // Helper: extract YouTube video ID
    const extractYouTubeId = (url: string): string | null => {
        const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(youtubeRegex);
        return match ? match[1] : null;
    };

    // Helper: extract Vimeo video ID
    const extractVimeoId = (url: string): string | null => {
        const vimeoRegex = /vimeo\.com\/(\d+)/;
        const match = url.match(vimeoRegex);
        return match ? match[1] : null;
    };

    // Helper: render appropriate video player based on URL type
    const renderVideoPlayer = (videoUrl: string) => {
        const youtubeId = extractYouTubeId(videoUrl);
        const vimeoId = extractVimeoId(videoUrl);

        if (youtubeId) {
            return (
                <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="rounded-xl"
                />
            );
        }

        if (vimeoId) {
            return (
                <iframe
                    src={`https://player.vimeo.com/video/${vimeoId}`}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    className="rounded-xl"
                />
            );
        }

        // Direct video file
        return (
            <video src={videoUrl} controls className="w-full h-full rounded-xl" />
        );
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
                        durationMinutes: 60,
                        stepMinutes: 60,
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

    const [copied, setCopied] = useState(false);

    const displayCount = reviews.length;
    const displayRating = reviews.length
        ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
        : (mentor?.rating ? mentor.rating.toFixed(1) : '—');

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // ignore
        }
    };

    return (
        <PageLayout>
            {/* ── Loading / Error ── */}
            {loading && (
                <div className="max-w-5xl mx-auto px-4 py-20 text-center">
                    <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-900 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">Loading profile…</p>
                </div>
            )}
            {!loading && error && (
                <div className="max-w-5xl mx-auto px-4 py-12">
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
                </div>
            )}

            {!loading && mentor && (
                <>
                    {/* ── Hero Banner ── */}
                    <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-secondary-600 text-white">
                        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                            {/* Back link */}
                            <Link
                                to={`/mentors?frequency=${encodeURIComponent(frequency)}`}
                                className="inline-flex items-center gap-1.5 text-primary-200 hover:text-white text-sm mb-6 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Back to Mentors
                            </Link>

                            <div className="flex flex-col sm:flex-row items-start gap-6">
                                {/* Avatar */}
                                {mentor.profile_photo ? (
                                    <img
                                        src={mentor.profile_photo}
                                        alt={mentor.username}
                                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-white/30 flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/20 border-2 border-white/30 backdrop-blur flex items-center justify-center text-3xl font-extrabold text-white flex-shrink-0">
                                        {mentor.username.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    {/* Name + badges */}
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h1 className="text-2xl sm:text-3xl font-extrabold">{mentor.username}</h1>
                                        {mentor.is_verified && (
                                            <span className="inline-flex items-center gap-1 text-xs bg-white/20 border border-white/30 px-2.5 py-0.5 rounded-full font-medium">
                                                <BadgeCheck className="w-3 h-3" /> Verified
                                            </span>
                                        )}
                                        <span className="text-xs bg-white/15 border border-white/20 px-2.5 py-0.5 rounded-full">
                                            {mentor.tier}
                                        </span>
                                    </div>

                                    {mentor.tagline && (
                                        <p className="text-primary-100 text-base mb-2">{mentor.tagline}</p>
                                    )}

                                    <div className="flex flex-wrap items-center gap-4 text-sm text-primary-200">
                                        {mentor.country && (
                                            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{mentor.country}</span>
                                        )}
                                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{mentor.timezone}</span>
                                    </div>
                                </div>

                                {/* Share button */}
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/30 bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium flex-shrink-0"
                                >
                                    {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Share2 className="w-4 h-4" /> Share Profile</>}
                                </button>
                            </div>

                            {/* Stats bar */}
                            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Rating', value: displayRating, sub: `${displayCount} review${displayCount !== 1 ? 's' : ''}`, icon: <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" /> },
                                    { label: 'Experience', value: `${mentor.experience_years || 0}`, sub: 'years', icon: <Briefcase className="w-4 h-4 text-primary-200" /> },
                                    { label: 'Students', value: `${mentor.total_students || 0}`, sub: 'taught', icon: <Users className="w-4 h-4 text-primary-200" /> },
                                    { label: 'Rate', value: `$${mentor.hourly_rate}`, sub: 'per session', icon: <Zap className="w-4 h-4 text-accent-300" /> },
                                ].map(s => (
                                    <div key={s.label} className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 border border-white/10">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            {s.icon}
                                            <span className="text-xs text-primary-200">{s.label}</span>
                                        </div>
                                        <div className="text-xl font-extrabold">{s.value}</div>
                                        <div className="text-[11px] text-primary-300">{s.sub}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Body ── */}
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">

                            {/* ── Left column ── */}
                            <div className="lg:col-span-2 space-y-6">

                                {/* Marketing / Intro Video — shown above About Me */}
                                {mentor.marketing_video_url && (
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <Video className="w-4 h-4 text-primary-700" /> Introduction Video
                                        </h2>
                                        <div className="aspect-video rounded-xl overflow-hidden bg-black">
                                            {renderVideoPlayer(mentor.marketing_video_url)}
                                        </div>
                                    </div>
                                )}

                                {/* About */}
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                    <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-primary-700" /> About Me
                                    </h2>
                                    <p className="text-gray-700 text-sm whitespace-pre-line leading-relaxed">
                                        {mentor.about || 'No description added yet.'}
                                    </p>

                                    {strengths.length > 0 && (
                                        <div className="mt-5">
                                            <div className="text-sm font-semibold text-gray-900 mb-2">Key Strengths</div>
                                            <div className="flex flex-wrap gap-2">
                                                {strengths.map(s => (
                                                    <span key={s} className="text-xs bg-primary-50 text-primary-800 border border-primary-100 px-3 py-1 rounded-full">
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {mentor.student_levels && mentor.student_levels.length > 0 && (
                                        <div className="mt-5">
                                            <div className="text-sm font-semibold text-gray-900 mb-2">Student Levels</div>
                                            <div className="flex flex-wrap gap-2">
                                                {(mentor.student_levels as string[]).map(id => {
                                                    const labels: Record<string, string> = {
                                                        ELEMENTARY_SCHOOL: 'Elementary School',
                                                        MIDDLE_SCHOOL: 'Middle School',
                                                        HIGH_SCHOOL: 'High School',
                                                        COLLEGE_ADULT: 'College & Adult',
                                                    };
                                                    return (
                                                        <span key={id} className="text-xs bg-secondary-50 text-secondary-800 border border-secondary-100 px-3 py-1 rounded-full">
                                                            {labels[id] || id}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Expertise */}
                                {categoryGroups.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                        <h2 className="text-lg font-bold text-gray-900 mb-4">Areas of Expertise</h2>
                                        <div className="space-y-4">
                                            {categoryGroups.map(g => (
                                                <div key={g.group} className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
                                                    <div className="font-bold text-purple-900 mb-3">{g.group}</div>
                                                    <div className="space-y-3">
                                                        {g.subs.map(s => (
                                                            <div key={`${g.group}-${s.sub}`}>
                                                                <div className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">{s.sub}</div>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {s.items.map(item => (
                                                                        <span key={item} className="text-xs bg-white text-gray-700 border border-gray-200 px-2.5 py-1 rounded-full shadow-sm">
                                                                            {item}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Availability */}
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-primary-700" /> Availability
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-4">Times shown in tutor timezone: <span className="font-medium text-gray-700">{mentor.timezone}</span></p>

                                    {slotsBusy ? (
                                        <div className="h-8 flex items-center text-xs text-gray-400">Loading…</div>
                                    ) : calendarMeta && (
                                        <>
                                            <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                                                    <span className="text-sm font-semibold text-gray-800">{calendarMeta.monthLabel}</span>
                                                    <div className="flex items-center gap-1">
                                                        <button type="button" onClick={() => setMonthOffset(v => v - 1)} className="p-1 rounded hover:bg-gray-200 transition-colors">
                                                            <ChevronLeft className="w-4 h-4 text-gray-600" />
                                                        </button>
                                                        <button type="button" onClick={() => setMonthOffset(v => v + 1)} className="p-1 rounded hover:bg-gray-200 transition-colors">
                                                            <ChevronRight className="w-4 h-4 text-gray-600" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-3">
                                                    <div className="grid grid-cols-7 text-[10px] text-gray-400 text-center mb-2">
                                                        {['S','M','T','W','T','F','S'].map((d, i) => <div key={i}>{d}</div>)}
                                                    </div>
                                                    <div className="grid grid-cols-7 gap-1">
                                                        {calendarMeta.cells.map((c, idx) => {
                                                            if (!c.day || !c.dayKey) return <div key={idx} className="h-8" />;
                                                            const isAvail = availableDayKeys.has(c.dayKey);
                                                            const isSel = selectedDayKey === c.dayKey;
                                                            return (
                                                                <button
                                                                    key={`${c.dayKey}-${idx}`}
                                                                    type="button"
                                                                    disabled={!isAvail}
                                                                    onClick={() => setSelectedDayKey(c.dayKey || '')}
                                                                    className={`h-8 rounded-lg text-xs font-medium transition-colors ${
                                                                        !isAvail
                                                                            ? 'text-gray-300 cursor-not-allowed'
                                                                            : isSel
                                                                                ? 'bg-primary-900 text-white'
                                                                                : 'text-gray-800 bg-green-50 border border-green-200 hover:bg-green-100'
                                                                    }`}
                                                                >
                                                                    {c.day}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 px-3 pb-3 text-[10px] text-gray-500">
                                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-green-300 bg-green-50 inline-block" />Available</span>
                                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-gray-100 bg-white inline-block" />Unavailable</span>
                                                </div>
                                            </div>

                                            {selectedDayKey && (slotsByDay.get(selectedDayKey) || []).length > 0 && (
                                                <div className="mt-4">
                                                    <div className="text-xs font-semibold text-gray-800 mb-2">Available times</div>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {(slotsByDay.get(selectedDayKey) || []).slice(0, 8).map(s => (
                                                            <button
                                                                key={s.start}
                                                                type="button"
                                                                disabled={isPreview}
                                                                className={`px-2 py-1.5 rounded-lg text-xs border font-medium transition-colors ${
                                                                    isPreview
                                                                        ? 'bg-gray-50 text-gray-300 border-gray-100'
                                                                        : 'bg-white border-gray-200 hover:border-primary-400 hover:text-primary-800'
                                                                }`}
                                                                onClick={() => {
                                                                    if (isPreview) return;
                                                                    const qs = new URLSearchParams();
                                                                    qs.set('frequency', frequency);
                                                                    qs.set('day', selectedDayKey);
                                                                    qs.set('slotStart', s.start);
                                                                    navigate(`/book/${mentor.id}?${qs.toString()}`);
                                                                }}
                                                            >
                                                                {formatTimeLabel(s.start, mentor.timezone || 'UTC')}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {!isPreview && (
                                                        <Button
                                                            size="sm"
                                                            className="w-full mt-3"
                                                            onClick={() => {
                                                                const qs = new URLSearchParams();
                                                                qs.set('frequency', frequency);
                                                                if (selectedDayKey) qs.set('day', selectedDayKey);
                                                                navigate(`/book/${mentor.id}?${qs.toString()}`);
                                                            }}
                                                        >
                                                            Continue to Booking
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Reviews */}
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                    <div className="flex items-center justify-between gap-4 mb-5">
                                        <h2 className="text-lg font-bold text-gray-900">Reviews</h2>
                                        <div className="flex items-center gap-1.5">
                                            {(['REVIEWS', 'EXTERNAL'] as const).map(t => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => setTab(t)}
                                                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                                                        tab === t
                                                            ? 'bg-primary-900 text-white border-primary-900'
                                                            : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {t === 'REVIEWS' ? 'Platform Reviews' : 'External Reviews'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {tab === 'REVIEWS' && (
                                        <div className="space-y-4">
                                            {reviews && reviews.length > 0 ? reviews.map((r: any) => (
                                                <div key={r.id} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-800">
                                                                {r.student.username.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-semibold text-gray-900">{r.student.username}</div>
                                                                <div className="flex items-center gap-0.5 mt-0.5">
                                                                    {[1,2,3,4,5].map(i => (
                                                                        <Star key={i} className={`w-3 h-3 ${i <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    {r.comment && <p className="text-sm text-gray-600 mt-2 ml-11">{r.comment}</p>}
                                                </div>
                                            )) : (
                                                <div className="text-center py-8 text-gray-400 text-sm">No reviews yet.</div>
                                            )}
                                        </div>
                                    )}

                                    {tab === 'EXTERNAL' && (
                                        <div className="space-y-4">
                                            {mentor.external_reviews && mentor.external_reviews.length > 0 ? mentor.external_reviews.map(r => (
                                                <div key={r.id} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-sm font-bold text-blue-600">
                                                                {r.reviewer?.charAt(0)?.toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-semibold text-gray-900">{r.reviewer}</div>
                                                                <div className="text-[10px] text-gray-400">via {r.platform}</div>
                                                                <div className="flex items-center gap-0.5 mt-0.5">
                                                                    {[1,2,3,4,5].map(i => (
                                                                        <Star key={i} className={`w-3 h-3 ${i <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {r.date && <span className="text-xs text-gray-400">{new Date(r.date).toLocaleDateString()}</span>}
                                                    </div>
                                                    {r.comment && <p className="text-sm text-gray-600 mt-2 ml-11">{r.comment}</p>}
                                                </div>
                                            )) : (
                                                <div className="text-center py-8 text-gray-400 text-sm">No external reviews yet.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Right sticky column ── */}
                            <div className="lg:col-span-1">
                                <div className="sticky top-24 space-y-5">

                                    {/* Booking card */}
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                        <div className="bg-gradient-to-r from-primary-900 to-primary-700 px-5 py-4">
                                            <div className="text-white text-2xl font-extrabold">${mentor.hourly_rate}</div>
                                            <div className="text-primary-200 text-xs mt-0.5">per 60-minute session</div>
                                        </div>

                                        <div className="p-5">
                                            {mentor.free_session_enabled && (
                                                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
                                                    <BadgeCheck className="w-3.5 h-3.5 flex-shrink-0" />
                                                    Free intro session available
                                                </div>
                                            )}

                                            {!isPreview ? (
                                                <Button
                                                    onClick={() => {
                                                        const qs = new URLSearchParams();
                                                        qs.set('frequency', frequency);
                                                        navigate(`/book/${mentor.id}?${qs.toString()}`);
                                                    }}
                                                    className="w-full"
                                                    size="lg"
                                                >
                                                    Book a Session
                                                </Button>
                                            ) : (
                                                <div className="text-center py-2 text-sm text-gray-400 italic">Preview mode — booking disabled</div>
                                            )}

                                            <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 leading-relaxed">
                                                Charged weekly based on your selected time slots. Cancel upcoming payments before your next billing date.
                                            </div>
                                        </div>
                                    </div>

                                    {/* Professional Experience */}
                                    {mentor.experience?.length > 0 && (
                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                <Briefcase className="w-4 h-4 text-primary-700" /> Professional Experience
                                            </h3>
                                            <div className="space-y-4">
                                                {mentor.experience
                                                    .slice().sort((a, b) => b.start_year - a.start_year)
                                                    .map(e => (
                                                        <div key={e.id} className="relative pl-4 before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:rounded-full before:bg-primary-400 before:content-['']">
                                                            <div className="font-semibold text-gray-900 text-sm">{e.role || 'Not Added Yet'}</div>
                                                            <div className="text-xs text-gray-500 mt-0.5">{e.company} · {e.start_year}{e.end_year ? ` – ${e.end_year}` : ' – Present'}</div>
                                                            {e.description && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{e.description}</p>}
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Education */}
                                    {mentor.education?.length > 0 && (
                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                <GraduationCap className="w-4 h-4 text-primary-700" /> Education
                                            </h3>
                                            <div className="space-y-3">
                                                {mentor.education
                                                    .slice().sort((a, b) => (b.year || 0) - (a.year || 0))
                                                    .map(ed => (
                                                        <div key={ed.id} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                                            <div className="font-semibold text-gray-900 text-sm">{ed.institution || 'N/A'}</div>
                                                            <div className="text-xs text-gray-600 mt-0.5">{ed.degree}{ed.field_of_study ? ` · ${ed.field_of_study}` : ''}</div>
                                                            {ed.year && <div className="text-xs text-gray-400 mt-0.5">Class of {ed.year}</div>}
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Certifications */}
                                    {mentor.certifications?.length > 0 && (
                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                <Award className="w-4 h-4 text-primary-700" /> Certifications
                                            </h3>
                                            <div className="space-y-3">
                                                {mentor.certifications.map(c => (
                                                    <div key={c.id} className="flex items-start justify-between gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                                        <div>
                                                            <div className="font-semibold text-gray-900 text-sm">{c.name}</div>
                                                            <div className="text-xs text-gray-500 mt-0.5">{c.issuer} · {c.year}</div>
                                                        </div>
                                                        {c.is_verified ? (
                                                            <span className="flex items-center gap-1 text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                <BadgeCheck className="w-3 h-3" /> Verified
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick share */}
                                    <button
                                        type="button"
                                        onClick={handleShare}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                                    >
                                        {copied ? <><Check className="w-4 h-4 text-green-500" /> Link copied!</> : <><Share2 className="w-4 h-4" /> Share this profile</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </PageLayout>
    );
};
export default MentorPublicProfilePage;
