import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import api from '../../api/axios';

const apiError = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

type StudentOption = { id: string; username: string; last_session_at: string | null };
type Rules = { offerExpiryHours: number; minNoticeHours: number; durations: number[]; maxOpenOffersPerStudent: number };

export type CustomSessionPrefill = {
    studentId?: string;
    makeupForLessonId?: string;
    kind?: 'MAKEUP' | 'EXTRA';
    durationMinutes?: number;
};

export type CreatedCustomSession = {
    id: string;
    status: string;
    start_time: string;
    end_time: string;
    duration: number;
    custom_kind: string | null;
    offer_message: string | null;
    offer_expires_at: string | null;
    makeup_for_lesson_id: string | null;
    meeting_link: string | null;
    tutor: { username: string };
    student: { username: string };
};

type Props = {
    open: boolean;
    onClose: () => void;
    onCreated: (lesson: CreatedCustomSession) => void;
    prefill?: CustomSessionPrefill | null;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Mentor form: schedule a free custom (make-up or extra) session with one of their own students.
 *  No payment or credits are involved — the platform only tracks the session. */
const CustomSessionModal: React.FC<Props> = ({ open, onClose, onCreated, prefill }) => {
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [rules, setRules] = useState<Rules>({ offerExpiryHours: 48, minNoticeHours: 2, durations: [30, 45, 60], maxOpenOffersPerStudent: 3 });
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const [studentId, setStudentId] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState(60);
    const [kind, setKind] = useState<'MAKEUP' | 'EXTRA'>('EXTRA');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!open) return;
        setError('');
        setBusy(false);
        setStudentId(prefill?.studentId || '');
        setKind(prefill?.kind || (prefill?.makeupForLessonId ? 'MAKEUP' : 'EXTRA'));
        setMessage('');
        // Default to tomorrow at 10:00 local time
        const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
        setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        setTime('10:00');

        let cancelled = false;
        setLoading(true);
        Promise.all([api.get('/custom-sessions/rules'), api.get('/custom-sessions/students')])
            .then(([r, s]) => {
                if (cancelled) return;
                const rr = r.data as Rules;
                if (rr?.durations?.length) setRules(rr);
                const list = (s.data?.students || []) as StudentOption[];
                setStudents(list);
                const wanted = prefill?.durationMinutes;
                setDuration(wanted && rr?.durations?.includes(wanted) ? wanted : (rr?.durations?.includes(60) ? 60 : rr?.durations?.[0] || 60));
                if (!prefill?.studentId && list.length === 1) setStudentId(list[0].id);
            })
            .catch((e) => { if (!cancelled) setError(apiError(e, 'Could not load your students.')); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, prefill]);

    const startIso = useMemo(() => {
        if (!date || !time) return null;
        const d = new Date(`${date}T${time}:00`);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }, [date, time]);

    const tooSoon = useMemo(() => {
        if (!startIso) return false;
        return new Date(startIso).getTime() < Date.now() + rules.minNoticeHours * 3600 * 1000;
    }, [startIso, rules.minNoticeHours]);

    const submit = async () => {
        if (!studentId) { setError('Please choose a student.'); return; }
        if (!startIso) { setError('Please choose a date and time.'); return; }
        if (tooSoon) { setError(`The session must start at least ${rules.minNoticeHours} hours from now.`); return; }
        try {
            setBusy(true);
            setError('');
            const res = await api.post('/custom-sessions', {
                studentId,
                startTime: startIso,
                durationMinutes: duration,
                kind,
                makeupForLessonId: kind === 'MAKEUP' ? prefill?.makeupForLessonId || null : null,
                message: message.trim() || null,
            });
            onCreated(res.data?.lesson as CreatedCustomSession);
            onClose();
        } catch (e) {
            setError(apiError(e, 'Could not schedule the session. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const field = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300';
    const label = 'block text-xs font-semibold text-gray-600 uppercase mb-1';

    return (
        <Modal isOpen={open} onClose={() => { if (!busy) onClose(); }} title="Schedule a free session">
            <div className="space-y-4">
                <p className="text-sm text-gray-600">
                    Schedule a free session with one of your students. They receive an email and accept or decline it from their dashboard.
                    The request expires after {rules.offerExpiryHours} hours if they do not respond.
                </p>
                <div className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <span className="font-semibold">This session is free.</span> EmpowerEd does not charge the student or deduct any Learning Credits for it,
                    no payment is collected on the platform, and no earnings are recorded for you.
                </div>

                {loading ? (
                    <div className="text-sm text-gray-500">Loading your students…</div>
                ) : students.length === 0 ? (
                    <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        You can only schedule sessions with students who have booked with you, and none have yet.
                    </div>
                ) : (
                    <>
                        <div>
                            <label className={label}>Student</label>
                            <select className={field} value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={busy || !!prefill?.studentId}>
                                <option value="">Choose a student…</option>
                                {students.map((s) => (
                                    <option key={s.id} value={s.id}>{s.username}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={label}>Session type</label>
                            <div className="flex gap-2">
                                {(['MAKEUP', 'EXTRA'] as const).map((k) => (
                                    <button
                                        key={k}
                                        type="button"
                                        disabled={busy}
                                        onClick={() => setKind(k)}
                                        className={`flex-1 text-left rounded-lg border p-3 text-sm transition-colors ${kind === k ? 'border-purple-500 ring-2 ring-purple-200 bg-purple-50/50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                                    >
                                        <div className="font-semibold text-gray-900">{k === 'MAKEUP' ? 'Make-up session' : 'Extra session'}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{k === 'MAKEUP' ? 'Replaces a missed or cancelled session' : 'An additional session'}</div>
                                    </button>
                                ))}
                            </div>
                            {kind === 'MAKEUP' && prefill?.makeupForLessonId && (
                                <p className="text-xs text-gray-500 mt-1">This make-up will be linked to the missed session you chose.</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className={label}>Date</label>
                                <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
                            </div>
                            <div>
                                <label className={label}>Start time</label>
                                <input type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} disabled={busy} step={300} />
                            </div>
                            <div>
                                <label className={label}>Duration</label>
                                <select className={field} value={duration} onChange={(e) => setDuration(Number(e.target.value))} disabled={busy}>
                                    {rules.durations.map((d) => <option key={d} value={d}>{d} minutes</option>)}
                                </select>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            Times are in your current timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). The student sees them in theirs.
                            {tooSoon && <span className="block text-amber-700 mt-1">Must start at least {rules.minNoticeHours} hours from now.</span>}
                        </p>

                        <div>
                            <label className={label}>Message to the student (optional)</label>
                            <textarea
                                className={`${field} min-h-[80px]`}
                                maxLength={500}
                                placeholder="e.g. Let's catch up on what we missed last week."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                disabled={busy}
                            />
                        </div>
                    </>
                )}

                {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button className="flex-1" onClick={submit} disabled={busy || loading || students.length === 0 || !studentId || !startIso || tooSoon}>
                        {busy ? 'Scheduling…' : 'Schedule free session'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default CustomSessionModal;
