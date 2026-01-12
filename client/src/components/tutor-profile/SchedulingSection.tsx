import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import api from '../../api/axios';

type WeeklyRule = {
    id?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
};

type TimeBlock = {
    id: string;
    start_time: string;
    end_time: string;
    reason?: string | null;
};

interface SchedulingSectionProps {
    onBack: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateTimeLocalValue = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const SchedulingSection: React.FC<SchedulingSectionProps> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [timezone, setTimezone] = useState('UTC');
    const [rules, setRules] = useState<WeeklyRule[]>([]);

    const [blocksLoading, setBlocksLoading] = useState(false);
    const [blocks, setBlocks] = useState<TimeBlock[]>([]);

    const [newBlock, setNewBlock] = useState<{ start: string; end: string; reason: string }>(() => {
        const start = new Date();
        const end = new Date(Date.now() + 60 * 60 * 1000);
        return {
            start: toDateTimeLocalValue(start.toISOString()),
            end: toDateTimeLocalValue(end.toISOString()),
            reason: '',
        };
    });

    const timezones = useMemo(() => {
        // Best-effort; not supported in all environments.
        // If unavailable, keep a small curated list.
        const fallback = ['UTC', 'Asia/Dubai', 'Asia/Karachi', 'Europe/London', 'America/New_York', 'America/Los_Angeles'];
        const anyIntl: any = Intl as any;
        if (typeof anyIntl?.supportedValuesOf === 'function') {
            try {
                return anyIntl.supportedValuesOf('timeZone');
            } catch {
                return fallback;
            }
        }
        return fallback;
    }, []);

    const fetchScheduling = async () => {
        setLoading(true);
        try {
            const res = await api.get('/scheduling/me');
            setTimezone(res.data?.timezone || 'UTC');
            setRules(res.data?.availabilities || []);

            // Blocks are included in /scheduling/me but we also support listing.
            setBlocks(res.data?.time_blocks || []);
        } catch (e) {
            console.error('Failed to fetch scheduling', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchBlocks = async () => {
        setBlocksLoading(true);
        try {
            const res = await api.get('/scheduling/me/blocks');
            setBlocks(res.data?.blocks || []);
        } catch (e) {
            console.error('Failed to fetch blocks', e);
        } finally {
            setBlocksLoading(false);
        }
    };

    useEffect(() => {
        fetchScheduling();
    }, []);

    const addRule = () => {
        setRules(prev => ([
            ...prev,
            { day_of_week: 1, start_time: '09:00', end_time: '17:00' }
        ]));
    };

    const updateRule = (idx: number, patch: Partial<WeeklyRule>) => {
        setRules(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
    };

    const removeRule = (idx: number) => {
        setRules(prev => prev.filter((_, i) => i !== idx));
    };

    const saveAll = async () => {
        setSaving(true);
        try {
            await api.put('/scheduling/me/timezone', { timezone });
            await api.put('/scheduling/me/availability', { rules: rules.map(r => ({
                day_of_week: r.day_of_week,
                start_time: r.start_time,
                end_time: r.end_time,
            })) });
            await fetchScheduling();
            onBack();
        } catch (e) {
            console.error('Failed to save scheduling', e);
        } finally {
            setSaving(false);
        }
    };

    const createBlock = async () => {
        try {
            const startISO = new Date(newBlock.start).toISOString();
            const endISO = new Date(newBlock.end).toISOString();
            await api.post('/scheduling/me/blocks', {
                start_time: startISO,
                end_time: endISO,
                reason: newBlock.reason || undefined,
            });
            setNewBlock(prev => ({ ...prev, reason: '' }));
            await fetchBlocks();
        } catch (e) {
            console.error('Failed to create time block', e);
        }
    };

    const deleteBlock = async (id: string) => {
        try {
            await api.delete(`/scheduling/me/blocks/${id}`);
            await fetchBlocks();
        } catch (e) {
            console.error('Failed to delete block', e);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={onBack}>&larr; Back</Button>
                <h2 className="text-2xl font-bold text-gray-900">Scheduling</h2>
            </div>

            <Card className="p-6">
                <h3 className="font-bold text-lg mb-1">Timezone</h3>
                <p className="text-sm text-gray-500 mb-4">This timezone will be used to display your schedule. (Slots are stored/processed in UTC for now.)</p>

                <select
                    className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                >
                    {timezones.map((tz: string) => (
                        <option key={tz} value={tz}>{tz}</option>
                    ))}
                </select>
            </Card>

            <Card className="p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-bold text-lg">Weekly working hours</h3>
                        <p className="text-sm text-gray-500">Add one or more time ranges per day (e.g. Mon 09:00–12:00 and 14:00–18:00).</p>
                    </div>
                    <Button variant="outline" onClick={addRule}>Add time range</Button>
                </div>

                <div className="space-y-3">
                    {rules.length === 0 ? (
                        <div className="text-sm text-gray-600">No working hours set yet.</div>
                    ) : (
                        rules.map((r, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row md:items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <select
                                    className="border border-gray-300 rounded-lg px-3 py-2 w-full md:w-32"
                                    value={r.day_of_week}
                                    onChange={(e) => updateRule(idx, { day_of_week: parseInt(e.target.value, 10) })}
                                >
                                    {DAYS.map((d, i) => (
                                        <option key={d} value={i}>{d}</option>
                                    ))}
                                </select>

                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <Input
                                        type="time"
                                        value={r.start_time}
                                        onChange={(e) => updateRule(idx, { start_time: e.target.value })}
                                    />
                                    <span className="text-gray-500 text-sm">to</span>
                                    <Input
                                        type="time"
                                        value={r.end_time}
                                        onChange={(e) => updateRule(idx, { end_time: e.target.value })}
                                    />
                                </div>

                                <div className="flex justify-end md:ml-auto">
                                    <Button variant="outline" onClick={() => removeRule(idx)}>Remove</Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            <Card className="p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-bold text-lg">Time off / Blocked time</h3>
                        <p className="text-sm text-gray-500">Use this to block out appointments, vacations, etc.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Start</label>
                        <Input
                            type="datetime-local"
                            value={newBlock.start}
                            onChange={(e) => setNewBlock(prev => ({ ...prev, start: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">End</label>
                        <Input
                            type="datetime-local"
                            value={newBlock.end}
                            onChange={(e) => setNewBlock(prev => ({ ...prev, end: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Reason (optional)</label>
                        <Input
                            value={newBlock.reason}
                            onChange={(e) => setNewBlock(prev => ({ ...prev, reason: e.target.value }))}
                        />
                    </div>
                </div>

                <div className="flex justify-end mb-4">
                    <Button onClick={createBlock}>Add block</Button>
                </div>

                {blocksLoading ? (
                    <div className="text-sm text-gray-600">Loading blocks...</div>
                ) : blocks.length === 0 ? (
                    <div className="text-sm text-gray-600">No blocked time.</div>
                ) : (
                    <div className="space-y-2">
                        {blocks.map((b) => (
                            <div key={b.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2">
                                <div className="text-sm text-gray-900 font-medium">
                                    {new Date(b.start_time).toLocaleString()} 
                                    {' — '} 
                                    {new Date(b.end_time).toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-600">{b.reason || ''}</div>
                                <div className="flex justify-end md:ml-auto">
                                    <Button variant="outline" onClick={() => deleteBlock(b.id)}>Delete</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onBack} disabled={saving}>Cancel</Button>
                <Button onClick={saveAll} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
};
