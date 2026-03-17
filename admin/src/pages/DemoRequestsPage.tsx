import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

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
    }, [weekStart]);

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
            <div className="flex items-center justify-between">
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
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedBooking(null)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900">Demo booking details</h2>
                            <button type="button" onClick={() => setSelectedBooking(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                        </div>
                        <dl className="space-y-3 text-sm">
                            <div>
                                <dt className="font-medium text-gray-500">Full name</dt>
                                <dd className="text-gray-900">{selectedBooking.full_name}</dd>
                            </div>
                            <div>
                                <dt className="font-medium text-gray-500">Email</dt>
                                <dd className="text-gray-900"><a href={`mailto:${selectedBooking.email}`} className="text-purple-600 hover:underline">{selectedBooking.email}</a></dd>
                            </div>
                            {selectedBooking.phone && (
                                <div>
                                    <dt className="font-medium text-gray-500">Phone</dt>
                                    <dd className="text-gray-900"><a href={`tel:${selectedBooking.phone}`} className="text-purple-600 hover:underline">{selectedBooking.phone}</a></dd>
                                </div>
                            )}
                            <div>
                                <dt className="font-medium text-gray-500">Category alignment</dt>
                                <dd className="text-gray-900">{selectedBooking.category_alignment || '—'}</dd>
                            </div>
                            <div>
                                <dt className="font-medium text-gray-500">Experience</dt>
                                <dd className="text-gray-900">{selectedBooking.experience_years || '—'}</dd>
                            </div>
                            <div>
                                <dt className="font-medium text-gray-500">Income status</dt>
                                <dd className="text-gray-900">{selectedBooking.income_status || '—'}</dd>
                            </div>
                            <div>
                                <dt className="font-medium text-gray-500">What they're looking for</dt>
                                <dd className="text-gray-900">
                                    {parseLookingFor(selectedBooking.looking_for).length > 0 ? (
                                        <ul className="list-disc list-inside mt-1">{parseLookingFor(selectedBooking.looking_for).map((item, i) => <li key={i}>{item}</li>)}</ul>
                                    ) : (
                                        '—'
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="font-medium text-gray-500">Demo time (Dallas, TX)</dt>
                                <dd className="text-gray-900">{formatInDallas(selectedBooking.slot_start_time)} – 20 min</dd>
                            </div>
                            {!!selectedBooking.meeting_link && (
                                <div>
                                    <dt className="font-medium text-gray-500">Demo call link</dt>
                                    <dd className="text-gray-900">
                                        <a
                                            href={selectedBooking.meeting_link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                                        >
                                            Join Demo Call
                                        </a>
                                    </dd>
                                </div>
                            )}
                            <div>
                                <dt className="font-medium text-gray-500">Booked on</dt>
                                <dd className="text-gray-900">{new Date(selectedBooking.created_at).toLocaleString()}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DemoRequestsPage;
