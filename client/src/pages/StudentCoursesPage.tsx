import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import api from '../api/axios';

type CoursePurchase = {
    id: string;
    purchased_at: string;
    course: {
        id: string;
        title: string;
        description: string | null;
        price: string;
        tutor?: { username?: string; rating?: number };
    };
};

const StudentCoursesPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [purchases, setPurchases] = useState<CoursePurchase[]>([]);

    useEffect(() => {
        const fetchPurchased = async () => {
            try {
                const res = await api.get('/courses/student/purchased');
                setPurchases(res.data || []);
            } catch (e) {
                console.error('Failed to fetch purchased courses', e);
            } finally {
                setLoading(false);
            }
        };

        fetchPurchased();
    }, []);

    const total = useMemo(() => purchases.length, [purchases.length]);

    if (loading) {
        return (
            <DashboardLayout>
                <div>Loading courses...</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="w-full">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-6 h-6 text-[#4A1D96]" />
                            <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Courses you have purchased.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => navigate('/dashboard')}>
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                        <Button onClick={() => navigate('/student/mentors')}>Buy a New Course</Button>
                    </div>
                </div>

                <div className="text-sm text-gray-600 mb-4">{total} course{total === 1 ? '' : 's'}</div>

                {purchases.length === 0 ? (
                    <Card className="p-8 text-center">
                        <div className="text-gray-900 font-semibold mb-2">No courses yet</div>
                        <div className="text-sm text-gray-600 mb-4">Browse mentors and purchase a course to get started.</div>
                        <Link to="/student/mentors"><Button>Browse mentors</Button></Link>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {purchases.map((p) => (
                            <Card key={p.id} className="p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-lg font-bold text-gray-900">{p.course.title}</div>
                                        <div className="text-sm text-gray-600 mt-1">by {p.course.tutor?.username || 'Mentor'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-gray-500">Paid</div>
                                        <div className="text-lg font-extrabold text-gray-900">${p.course.price}</div>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-600 mt-3 line-clamp-3">{p.course.description || 'No description'}</div>
                                <div className="text-xs text-gray-500 mt-3">Purchased: {new Date(p.purchased_at).toLocaleDateString()}</div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default StudentCoursesPage;
