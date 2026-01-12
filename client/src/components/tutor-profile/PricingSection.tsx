import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import api from '../../api/axios';

interface PricingSectionProps {
    onBack: () => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onBack }) => {
    const [rate, setRate] = useState('50');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/tutor/me');
                if (res.data.hourly_rate) {
                    setRate(res.data.hourly_rate.toString());
                }
            } catch (err) {
                console.error("Failed to fetch data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/tutor/me/pricing', { hourly_rate: parseFloat(rate) });
            onBack();
        } catch (err) {
            console.error("Failed to save pricing", err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={onBack}>&larr; Back</Button>
                <h2 className="text-2xl font-bold text-gray-900">Pricing</h2>
            </div>

            <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">Set your Hourly Rate</h3>
                <p className="text-sm text-gray-500 mb-6">
                    This is the price students will pay for a 50-minute lesson.
                </p>

                <div className="max-w-xs">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                        <input
                            type="number"
                            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg text-lg font-bold"
                            value={rate}
                            onChange={(e) => setRate(e.target.value)}
                        />
                    </div>
                </div>
            </Card>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onBack} disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
};
