import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Mail, GraduationCap, AlertTriangle, CheckCircle, XCircle, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';

interface DetailedStudent {
    id: string;
    username: string;
    profile_photo: string | null;
    grade_level: string;
    user: {
        id: string;
        email: string;
        is_suspended: boolean;
    };
    enrollments: any[];
}

const StudentDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [student, setStudent] = useState<DetailedStudent | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        const fetchStudent = async () => {
            try {
                const res = await api.get(`/admin/students/${id}`);
                setStudent(res.data.student);
            } catch (error) {
                console.error('Failed to fetch student', error);
                alert('Failed to load student details');
                navigate('/students');
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchStudent();
    }, [id, navigate]);

    const handleSuspendToggle = async () => {
        if (!student) return;
        const newStatus = !student.user.is_suspended;
        if (!confirm(`Are you sure you want to ${newStatus ? 'SUSPEND' : 'ACTIVATE'} this user?`)) return;

        setActionLoading(true);
        try {
            await api.put(`/admin/users/${student.user.id}/suspended`, { is_suspended: newStatus });
            setStudent(prev => prev ? { ...prev, user: { ...prev.user, is_suspended: newStatus } } : null);
        } catch (error) {
            console.error('Failed to update suspension status', error);
            alert('Failed to update status');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="text-center py-12 text-gray-500">Loading profile...</div>;
    if (!student) return <div className="text-center py-12 text-gray-500">Student not found.</div>;

    return (
        <div className="space-y-6">
            <button
                onClick={() => navigate('/students')}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Students
            </button>

            {/* Header Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <img
                        src={student.profile_photo || `https://ui-avatars.com/api/?name=${student.username}&background=random`}
                        alt={student.username}
                        className="w-24 h-24 rounded-full object-cover border-4 border-gray-50"
                    />
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    {student.username}
                                </h1>
                                <p className="text-gray-500 flex items-center gap-2 mt-1">
                                    <Mail className="w-4 h-4" /> {student.user.email}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {student.user.is_suspended ? (
                                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-sm font-medium flex items-center gap-1">
                                        <AlertTriangle className="w-4 h-4" /> Suspended
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium flex items-center gap-1">
                                        <CheckCircle className="w-4 h-4" /> Active
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="mt-6">
                            <div className="p-3 bg-gray-50 rounded-lg inline-block pr-8">
                                <div className="text-xs text-gray-500 uppercase font-semibold">Grade Level</div>
                                <div className="mt-1 font-medium text-gray-900 flex items-center gap-1">
                                    <GraduationCap className="w-4 h-4 text-gray-600" />
                                    {student.grade_level}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex gap-3 border-t border-gray-100 pt-6">
                    <button
                        onClick={handleSuspendToggle}
                        disabled={actionLoading}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                            student.user.is_suspended
                                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                : "bg-white text-red-700 border-red-200 hover:bg-red-50"
                        )}
                    >
                        {student.user.is_suspended ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {student.user.is_suspended ? 'Activate Account' : 'Suspend Account'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Enrollments */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-gray-400" /> Enrollments
                    </h3>
                    {student.enrollments.length > 0 ? (
                        <div className="space-y-4">
                            {/* Simple list for now as enrollment structure varies */}
                            <p className="text-sm text-gray-600">Student has {student.enrollments.length} active enrollments.</p>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">No enrollments found.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudentDetailPage;
