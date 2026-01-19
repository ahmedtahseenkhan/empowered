import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type MarketingVideoSubmission = {
    id: string;
    tutor_id: string;
    video_url: string | null;
    instructions: string | null;
    status: 'DRAFT' | 'LINK_SUBMITTED' | 'EMAIL_REQUESTED';
    link_submitted_at: string | null;
    email_requested_at: string | null;
    created_at: string;
    updated_at: string;
};

export const MarketingVideoSection: React.FC<{ onBack: () => void; tutorUsername?: string }> = ({
    onBack,
    tutorUsername,
}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [videoUrl, setVideoUrl] = useState('');
    const [instructions, setInstructions] = useState('');
    const [submission, setSubmission] = useState<MarketingVideoSubmission | null>(null);

    const supportEmail = 'support@empoweredlearnings.com';

    const mailtoHref = useMemo(() => {
        const subject = `Marketing Video Submission - ${tutorUsername || 'Tutor'}`;
        const body = [
            'Hello Admin Support Team,',
            '',
            'I would like to submit my marketing video for review and enhancement.',
            '',
            `Tutor: ${tutorUsername || ''}`,
            `Video Link: ${videoUrl || ''}`,
            '',
            'Instructions / Preferences:',
            instructions || '',
            '',
            'Thank you!',
        ].join('\n');

        return `mailto:${encodeURIComponent(supportEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }, [instructions, tutorUsername, videoUrl]);

    useEffect(() => {
        const fetchSubmission = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await api.get('/tutor/me/marketing-video');
                const s = res.data?.submission as MarketingVideoSubmission | null;
                setSubmission(s);
                setVideoUrl(s?.video_url || '');
                setInstructions(s?.instructions || '');
            } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to load marketing video submission');
            } finally {
                setLoading(false);
            }
        };

        fetchSubmission();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const res = await api.put('/tutor/me/marketing-video', {
                video_url: videoUrl,
                instructions,
                action: 'save_link',
            });
            setSubmission(res.data?.submission || null);
            setSuccess('Saved successfully');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleEmailSubmit = async () => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const res = await api.put('/tutor/me/marketing-video', {
                video_url: videoUrl,
                instructions,
                action: 'request_email',
            });
            setSubmission(res.data?.submission || null);
            window.location.href = mailtoHref;
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to submit request');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Marketing Video Submission</h2>
                    <Button variant="ghost" onClick={onBack}>
                        Back
                    </Button>
                </div>
                <div className="text-sm text-gray-600">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Marketing Video Submission</h2>
                        <p className="text-sm text-gray-600">
                            Submit a link to your video and any preferences for how it should be used in marketing.
                        </p>
                    </div>
                    <Button variant="ghost" onClick={onBack}>
                        &larr; Back
                    </Button>
                </div>

                {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
                {success && <div className="mt-4 text-sm text-green-600">{success}</div>}

                <div className="mt-6 space-y-5">
                    <Input
                        label="Video Link"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="YouTube / Google Drive / Vimeo link"
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Instructions / Preferences
                        </label>
                        <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            rows={6}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                            placeholder="Example: Please use 10-15 second clips, focus on my Academic Tutoring offer, include a CTA to book a trial session..."
                        />
                    </div>

                    {submission?.status && (
                        <div className="text-xs text-gray-500">
                            Status: <span className="font-semibold">{submission.status}</span>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            onClick={handleSave}
                            className="bg-[#4A1D96] text-white"
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Link'}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handleEmailSubmit}
                            disabled={saving}
                        >
                            {saving ? 'Submitting...' : 'Submit via Email'}
                        </Button>

                        <a
                            className="text-sm text-gray-500 self-center"
                            href={mailtoHref}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Email: {supportEmail}
                        </a>
                    </div>

                    <div className="text-xs text-gray-500">
                        Note: This section is for marketing purposes only and does not affect profile completion.
                    </div>
                </div>
            </div>
        </div>
    );
};
