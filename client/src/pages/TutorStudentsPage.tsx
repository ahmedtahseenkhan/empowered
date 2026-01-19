import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { EnrolledStudentCard } from '../components/tutor/EnrolledStudentCard';
import api from '../api/axios';

interface MyStudent {
    student: {
        id: string;
        username: string;
        profile_photo: string | null;
        grade_level: string | null;
        email: string | null;
    };
    totalLessons: number;
    nextSessionStart: string | null;
    lastSessionStart: string | null;
}

const TutorStudentsPage: React.FC = () => {
    const navigate = useNavigate();
    const [students, setStudents] = useState<MyStudent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const res = await api.get('/tutor/me/students');
                setStudents(res.data?.students || []);
            } catch (err) {
                console.error('Failed to fetch students', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStudents();
    }, []);

    const handleSendEmail = (email: string) => {
        if (email && email !== 'N/A') {
            window.location.href = `mailto:${email}`;
        } else {
            alert('No email address available for this student.');
        }
    };

    const handleSendNote = (studentId: string) => {
        navigate(`/tutor/notes?studentId=${encodeURIComponent(studentId)}`);
    };

    if (loading) {
        return <DashboardLayout><div>Loading Students...</div></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">My Students</h1>
                    <p className="text-gray-600 mt-2">Manage your enrolled students, view their progress, and send updates.</p>
                </div>

                {students.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-gray-100">
                        No students enrolled yet.
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {students.map((s) => {
                            const isActive = !!s.nextSessionStart;
                            const status = isActive ? 'active' : 'completed';

                            const formatDate = (dateStr: string | null) =>
                                dateStr ? new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : undefined;

                            return (
                                <EnrolledStudentCard
                                    key={s.student.id}
                                    student={{
                                        id: s.student.id,
                                        name: s.student.username,
                                        email: s.student.email || 'N/A',
                                        profilePhoto: s.student.profile_photo || undefined,
                                        category: 'Academic Tutoring',
                                        subCategory: s.student.grade_level || 'Grade Level N/A',
                                        completedSessions: s.totalLessons,
                                        pendingSessions: 0,
                                        enrolledDate: formatDate(s.lastSessionStart) || 'N/A',
                                        lastSessionDate: formatDate(s.lastSessionStart),
                                        nextSessionDate: formatDate(s.nextSessionStart),
                                        status: status
                                    }}
                                    onSendEmail={handleSendEmail}
                                    onSendNote={handleSendNote}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default TutorStudentsPage;
