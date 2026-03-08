import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Clock, Ban, Plus, Trash2 } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DALLAS_TZ = 'America/Chicago';

type AvailabilityRule = {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
};

type DemoBlock = {
    id: string;
    start_time: string;
    end_time: string;
    reason: string | null;
};

function toDateTimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatInDallas(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { timeZone: DALLAS_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

const DemoAvailabilityPage: React.FC = () => {
    const [availabilityLoading, setAvailabilityLoading] = useState(true);
    const [availabilitySaving, setAvailabilitySaving] = useState(false);
    const [rules, setRules] = useState<AvailabilityRule[]>([]);
    const [blocksLoading, setBlocksLoading] = useState(true);
    const [blocks, setBlocks] = useState<DemoBlock[]>([]);
    const [blockSaving, setBlockSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [newBlock, setNewBlock] = useState(() => {
        const start = new Date();
        const end = new Date(Date.now() + 60 * 60 * 1000);
        return {
            start: toDateTimeLocal(start.toISOString()),
            end: toDateTimeLocal(end.toISOString()),
            reason: '',
        };
    });
    const [showAddBlock, setShowAddBlock] = useState(false);

    const fetchAvailability = async () => {
        setAvailabilityLoading(true);
        try {
            const res = await api.get('/admin/demo-availability');
            setRules(res.data?.rules || []);
        } catch (e) {
            console.error(e);
            setError('Failed to load availability');
        } finally {
            setAvailabilityLoading(false);
        }
    };

    const fetchBlocks = async () => {
        setBlocksLoading(true);
        try {
            const from = new Date();
            const to = new Date();
            to.setDate(to.getDate() + 60);
            const res = await api.get('/admin/demo-blocks', { params: { from: from.toISOString(), to: to.toISOString() } });
            setBlocks(res.data?.blocks || []);
        } catch (e) {
            console.error(e);
            setError('Failed to load blocked times');
        } finally {
            setBlocksLoading(false);
        }
    };

    useEffect(() => {
        fetchAvailability();
        fetchBlocks();
    }, []);

    const addRule = () => {
        setRules((prev) => [...prev, { id: `new-${Date.now()}`, day_of_week: 1, start_time: '09:00', end_time: '11:00' }]);
    };

    const updateRule = (id: string, patch: Partial<AvailabilityRule>) => {
        setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };

    const removeRule = (id: string) => {
        setRules((prev) => prev.filter((r) => r.id !== id));
    };

    const saveAvailability = async () => {
        setError('');
        setSuccess('');
        setAvailabilitySaving(true);
        try {
            await api.put('/admin/demo-availability', {
                rules: rules.map((r) => ({ day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time })),
            });
            setSuccess('Availability saved. Demo slots will follow these windows (Dallas, TX).');
            fetchAvailability();
        } catch (e: any) {
            setError(e.response?.data?.error || 'Failed to save availability');
        } finally {
            setAvailabilitySaving(false);
        }
    };

    const addBlock = async () => {
        setError('');
        setBlockSaving(true);
        try {
            const start = new Date(newBlock.start);
            const end = new Date(newBlock.end);
            if (start >= end) {
                setError('Start must be before end');
                setBlockSaving(false);
                return;
            }
            await api.post('/admin/demo-blocks', {
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                reason: newBlock.reason.trim() || undefined,
            });
            setNewBlock({
                start: toDateTimeLocal(end.toISOString()),
                end: toDateTimeLocal(new Date(end.getTime() + 60 * 60 * 1000).toISOString()),
                reason: '',
            });
            setSuccess('Block added.');
            fetchBlocks();
        } catch (e: any) {
            setError(e.response?.data?.error || 'Failed to add block');
        } finally {
            setBlockSaving(false);
        }
    };

    const deleteBlock = async (id: string) => {
        setError('');
        try {
            await api.delete(`/admin/demo-blocks/${id}`);
            setSuccess('Block removed.');
            fetchBlocks();
        } catch (e: any) {
            setError(e.response?.data?.error || 'Failed to delete block');
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Demo Availability & Blocks</h1>
                <p className="text-gray-600 mt-1">
                    Set when you are available for demo calls (Dallas, TX). Only the windows you add below will be offered; if none are set, no demo slots will be shown. Add blocks to mark times when you are not available.
                </p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>
            )}

            {/* Weekly availability windows */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Weekly availability</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                    Add one or more time windows per day (e.g. Monday 9:00–11:00 and 3:00–5:00). All times are in Dallas, TX (Central).
                </p>

                {availabilityLoading ? (
                    <div className="text-sm text-gray-500 py-4">Loading...</div>
                ) : (
                    <>
                        <div className="space-y-3 mb-4">
                            {rules.map((r) => (
                                <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                    <select
                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                        value={r.day_of_week}
                                        onChange={(e) => updateRule(r.id, { day_of_week: parseInt(e.target.value, 10) })}
                                    >
                                        {DAYS.map((day, i) => (
                                            <option key={i} value={i}>{day}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="time"
                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                        value={r.start_time}
                                        onChange={(e) => updateRule(r.id, { start_time: e.target.value })}
                                    />
                                    <span className="text-gray-500">to</span>
                                    <input
                                        type="time"
                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                        value={r.end_time}
                                        onChange={(e) => updateRule(r.id, { end_time: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeRule(r.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                        title="Remove"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={addRule}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                            >
                                <Plus className="w-4 h-4" /> Add window
                            </button>
                            <button
                                type="button"
                                onClick={saveAvailability}
                                disabled={availabilitySaving}
                                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                            >
                                {availabilitySaving ? 'Saving...' : 'Save availability'}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Blocked times */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Ban className="w-5 h-5 text-amber-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Blocked times</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                    Block specific dates and times when you are not available for demos (e.g. meetings, time off). These work like mentor time blocks.
                </p>

                {blocksLoading ? (
                    <div className="text-sm text-gray-500 py-4">Loading...</div>
                ) : (
                    <>
                        <div className="space-y-2 mb-4">
                            {blocks.length === 0 ? (
                                <div className="text-sm text-gray-500 py-4">No blocked times in the next 60 days.</div>
                            ) : (
                                blocks.map((b) => (
                                    <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <div>
                                            <div className="font-medium text-gray-900">{formatInDallas(b.start_time)} – {formatInDallas(b.end_time)}</div>
                                            {b.reason && <div className="text-sm text-gray-600">{b.reason}</div>}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => deleteBlock(b.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                            title="Remove block"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {showAddBlock ? (
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Start (your local time)</label>
                                        <input
                                            type="datetime-local"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                            value={newBlock.start}
                                            onChange={(e) => setNewBlock((prev) => ({ ...prev, start: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
                                        <input
                                            type="datetime-local"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                            value={newBlock.end}
                                            onChange={(e) => setNewBlock((prev) => ({ ...prev, end: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                        placeholder="e.g. Meeting, Off"
                                        value={newBlock.reason}
                                        onChange={(e) => setNewBlock((prev) => ({ ...prev, reason: e.target.value }))}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={addBlock}
                                        disabled={blockSaving}
                                        className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                                    >
                                        {blockSaving ? 'Adding...' : 'Add block'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddBlock(false)}
                                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowAddBlock(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-200"
                            >
                                <Plus className="w-4 h-4" /> Block time
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DemoAvailabilityPage;
