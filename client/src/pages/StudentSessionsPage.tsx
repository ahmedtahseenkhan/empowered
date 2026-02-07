import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import api from '../api/axios';

type Lesson = {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    billing_type?: 'FREE_TRIAL' | 'PAID';
    booking?: { frequency?: 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY' | string | null } | null;
    meeting_link?: string | null;
    google_calendar_html_link?: string | null;
    tutor?: { username?: string | null };
};

const StudentSessionsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

    useEffect(() => {
        const fetchLessons = async () => {
            try {
                const from = new Date();
                from.setDate(from.getDate() - 60);
                from.setHours(0, 0, 0, 0);

                const to = new Date();
                to.setDate(to.getDate() + 120);
                to.setHours(23, 59, 59, 999);

                const res = await api.get('/lessons/me', {
                    params: { from: from.toISOString(), to: to.toISOString() },
                });

                setLessons(res.data?.lessons || []);
            } catch (e) {
                console.error('Failed to fetch student lessons', e);
                setLessons([]);
            } finally {
                setLoading(false);
            }
        };

        fetchLessons();
    }, []);

    const nowMs = Date.now();

    const enhanced = useMemo(() => {
        return lessons
            .map((l) => {
                const start = new Date(l.start_time);
                const end = new Date(l.end_time);
                return {
                    ...l,
                    start,
                    end,
                    startMs: start.getTime(),
                };
            })
            .filter((l) => !Number.isNaN(l.startMs));
    }, [lessons]);

    const filtered = useMemo(() => {
        if (tab === 'upcoming') {
            return enhanced.filter((l) => l.startMs >= nowMs);
        }
        return enhanced.filter((l) => l.startMs < nowMs);
    }, [enhanced, tab, nowMs]);

    const sorted = useMemo(() => {
        const copy = [...filtered];
        copy.sort((a, b) => (tab === 'upcoming' ? a.startMs - b.startMs : b.startMs - a.startMs));
        return copy;
    }, [filtered, tab]);

    const formatRange = (startIso: string, endIso: string) => {
        const s = new Date(startIso);
        const e = new Date(endIso);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—';
        return `${s.toLocaleString()} – ${e.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    };

    const mapStatusToBadge = (status: string) => {
        const normalized = status.toUpperCase();
        if (normalized === 'COMPLETED') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700 border border-green-200">
                    Completed
                </span>
            );
        }
        if (normalized === 'PENDING') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    Pending
                </span>
            );
        }
        if (normalized === 'CANCELLED') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-600 border border-gray-200">
                    Cancelled
                </span>
            );
        }
        if (normalized === 'MISSED') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                    Missed
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                {status}
            </span>
        );
    };

    const mapBillingToBadge = (lesson: Lesson & { start?: Date; booking?: Lesson['booking'] }) => {
        const billing = (lesson.billing_type || '').toUpperCase();
        const freq = lesson.booking?.frequency;

        if (billing === 'FREE_TRIAL') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Free Trial
                </span>
            );
        }

        if (freq && freq !== 'ONCE') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                    Subscription
                </span>
            );
        }

        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Paid Session
            </span>
        );
    };

    return (
        <DashboardLayout>
            <div className="w-full">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-[#4A1D96]" />
                            <h1 className="text-3xl font-bold text-gray-900">My Sessions</h1>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                            View all your upcoming and past sessions in one place.
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 mb-4">
                    <Button variant={tab === 'upcoming' ? 'primary' : 'outline'} onClick={() => setTab('upcoming')}>
                        Upcoming
                    </Button>
                    <Button variant={tab === 'past' ? 'primary' : 'outline'} onClick={() => setTab('past')}>
                        Completed & Past
                    </Button>
                </div>

                {loading ? (
                    <Card className="p-6">
                        <div className="text-sm text-gray-600">Loading sessions...</div>
                    </Card>
                ) : sorted.length === 0 ? (
                    <Card className="p-6">
                        <div className="text-sm text-gray-700 font-semibold">No sessions</div>
                        <div className="text-sm text-gray-600 mt-1">
                            Once you book with a mentor, your sessions will appear here.
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {sorted.map((l) => (
                            <Card key={l.id} className="p-6">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {mapStatusToBadge(l.status)}
                                            {mapBillingToBadge(l as any)}
                                            <span className="text-xs text-gray-500">
                                                with {l.tutor?.username || 'Mentor'}
                                            </span>
                                        </div>
                                        <div className="text-lg font-bold text-gray-900 mt-2">
                                            {l.start.toLocaleDateString(undefined, {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </div>
                                        <div className="text-sm text-gray-700 mt-1">
                                            {formatRange(l.start_time, l.end_time)}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 sm:flex-col">
                                        {l.meeting_link ? (
                                            <a href={l.meeting_link} target="_blank" rel="noreferrer">
                                                <Button className="w-full flex items-center gap-2">
                                                    <ExternalLink className="w-4 h-4" />
                                                    Join Session
                                                </Button>
                                            </a>
                                        ) : (
                                            <Button className="w-full" disabled>
                                                Join Session
                                            </Button>
                                        )}
                                        {l.google_calendar_html_link ? (
                                            <a href={l.google_calendar_html_link} target="_blank" rel="noreferrer">
                                                <Button variant="outline" className="w-full">
                                                    Open in Calendar
                                                </Button>
                                            </a>
                                        ) : null}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default StudentSessionsPage;

