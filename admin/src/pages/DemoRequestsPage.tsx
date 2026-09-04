import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { CalendarClock, ChevronLeft, ChevronRight, Mail, Phone, Video } from 'lucide-react';

type DemoBooking = {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    category_alignment: string;
    experience_years: string;
    income_status: string;
    looking_for: string;
    slot_start_time: string;
    slot_end_time: string;
    timezone: string;
    created_at: string;
    meeting_link?: string | null;
    rescheduled_at?: string | null;
};

const DALLAS_TZ = 'America/Chicago';

function formatInDallas(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { timeZone: DALLAS_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function getDallasDateKey(iso: string): string {
    const d = new Date(iso);
    const year = d.toLocaleString('en-US', { timeZone: DALLAS_TZ, year: 'numeric' });
    const month = d.toLocaleString('en-US', { timeZone: DALLAS_TZ, month: 'numeric' });
    const day = d.toLocaleString('en-US', { timeZone: DALLAS_TZ, day: 'numeric' });
    return `${year}-${Number(month) - 1}-${day}`;
}

function getDallasHour(iso: string): number {
    const d = new Date(iso);
    const hour = d.toLocaleString('en-US', { timeZone: DALLAS_TZ, hour: 'numeric', hour12: false });
    return parseInt(hour, 10);
}

type DemoSlot = { start: string; end: string };

function formatDayInDallas(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { timeZone: DALLAS_TZ, weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTimeInDallas(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', { timeZone: DALLAS_TZ, hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Minutes to add to a Dallas wall-clock value (read as UTC) to get the real UTC instant. */
function dallasOffsetMinutes(at: Date): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: DALLAS_TZ,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at).reduce<Record<string, number>>((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = Number(part.value);
        return acc;
    }, {});
    const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
    return (at.getTime() - asUTC) / 60000;
}

/** Convert a datetime-local value the admin typed (Dallas time) into a UTC ISO string. */
function dallasLocalToISO(local: string): string | null {
    const [datePart, timePart] = local.split('T');
    if (!datePart || !timePart) return null;
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
    const guess = Date.UTC(y, m - 1, d, hh, mm);
    const firstOffset = dallasOffsetMinutes(new Date(guess));
    let ts = guess + firstOffset * 60000;
    const secondOffset = dallasOffsetMinutes(new Date(ts));
    if (secondOffset !== firstOffset) ts = guess + secondOffset * 60000;
    return new Date(ts).toISOString();
}

function parseLookingFor(looking_for: string): string[] {
    try {
        const parsed = JSON.parse(looking_for);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

const DemoRequestsPage: React.FC = () => {
    const [bookings, setBookings] = useState<DemoBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'week' | 'list'>('week');
    const [selectedBooking, setSelectedBooking] = useState<DemoBooking | null>(null);
    const [weekStart, setWeekStart] = useState(() => {
        const d = new Date();
        const day = d.getDay();
        const diffToMonday = (day + 6) % 7;
        const start = new Date(d);
        start.setDate(d.getDate() - diffToMonday);
        start.setHours(0, 0, 0, 0);
        return start;
    });

    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [slots, setSlots] = useState<DemoSlot[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [slotDay, setSlotDay] = useState('');
    const [chosenSlot, setChosenSlot] = useState('');
    const [outsideHours, setOutsideHours] = useState(false);
    const [customTime, setCustomTime] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [rescheduleError, setRescheduleError] = useState<string | null>(null);
    const [rescheduledMsg, setRescheduledMsg] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const closeModal = () => {
        setSelectedBooking(null);
        setRescheduleOpen(false);
        setRescheduleError(null);
        setRescheduledMsg(null);
        setChosenSlot('');
        setCustomTime('');
        setNote('');
        setOutsideHours(false);
    };

    useEffect(() => {
        const from = new Date(weekStart);
        from.setDate(from.getDate() - 14);
        from.setHours(0, 0, 0, 0);
        const to = new Date(weekStart);
        to.setDate(to.getDate() + 21);
        to.setHours(23, 59, 59, 999);
        setLoading(true);
        api.get('/admin/demo-bookings', { params: { from: from.toISOString(), to: to.toISOString() } })
            .then((res) => setBookings(res.data?.bookings || []))
            .catch(() => setBookings([]))
            .finally(() => setLoading(false));
    }, [weekStart, reloadKey]);

    // Open slots for the reschedule picker (next 28 days), keeping this booking's own slot selectable.
    useEffect(() => {
        if (!rescheduleOpen || !selectedBooking) return;
        const from = new Date();
        from.setHours(0, 0, 0, 0);
        const to = new Date(from);
        to.setDate(to.getDate() + 28);
        setSlotsLoading(true);
        api.get('/admin/demo-slots', {
            params: { from: from.toISOString(), to: to.toISOString(), exclude_booking_id: selectedBooking.id },
        })
            .then((res) => setSlots(res.data?.slots || []))
            .catch(() => setSlots([]))
            .finally(() => setSlotsLoading(false));
    }, [rescheduleOpen, selectedBooking]);

    const slotsByDay = useMemo(() => {
        const map = new Map<string, DemoSlot[]>();
        slots.forEach((slot) => {
            const key = formatDayInDallas(slot.start);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(slot);
        });
        return map;
    }, [slots]);

    const slotDays = useMemo(() => Array.from(slotsByDay.keys()), [slotsByDay]);

    useEffect(() => {
        if (slotDays.length > 0 && !slotDays.includes(slotDay)) setSlotDay(slotDays[0]);
    }, [slotDays, slotDay]);

    const submitReschedule = async () => {
        if (!selectedBooking) return;
        const slotStart = outsideHours ? dallasLocalToISO(customTime) : chosenSlot;
        if (!slotStart) {
            setRescheduleError(outsideHours ? 'Enter a new date and time.' : 'Pick a new slot.');
            return;
        }
        setSaving(true);
        setRescheduleError(null);
        try {
            const res = await api.patch(`/admin/demo-bookings/${selectedBooking.id}/reschedule`, {
                slot_start_time: slotStart,
                allow_outside_hours: outsideHours,
                note: note.trim(),
            });
            const updated: DemoBooking = res.data.booking;
            setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
            setSelectedBooking(updated);
            setRescheduleOpen(false);
            setChosenSlot('');
            setCustomTime('');
            setNote('');
            setOutsideHours(false);
            setRescheduledMsg(`Moved to ${formatInDallas(updated.slot_start_time)}. ${updated.full_name} has been emailed the new time.`);
            setReloadKey((k) => k + 1);
        } catch (e) {
            const message = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setRescheduleError(message || 'Could not reschedule this demo call.');
        } finally {
            setSaving(false);
        }
    };

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return d;
        });
    }, [weekStart]);

    const weekBookings = useMemo(() => {
        const weekKeys = new Set(weekDays.map((d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`));
        return bookings.filter((b) => weekKeys.has(getDallasDateKey(b.slot_start_time)));
    }, [bookings, weekDays]);

    const bookingsByDay = useMemo(() => {
        const map = new Map<string, DemoBooking[]>();
        weekBookings.forEach((b) => {
            const key = getDallasDateKey(b.slot_start_time);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(b);
        });
        weekDays.forEach((d) => {
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!map.has(key)) map.set(key, []);
        });
        return map;
    }, [weekBookings, weekDays]);

    const startHour = 9;
    const endHour = 17;
    const hourHeight = 48;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Demo Requests</h1>
                    <p className="text-gray-600 mt-1">All demo call bookings. Manage availability in Demo Availability.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setViewMode('week')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${viewMode === 'week' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}
                    >
                        Calendar
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${viewMode === 'list' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}
                    >
                        List
                    </button>
                </div>
            </div>

            {viewMode === 'week' && (
                <>
                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                        <button
                            type="button"
                            onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}
                            className="p-2 rounded-lg hover:bg-gray-100"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-semibold text-gray-900">
                            {weekDays[0].toLocaleDateString('en-US', { month: 'long' })} {weekDays[0].getDate()} – {weekDays[6].toLocaleDateString('en-US', { month: 'long' })} {weekDays[6].getDate()}, {weekStart.getFullYear()}
                        </span>
                        <button
                            type="button"
                            onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}
                            className="p-2 rounded-lg hover:bg-gray-100"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">Loading...</div>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                            <div className="min-w-[640px]">
                            <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
                                <div className="p-2 text-xs font-medium text-gray-500">Time</div>
                                {weekDays.map((d) => (
                                    <div key={d.toISOString()} className="p-2 border-l border-gray-200 text-center">
                                        <div className="text-xs font-semibold text-gray-700">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                        <div className="text-xs text-gray-500">{d.getDate()}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-8" style={{ minHeight: (endHour - startHour) * hourHeight }}>
                                {Array.from({ length: endHour - startHour }, (_, i) => {
                                    const hour = startHour + i;
                                    return (
                                        <React.Fragment key={hour}>
                                            <div className="border-b border-gray-100 p-1 text-xs text-gray-500" style={{ height: hourHeight }}>
                                                {new Date(2000, 0, 1, hour).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}
                                            </div>
                                            {weekDays.map((day) => {
                                                const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                                                const dayBookings = (bookingsByDay.get(key) || []).filter((b) => getDallasHour(b.slot_start_time) === hour);
                                                return (
                                                    <div key={`${key}-${hour}`} className="border-l border-b border-gray-100 p-1" style={{ height: hourHeight }}>
                                                        {dayBookings.map((b) => (
                                                            <button
                                                                key={b.id}
                                                                type="button"
                                                                onClick={() => setSelectedBooking(b)}
                                                                className="w-full text-left text-xs bg-purple-50 border border-purple-200 rounded p-2 truncate hover:bg-purple-100 cursor-pointer"
                                                                title={`${b.full_name} – ${b.email} (click for details)`}
                                                            >
                                                                <div className="font-semibold text-purple-900 truncate">{b.full_name}</div>
                                                                <div className="text-purple-600 truncate">{formatInDallas(b.slot_start_time)}</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {viewMode === 'list' && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading...</div>
                    ) : bookings.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No demo bookings in this period.</div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {[...bookings]
                                .sort((a, b) => new Date(a.slot_start_time).getTime() - new Date(b.slot_start_time).getTime())
                                .map((b) => (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => setSelectedBooking(b)}
                                        className="w-full p-4 hover:bg-gray-50 text-left"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <div className="font-semibold text-gray-900">{b.full_name}</div>
                                                <div className="text-sm text-gray-600">{b.email}</div>
                                                {b.phone && <div className="text-sm text-gray-500">{b.phone}</div>}
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{b.category_alignment}</span>
                                                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{b.experience_years}</span>
                                                </div>
                                            </div>
                                            <div className="text-right text-sm text-gray-600">
                                                <div className="font-medium text-gray-900">{formatInDallas(b.slot_start_time)}</div>
                                                <div className="text-xs">20 min · Click for details</div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                        </div>
                    )}
                </div>
            )}

            {selectedBooking && (
                <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-6 bg-black/50" onClick={closeModal}>
                    <div
                        className="bg-white w-full h-full sm:h-auto sm:rounded-2xl sm:shadow-2xl sm:max-w-4xl sm:max-h-[88vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header — stays put while either column scrolls */}
                        <div className="shrink-0 flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-gray-200">
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-gray-900 truncate">{selectedBooking.full_name}</h2>
                                <p className="text-sm text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span>{formatInDallas(selectedBooking.slot_start_time)} · 20 min · Dallas, TX</span>
                                    {selectedBooking.rescheduled_at && (
                                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                                            Rescheduled {new Date(selectedBooking.rescheduled_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                aria-label="Close"
                                className="shrink-0 text-gray-400 hover:text-gray-600 text-2xl leading-none -mt-1"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Body — one scroll on mobile, two independent columns from md up */}
                        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden md:grid md:grid-cols-2">
                            {/* Left: who booked */}
                            <div className="md:h-full md:overflow-y-auto p-5 sm:p-6 md:border-r border-gray-200 space-y-5">
                                <div className="space-y-1.5">
                                    <a href={`mailto:${selectedBooking.email}`} className="flex items-center gap-2 text-sm text-purple-600 hover:underline break-all">
                                        <Mail className="w-4 h-4 shrink-0" />
                                        {selectedBooking.email}
                                    </a>
                                    {selectedBooking.phone && (
                                        <a href={`tel:${selectedBooking.phone}`} className="flex items-center gap-2 text-sm text-purple-600 hover:underline">
                                            <Phone className="w-4 h-4 shrink-0" />
                                            {selectedBooking.phone}
                                        </a>
                                    )}
                                </div>

                                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                                    <div>
                                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Category</dt>
                                        <dd className="text-gray-900 mt-0.5">{selectedBooking.category_alignment || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Experience</dt>
                                        <dd className="text-gray-900 mt-0.5">{selectedBooking.experience_years || '—'}</dd>
                                    </div>
                                    <div className="col-span-2">
                                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Income status</dt>
                                        <dd className="text-gray-900 mt-0.5">{selectedBooking.income_status || '—'}</dd>
                                    </div>
                                    <div className="col-span-2">
                                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">What they're looking for</dt>
                                        <dd className="text-gray-900 mt-1">
                                            {parseLookingFor(selectedBooking.looking_for).length > 0 ? (
                                                <ul className="space-y-1">
                                                    {parseLookingFor(selectedBooking.looking_for).map((item, i) => (
                                                        <li key={i} className="flex gap-2">
                                                            <span className="text-purple-400">•</span>
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                '—'
                                            )}
                                        </dd>
                                    </div>
                                </dl>

                                <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                                    Booked {new Date(selectedBooking.created_at).toLocaleString()}
                                </p>
                            </div>

                            {/* Right: the call itself — details, join link, reschedule */}
                            <div className="md:h-full md:min-h-0 flex flex-col border-t md:border-t-0 border-gray-200 bg-gray-50/60">
                                <div className="flex-1 md:overflow-y-auto p-5 sm:p-6 space-y-4">
                                    {rescheduledMsg && (
                                        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                                            {rescheduledMsg}
                                        </div>
                                    )}

                                    {!rescheduleOpen ? (
                                        <>
                                            <div className="rounded-xl bg-white border border-gray-200 p-4">
                                                <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Scheduled for</div>
                                                <div className="mt-1 text-lg font-semibold text-gray-900">
                                                    {formatDayInDallas(selectedBooking.slot_start_time)}
                                                </div>
                                                <div className="text-gray-600">
                                                    {formatTimeInDallas(selectedBooking.slot_start_time)} · 20 min (Dallas, TX)
                                                </div>
                                                {!!selectedBooking.meeting_link && (
                                                    <a
                                                        href={selectedBooking.meeting_link}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
                                                    >
                                                        <Video className="w-4 h-4" />
                                                        Join Demo Call
                                                    </a>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => { setRescheduleOpen(true); setRescheduledMsg(null); }}
                                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100"
                                            >
                                                <CalendarClock className="w-4 h-4" />
                                                Reschedule demo call
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-semibold text-gray-900">Pick a new time</h3>
                                                <button
                                                    type="button"
                                                    onClick={() => { setRescheduleOpen(false); setRescheduleError(null); }}
                                                    className="text-sm text-gray-500 hover:text-gray-700"
                                                >
                                                    Cancel
                                                </button>
                                            </div>

                                            {!outsideHours ? (
                                                slotsLoading ? (
                                                    <div className="text-sm text-gray-500">Loading open slots...</div>
                                                ) : slotDays.length === 0 ? (
                                                    <div className="text-sm text-gray-500">
                                                        No open slots in the next 28 days. Add hours in Demo Availability, or tick the box below to set any time.
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                                                            {slotDays.map((day) => (
                                                                <button
                                                                    key={day}
                                                                    type="button"
                                                                    onClick={() => { setSlotDay(day); setChosenSlot(''); }}
                                                                    className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${day === slotDay ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                                                                >
                                                                    {day}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {(slotsByDay.get(slotDay) || []).map((slot) => (
                                                                <button
                                                                    key={slot.start}
                                                                    type="button"
                                                                    onClick={() => setChosenSlot(slot.start)}
                                                                    className={`px-2 py-2 rounded-lg text-sm border transition-colors ${chosenSlot === slot.start ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                                                                >
                                                                    {formatTimeInDallas(slot.start)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )
                                            ) : (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">New date &amp; time (Dallas, TX)</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={customTime}
                                                        onChange={(e) => setCustomTime(e.target.value)}
                                                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                    />
                                                </div>
                                            )}

                                            <label className="flex items-start gap-2 text-sm text-gray-600">
                                                <input
                                                    type="checkbox"
                                                    checked={outsideHours}
                                                    onChange={(e) => { setOutsideHours(e.target.checked); setChosenSlot(''); setRescheduleError(null); }}
                                                    className="mt-0.5"
                                                />
                                                <span>Allow a time outside availability hours</span>
                                            </label>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Note for the mentor (optional)</label>
                                                <textarea
                                                    value={note}
                                                    onChange={(e) => setNote(e.target.value)}
                                                    rows={2}
                                                    placeholder="e.g. Moved at your request — see you then!"
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                />
                                            </div>

                                            {rescheduleError && (
                                                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{rescheduleError}</div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {rescheduleOpen && (
                                    <div className="shrink-0 border-t border-gray-200 bg-white px-5 sm:px-6 py-4 space-y-3">
                                        <p className="text-xs text-gray-500">
                                            The calendar event moves and {selectedBooking.full_name} is emailed the new time. The meeting link stays the same.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={submitReschedule}
                                            disabled={saving}
                                            className="w-full px-4 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-60"
                                        >
                                            {saving ? 'Rescheduling...' : 'Confirm new time'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DemoRequestsPage;
