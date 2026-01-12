import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import api from '../api/axios';

type MyMentor = {
    tutor: {
        id: string;
        username: string;
        tagline: string | null;
        hourly_rate: string | number | null;
        rating: number | null;
        review_count: number | null;
        is_verified: boolean;
        tier: string | null;
    };
    totalLessons: number;
    nextSessionStart: string | null;
    lastSessionStart: string | null;
};

const StudentMentorsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [mentors, setMentors] = useState<MyMentor[]>([]);

    useEffect(() => {
        const fetchMentors = async () => {
            try {
                const res = await api.get('/student/mentors');
                setMentors(res.data?.mentors || []);
            } catch (e) {
                console.error('Failed to fetch mentors', e);
                setMentors([]);
            } finally {
                setLoading(false);
            }
        };

        fetchMentors();
    }, []);

    const hasMentors = useMemo(() => mentors.length > 0, [mentors.length]);

    const formatWhen = (iso: string | null) => {
        if (!iso) return '—';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString();
    };

    return (
        <DashboardLayout>
            <div className="w-full">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">My Mentors</h1>
                {loading ? (
                    <Card className="p-6">
                        <div className="text-sm text-gray-600">Loading mentors...</div>
                    </Card>
                ) : !hasMentors ? (
                    <Card className="p-6">
                        <div className="text-sm text-gray-700 font-semibold">No mentors yet</div>
                        <div className="text-sm text-gray-600 mt-1">Book a session to start working with a mentor.</div>
                        <div className="mt-4">
                            <Link to="/student/mentors"><Button>Find a Mentor</Button></Link>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {mentors.map((m) => (
                            <Card key={m.tutor.id} className="p-6">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-lg font-bold text-gray-900">{m.tutor.username}</div>
                                            {m.tutor.is_verified ? (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Verified</span>
                                            ) : null}
                                        </div>
                                        {m.tutor.tagline ? (
                                            <div className="text-sm text-gray-600 mt-1">{m.tutor.tagline}</div>
                                        ) : null}

                                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                            <div>
                                                <div className="text-xs text-gray-500">Next session</div>
                                                <div className="text-gray-800">{formatWhen(m.nextSessionStart)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500">Last session</div>
                                                <div className="text-gray-800">{formatWhen(m.lastSessionStart)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500">Total sessions</div>
                                                <div className="text-gray-800">{m.totalLessons}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 sm:flex-col">
                                        <Link to={`/student/mentors/${m.tutor.id}`}>
                                            <Button variant="outline" className="w-full">View Profile</Button>
                                        </Link>
                                        <Link to={`/student/book/${m.tutor.id}`}>
                                            <Button className="w-full">Book Again</Button>
                                        </Link>
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

export default StudentMentorsPage;
