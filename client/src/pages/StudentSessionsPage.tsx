import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ExternalLink, CreditCard, Clock } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import SessionListCard from '../components/sessions/SessionListCard';
import api from '../api/axios';

type Lesson = {
    id: string;
    tutor_id?: string;
    start_time: string;
    end_time: string;
    duration?: number;
    reschedule_count?: number;
    created_at?: string;
    status: string;
    billing_type?: 'FREE_TRIAL' | 'FREE_INTRO' | 'PAID';
    payment_status?: 'paid' | 'pending' | 'failed' | 'not_required' | 'unknown';
    booking_id?: string | null;
    booking?: {
        id?: string;
        frequency?: 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY' | string | null;
        created_at?: string;
    } | null;
    meeting_link?: string | null;
    google_calendar_html_link?: string | null;
    tutor?: { username?: string | null };
};

const StudentSessionsPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
    const [joinBusyId, setJoinBusyId] = useState<string | null>(null);
    const [joinError, setJoinError] = useState<string>('');
    const [errorModalOpen, setErrorModalOpen] = useState(false);

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
                const bookedAtIso = l.created_at || l.booking?.created_at;
                const bookedAt = bookedAtIso ? new Date(bookedAtIso) : null;
                return {
                    ...l,
                    start,
                    end,
                    startMs: start.getTime(),
                    bookedAt,
                };
            })
            .filter((l) => !Number.isNaN(l.startMs));
    }, [lessons]);

    const studentTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

    const formatBookedOn = (d: Date | null | undefined) => {
        if (!d || Number.isNaN(d.getTime())) return '';
        return d.toLocaleString(undefined, {
            timeZone: studentTimezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const tzOpts = useMemo(() => ({ timeZone: studentTimezone }) as const, [studentTimezone]);

    const formatDateLong = (iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString(undefined, {
            ...tzOpts,
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTimeOnlyRange = (startIso: string, endIso: string) => {
        const s = new Date(startIso);
        const e = new Date(endIso);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—';
        const startTime = s.toLocaleTimeString(undefined, { ...tzOpts, hour: 'numeric', minute: '2-digit', hour12: true });
        const endTime = e.toLocaleTimeString(undefined, { ...tzOpts, hour: 'numeric', minute: '2-digit', hour12: true });
        return `${startTime} – ${endTime}`;
    };

    const durationMinutes = (startIso: string, endIso: string) => {
        const s = new Date(startIso).getTime();
        const e = new Date(endIso).getTime();
        if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 60;
        return Math.max(1, Math.round((e - s) / 60000));
    };

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

    const [payBusyId, setPayBusyId] = useState<string | null>(null);
    const [payError, setPayError] = useState<string>('');

    // Reschedule state
    const [rescheduleTarget, setRescheduleTarget] = useState<Lesson | null>(null);
    const [slots, setSlots] = useState<{ start: string; end: string }[]>([]);
    const [slotsBusy, setSlotsBusy] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<string>('');
    const [rescheduleBusy, setRescheduleBusy] = useState(false);
    const [rescheduleError, setRescheduleError] = useState<string>('');

    const canReschedule = (l: Lesson) => {
        if (tab !== 'upcoming') return false;
        if ((l.status || '').toUpperCase() !== 'BOOKED') return false;
        if ((l.reschedule_count ?? 0) >= 1) return false;
        return new Date(l.start_time).getTime() - Date.now() > 24 * 60 * 60 * 1000;
    };

    const openReschedule = async (l: Lesson) => {
        if (!l.tutor_id) return;
        setRescheduleTarget(l);
        setSelectedSlot('');
        setRescheduleError('');
        setSlots([]);
        setSlotsBusy(true);
        try {
            // Only show slots at least 24h out — the student must still be able to
            // pay within the payment window before the rescheduled session.
            const from = new Date(Date.now() + 24 * 60 * 60 * 1000);
            from.setSeconds(0, 0);
            const to = new Date(from);
            to.setDate(to.getDate() + 30);
            const dur = l.duration || durationMinutes(l.start_time, l.end_time);
            const res = await api.get(`/availability/tutor/${l.tutor_id}/slots`, {
                params: {
                    from: from.toISOString(),
                    to: to.toISOString(),
                    durationMinutes: dur,
                    stepMinutes: dur,
                },
            });
            const fetched: { start: string; end: string }[] = res.data?.slots || [];
            // Drop the slot identical to the current start so the student must pick a different time
            setSlots(fetched.filter((s) => new Date(s.start).getTime() !== new Date(l.start_time).getTime()));
        } catch {
            setRescheduleError('Could not load available times. Please try again.');
        } finally {
            setSlotsBusy(false);
        }
    };

    const submitReschedule = async () => {
        if (!rescheduleTarget || !selectedSlot) return;
        try {
            setRescheduleBusy(true);
            setRescheduleError('');
            const res = await api.patch(`/lessons/${rescheduleTarget.id}/reschedule`, {
                newStart: selectedSlot,
                clientTimezone: studentTimezone,
            });
            const updated = res.data?.lesson;
            if (updated) {
                setLessons((prev) =>
                    prev.map((l) =>
                        l.id === rescheduleTarget.id
                            ? { ...l, start_time: updated.start_time, end_time: updated.end_time, reschedule_count: updated.reschedule_count }
                            : l
                    )
                );
            }
            setRescheduleTarget(null);
        } catch (e: any) {
            setRescheduleError(e?.response?.data?.error || 'Unable to reschedule. Please try again.');
        } finally {
            setRescheduleBusy(false);
        }
    };

    const slotsByDay = useMemo(() => {
        const groups: { day: string; label: string; items: { start: string; end: string }[] }[] = [];
        const map = new Map<string, { label: string; items: { start: string; end: string }[] }>();
        for (const s of slots) {
            const d = new Date(s.start);
            const key = d.toLocaleDateString(undefined, { ...tzOpts, year: 'numeric', month: '2-digit', day: '2-digit' });
            if (!map.has(key)) {
                map.set(key, {
                    label: d.toLocaleDateString(undefined, { ...tzOpts, weekday: 'long', month: 'long', day: 'numeric' }),
                    items: [],
                });
            }
            map.get(key)!.items.push(s);
        }
        for (const [day, value] of map) groups.push({ day, ...value });
        return groups;
    }, [slots, tzOpts]);

    const mapPaymentBadge = (lesson: Lesson) => {
        const billing = (lesson.billing_type || '').toUpperCase();
        const ps = lesson.payment_status;
        const lessonStatus = (lesson.status || '').toUpperCase();

        const pill = 'inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium border';
        if (lessonStatus === 'CANCELLED') {
            return <span className={`${pill} bg-gray-50 text-gray-600 border-gray-200`}>Cancelled</span>;
        }
        if (lessonStatus === 'COMPLETED') {
            return <span className={`${pill} bg-green-50 text-green-700 border-green-200`}>Completed</span>;
        }
        if (lessonStatus === 'MISSED') {
            return <span className={`${pill} bg-red-50 text-red-700 border-red-200`}>Missed</span>;
        }
        if (billing === 'FREE_INTRO') {
            return <span className={`${pill} bg-green-50 text-green-700 border-green-200`}>Free Intro</span>;
        }
        if (billing === 'FREE_TRIAL') {
            return <span className={`${pill} bg-blue-50 text-blue-700 border-blue-200`}>Free Trial</span>;
        }
        if (ps === 'paid') {
            return <span className={`${pill} bg-emerald-50 text-emerald-700 border-emerald-200`}>Paid</span>;
        }
        if (ps === 'failed') {
            return <span className={`${pill} bg-red-50 text-red-700 border-red-200`}>Payment Failed</span>;
        }
        return <span className={`${pill} bg-amber-50 text-amber-700 border-amber-200`}>Payment Pending</span>;
    };

    const needsPayment = (lesson: Lesson) => {
        const ps = lesson.payment_status;
        const st = (lesson.status || '').toUpperCase();
        if (['CANCELLED', 'COMPLETED', 'MISSED'].includes(st)) return false;
        return ps === 'pending'; // 'failed' means the payment window closed — no action available
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
                    <div className="space-y-5">
                        {sorted.map((l) => {
                            const mentorName = l.tutor?.username || 'Mentor';
                            return (
                                <SessionListCard
                                    key={l.id}
                                    otherPersonName={mentorName}
                                    personRoleLabel="Mentor"
                                    dateRowValue={formatDateLong(l.start_time)}
                                    timeRowValue={formatTimeOnlyRange(l.start_time, l.end_time)}
                                    durationMinutes={durationMinutes(l.start_time, l.end_time)}
                                    badge={mapPaymentBadge(l)}
                                    bookedOnLine={l.bookedAt ? formatBookedOn(l.bookedAt) : null}
                                    onCardClick={() => navigate(`/student/sessions/${l.id}`)}
                                    actions={
                                        <>
                                            {needsPayment(l) && tab === 'upcoming' ? (
                                                <Button
                                                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                                                    disabled={payBusyId === l.id}
                                                    onClick={async () => {
                                                        try {
                                                            setPayBusyId(l.id);
                                                            setPayError('');
                                                            const baseUrl = window.location.origin;
                                                            const res = await api.post('/payments/student/booking/pay-next', {
                                                                lessonId: l.id,
                                                                bookingId: l.booking_id || l.booking?.id,
                                                                successUrl: `${baseUrl}/student/sessions/${l.id}`,
                                                                cancelUrl: `${baseUrl}/student/sessions/${l.id}`,
                                                            });
                                                            if (res.data?.url) {
                                                                window.location.href = res.data.url;
                                                            } else {
                                                                setPayError('Failed to start payment – please try again.');
                                                                setErrorModalOpen(true);
                                                            }
                                                        } catch (e: any) {
                                                            setPayError(e?.response?.data?.error || 'Unable to process payment.');
                                                            setErrorModalOpen(true);
                                                        } finally {
                                                            setPayBusyId(null);
                                                        }
                                                    }}
                                                >
                                                    <CreditCard className="w-4 h-4" />
                                                    {payBusyId === l.id ? 'Processing…' : 'Pay Now'}
                                                </Button>
                                            ) : (() => {
                                                const startMs = new Date(l.start_time).getTime();
                                                const nowMs2 = Date.now();
                                                const isJoinable = nowMs2 >= startMs - 15 * 60 * 1000 && nowMs2 <= startMs + 50 * 60 * 1000 && !['COMPLETED', 'CANCELLED', 'MISSED'].includes(l.status.toUpperCase());
                                                if (!isJoinable) return null;
                                                return (
                                                    <>
                                                        <Button
                                                            className="flex items-center gap-2"
                                                            disabled={joinBusyId === l.id}
                                                            onClick={async () => {
                                                                try {
                                                                    setJoinBusyId(l.id);
                                                                    setJoinError('');
                                                                    const res = await api.get(`/lessons/${l.id}/join`);
                                                                    const url = res.data?.meeting_link as string | undefined;
                                                                    if (url) {
                                                                        window.open(url, '_blank');
                                                                    } else {
                                                                        setJoinError('Meeting link is not available yet.');
                                                                        setErrorModalOpen(true);
                                                                    }
                                                                } catch (e: any) {
                                                                    setJoinError(e?.response?.data?.error || 'Unable to join session.');
                                                                    setErrorModalOpen(true);
                                                                } finally {
                                                                    setJoinBusyId(null);
                                                                }
                                                            }}
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                            {joinBusyId === l.id ? 'Joining…' : 'Join Session'}
                                                        </Button>
                                                        <a href={`/student/whiteboard?lesson=${l.id}`} target="_blank" rel="noreferrer">
                                                            <Button variant="outline" className="flex items-center gap-2">
                                                                <ExternalLink className="w-4 h-4" />
                                                                Open Whiteboard
                                                            </Button>
                                                        </a>
                                                    </>
                                                );
                                            })()}
                                            {canReschedule(l) ? (
                                                <Button
                                                    variant="outline"
                                                    className="flex items-center gap-2"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openReschedule(l);
                                                    }}
                                                >
                                                    <Clock className="w-4 h-4" />
                                                    Reschedule
                                                </Button>
                                            ) : null}
                                            {l.google_calendar_html_link ? (
                                                <a href={l.google_calendar_html_link} target="_blank" rel="noreferrer">
                                                    <Button variant="outline">Open in Calendar</Button>
                                                </a>
                                            ) : null}
                                        </>
                                    }
                                />
                            );
                        })}
                    </div>
                )}
            </div>
            <Modal
                isOpen={errorModalOpen}
                onClose={() => setErrorModalOpen(false)}
                title="Error"
            >
                <p>{joinError || payError}</p>
            </Modal>

            <Modal
                isOpen={!!rescheduleTarget}
                onClose={() => setRescheduleTarget(null)}
                title="Reschedule Session"
            >
                {rescheduleTarget ? (
                    <div className="space-y-4">
                        <div className="text-sm text-gray-600">
                            Current time: <strong>{formatDateLong(rescheduleTarget.start_time)}</strong>,{' '}
                            {formatTimeOnlyRange(rescheduleTarget.start_time, rescheduleTarget.end_time)}
                        </div>
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                            A session can only be rescheduled once, and only more than 24 hours before it starts.
                        </p>

                        {slotsBusy ? (
                            <div className="text-sm text-gray-600">Loading available times…</div>
                        ) : slotsByDay.length === 0 ? (
                            <div className="text-sm text-gray-600">
                                No open times in the next 30 days. Please check back later.
                            </div>
                        ) : (
                            <div className="max-h-72 overflow-y-auto space-y-4 pr-1">
                                {slotsByDay.map((group) => (
                                    <div key={group.day}>
                                        <div className="text-sm font-semibold text-gray-800 mb-2">{group.label}</div>
                                        <div className="flex flex-wrap gap-2">
                                            {group.items.map((s) => {
                                                const active = selectedSlot === s.start;
                                                return (
                                                    <button
                                                        key={s.start}
                                                        type="button"
                                                        onClick={() => setSelectedSlot(s.start)}
                                                        className={`px-3 py-1.5 rounded-md border text-sm ${
                                                            active
                                                                ? 'bg-[#4A1D96] text-white border-[#4A1D96]'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:border-[#4A1D96]'
                                                        }`}
                                                    >
                                                        {new Date(s.start).toLocaleTimeString(undefined, {
                                                            ...tzOpts,
                                                            hour: 'numeric',
                                                            minute: '2-digit',
                                                            hour12: true,
                                                        })}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {rescheduleError ? <p className="text-sm text-red-600">{rescheduleError}</p> : null}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setRescheduleTarget(null)} disabled={rescheduleBusy}>
                                Cancel
                            </Button>
                            <Button onClick={submitReschedule} disabled={!selectedSlot || rescheduleBusy}>
                                {rescheduleBusy ? 'Rescheduling…' : 'Confirm New Time'}
                            </Button>
                        </div>
                    </div>
                ) : null}
            </Modal>
        </DashboardLayout>
    );
};

export default StudentSessionsPage;

