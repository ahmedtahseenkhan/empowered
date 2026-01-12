import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import api from '../api/axios';

type MyStudent = {
    student: {
        id: string;
        username: string;
        profile_photo?: string | null;
        grade_level?: string | null;
    };
    totalLessons: number;
    nextSessionStart: string | null;
    lastSessionStart: string | null;
};

const TutorStudentsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<MyStudent[]>([]);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const res = await api.get('/tutor/me/students');
                setStudents(res.data?.students || []);
            } catch (e) {
                console.error('Failed to fetch tutor students', e);
                setStudents([]);
            } finally {
                setLoading(false);
            }
        };

        fetchStudents();
    }, []);

    const hasStudents = useMemo(() => students.length > 0, [students.length]);

    const formatWhen = (iso: string | null) => {
        if (!iso) return '—';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString();
    };

    return (
        <DashboardLayout>
            <div className="w-full">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <Users className="w-6 h-6 text-[#4A1D96]" />
                            <h1 className="text-3xl font-bold text-gray-900">Students</h1>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Students you have sessions with.</p>
                    </div>
                    <Link to="/sessions"><Button>View Sessions</Button></Link>
                </div>

                {loading ? (
                    <Card className="p-6">
                        <div className="text-sm text-gray-600">Loading students...</div>
                    </Card>
                ) : !hasStudents ? (
                    <Card className="p-6">
                        <div className="text-sm text-gray-700 font-semibold">No students yet</div>
                        <div className="text-sm text-gray-600 mt-1">Once a student books a session, they will appear here.</div>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {students.map((s) => (
                            <Card key={s.student.id} className="p-6">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                    <div>
                                        <div className="text-lg font-bold text-gray-900">{s.student.username}</div>
                                        {s.student.grade_level ? (
                                            <div className="text-sm text-gray-600 mt-1">Grade: {s.student.grade_level}</div>
                                        ) : null}

                                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                            <div>
                                                <div className="text-xs text-gray-500">Next session</div>
                                                <div className="text-gray-800">{formatWhen(s.nextSessionStart)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500">Last session</div>
                                                <div className="text-gray-800">{formatWhen(s.lastSessionStart)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500">Total sessions</div>
                                                <div className="text-gray-800">{s.totalLessons}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 sm:flex-col">
                                        <Link to={`/sessions?studentId=${encodeURIComponent(s.student.id)}`}>
                                            <Button variant="outline" className="w-full">View Sessions</Button>
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

export default TutorStudentsPage;
