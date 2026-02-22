import React, { useEffect, useMemo, useState } from 'react';
import { PageLayout } from '../layouts/PageLayout';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import api from '../api/axios';

const CATEGORY_OPTIONS = [
    'Academic Tutoring',
    'Life Coaching',
    'Skill Development',
    'All of the above',
];

const EXPERIENCE_OPTIONS = [
    'Just getting started',
    'Less than 1 year',
    '1–3 years',
    '3+ years',
];

const INCOME_OPTIONS = [
    'Yes, I have recurring clients',
    'Yes, but income fluctuates',
    "Not yet, I'm building",
    "I'm planning to start soon",
];

const LOOKING_FOR_OPTIONS = [
    'More visibility',
    'More consistent bookings on your calendar',
    'Built-in scheduling & payment tools',
    'Featured promotion & boosted exposure',
    'Commission-free structure',
    'All of the above',
];

const DALLAS_TZ = 'America/Chicago';

function formatSlotInDallas(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { timeZone: DALLAS_TZ, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

const BookDemoPage: React.FC = () => {
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        category_alignment: '',
        experience_years: '',
        income_status: '',
        looking_for: [] as string[],
        slot_start_time: '',
    });

    const [slotsLoading, setSlotsLoading] = useState(false);
    const [slots, setSlots] = useState<Array<{ start: string; end: string }>>([]);
    // Start from "today" in Dallas (admin timezone) so the first day shown is today, not tomorrow
    const [weekStart, setWeekStart] = useState(() => {
        const now = new Date();
        const s = now.toLocaleDateString('en-CA', { timeZone: DALLAS_TZ }).split('-');
        const y = parseInt(s[0], 10);
        const m = parseInt(s[1], 10) - 1;
        const d = parseInt(s[2], 10);
        return new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    });

    const weekEnd = useMemo(() => {
        const d = new Date(weekStart);
        d.setUTCDate(d.getUTCDate() + 13);
        return d;
    }, [weekStart]);

    useEffect(() => {
        const from = weekStart.toISOString();
        const to = weekEnd.toISOString();
        setSlotsLoading(true);
        api.get('/demo/slots', { params: { from, to } })
            .then((res) => setSlots(res.data?.slots || []))
            .catch(() => setSlots([]))
            .finally(() => setSlotsLoading(false));
    }, [weekStart, weekEnd]);

    const toggleLookingFor = (value: string) => {
        setFormData((prev) => ({
            ...prev,
            looking_for: prev.looking_for.includes(value)
                ? prev.looking_for.filter((x) => x !== value)
                : [...prev.looking_for, value],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!formData.full_name?.trim() || !formData.email?.trim()) {
            setError('Full name and email are required.');
            return;
        }
        if (!formData.slot_start_time) {
            setError('Please select a demo time.');
            return;
        }
        if (formData.looking_for.length === 0) {
            setError("Please select at least one option for what you're looking for.");
            return;
        }
        setBusy(true);
        try {
            await api.post('/demo/bookings', {
                full_name: formData.full_name.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim() || undefined,
                category_alignment: formData.category_alignment || 'All of the above',
                experience_years: formData.experience_years || '',
                income_status: formData.income_status || '',
                looking_for: formData.looking_for,
                slot_start_time: formData.slot_start_time,
            });
            setSubmitted(true);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to book demo. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    if (submitted) {
        return (
            <PageLayout>
                <section className="section-container">
                    <div className="max-w-xl mx-auto text-center py-12">
                        <div className="text-5xl mb-6">🎉</div>
                        <h1 className="heading-lg mb-4">You're All Set!</h1>
                        <p className="text-lg text-gray-600 mb-8">
                            We're excited to meet you and explore how EmpowerEd Learnings can support your growth.
                        </p>
                        <ul className="space-y-3 text-left max-w-sm mx-auto text-gray-700">
                            <li className="flex items-center gap-2">✔️ Check your email for confirmation</li>
                            <li className="flex items-center gap-2">✔️ Add the call to your calendar</li>
                            <li className="flex items-center gap-2">✔️ Come ready with your questions</li>
                        </ul>
                        <p className="mt-8 font-semibold text-gray-900">See you soon!</p>
                    </div>
                </section>
            </PageLayout>
        );
    }

    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="heading-lg mb-3">Book a Demo Call</h1>
                        <p className="text-gray-600">Schedule a 20-minute demo with our team (9 AM – 5 PM, Dallas, TX).</p>
                    </div>

                    <Card className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
                            )}

                            <Input
                                label="Full Name *"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                required
                            />
                            <Input
                                label="Email Address *"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                            <Input
                                label="Phone Number (Optional but Recommended)"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Which of our three categories best aligns with your services?</label>
                                <select
                                    className="w-full border-2 border-gray-200 rounded-lg p-3 bg-white"
                                    value={formData.category_alignment}
                                    onChange={(e) => setFormData({ ...formData, category_alignment: e.target.value })}
                                >
                                    <option value="">Select one</option>
                                    {CATEGORY_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">How long have you been offering your services?</label>
                                <select
                                    className="w-full border-2 border-gray-200 rounded-lg p-3 bg-white"
                                    value={formData.experience_years}
                                    onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                                >
                                    <option value="">Select one</option>
                                    {EXPERIENCE_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Are you currently earning consistent monthly income from your tutoring/coaching services?</label>
                                <select
                                    className="w-full border-2 border-gray-200 rounded-lg p-3 bg-white"
                                    value={formData.income_status}
                                    onChange={(e) => setFormData({ ...formData, income_status: e.target.value })}
                                >
                                    <option value="">Select one</option>
                                    {INCOME_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">What are you primarily looking for in a platform like EmpowerEd Learnings? *</label>
                                <div className="space-y-2">
                                    {LOOKING_FOR_OPTIONS.map((opt) => (
                                        <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.looking_for.includes(opt)}
                                                onChange={() => toggleLookingFor(opt)}
                                            />
                                            <span>{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select a convenient time for a 20-minute demo with our admin.</label>
                                <p className="text-xs text-gray-500 mb-2">All times shown in Dallas, TX (Central Time). Demo slots are limited each week to ensure personalized onboarding.</p>
                                {slotsLoading ? (
                                    <div className="text-sm text-gray-600 py-4">Loading available times...</div>
                                ) : slots.length === 0 ? (
                                    <div className="text-sm text-gray-600 py-4">No slots available in this range. Try another week.</div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                                        {slots.map((slot) => {
                                            const selected = formData.slot_start_time === slot.start;
                                            return (
                                                <button
                                                    key={slot.start}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, slot_start_time: slot.start })}
                                                    className={`p-3 rounded-lg border text-left text-sm transition-colors ${selected ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                                >
                                                    {formatSlotInDallas(slot.start)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="flex gap-2 mt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setWeekStart((d) => { const n = new Date(d); n.setUTCDate(n.getUTCDate() - 14); return n; })}
                                    >
                                        ← Previous weeks
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setWeekStart((d) => { const n = new Date(d); n.setUTCDate(n.getUTCDate() + 14); return n; })}
                                    >
                                        Next weeks →
                                    </Button>
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={busy}>
                                {busy ? 'Booking...' : 'Book Demo'}
                            </Button>
                        </form>
                    </Card>
                </div>
            </section>
        </PageLayout>
    );
};

export default BookDemoPage;
