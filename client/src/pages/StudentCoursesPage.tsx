import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, ExternalLink, Star, CheckCircle } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
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
        duration: string | null;
        category: string | null;
        thumbnail_url: string | null;
        course_url: string;
        tutor?: { username?: string; rating?: number };
    };
};

const StudentCoursesPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const justEnrolled = searchParams.get('enrolled');
    const [loading, setLoading] = useState(true);
    const [purchases, setPurchases] = useState<CoursePurchase[]>([]);

    useEffect(() => {
        api.get('/courses/student/purchased')
            .then(res => setPurchases(res.data || []))
            .catch(e => console.error('Failed to fetch purchased courses', e))
            .finally(() => setLoading(false));
    }, []);

    const total = useMemo(() => purchases.length, [purchases.length]);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="w-full">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-6 h-6 text-[#4A1D96]" />
                            <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Courses you have purchased — access them anytime.</p>
                    </div>
                    <Button onClick={() => navigate('/student/courses/marketplace')}>
                        Browse More Courses
                    </Button>
                </div>

                {/* Enrollment success banner */}
                {justEnrolled && (
                    <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 rounded-xl px-5 py-4 mb-6">
                        <CheckCircle size={20} className="text-green-500 shrink-0" />
                        <p className="font-semibold">You're enrolled! Scroll down to access your new course.</p>
                    </div>
                )}

                <div className="text-sm text-gray-500 mb-5">{total} course{total === 1 ? '' : 's'}</div>

                {purchases.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow p-16 text-center">
                        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <div className="text-gray-800 font-semibold mb-2 text-lg">No courses yet</div>
                        <div className="text-sm text-gray-500 mb-6">Browse our course marketplace and enroll in a course to get started.</div>
                        <Link to="/student/courses/marketplace">
                            <Button>Browse Courses</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {purchases.map((p) => (
                            <div
                                key={p.id}
                                className={`bg-white rounded-2xl shadow-md overflow-hidden flex flex-col transition-shadow hover:shadow-xl ${p.course.id === justEnrolled ? 'ring-2 ring-green-400' : ''}`}
                            >
                                {/* Thumbnail */}
                                <div className="h-44 bg-gradient-to-br from-purple-500 to-purple-900 flex items-center justify-center overflow-hidden">
                                    {p.course.thumbnail_url ? (
                                        <img loading="lazy" decoding="async" src={p.course.thumbnail_url} alt={p.course.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <BookOpen className="w-14 h-14 text-white/60" />
                                    )}
                                </div>

                                <div className="p-5 flex flex-col flex-1">
                                    {p.course.category && (
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full self-start mb-2 font-medium">
                                            {p.course.category}
                                        </span>
                                    )}
                                    <h3 className="font-bold text-gray-900 text-base mb-1 leading-snug line-clamp-2">{p.course.title}</h3>
                                    <p className="text-xs text-gray-500 mb-2">
                                        by {p.course.tutor?.username || 'Mentor'}
                                        {p.course.tutor?.rating && (
                                            <span className="ml-2 inline-flex items-center gap-1">
                                                <Star size={11} className="text-yellow-400 fill-yellow-400" />
                                                {Number(p.course.tutor.rating).toFixed(1)}
                                            </span>
                                        )}
                                    </p>
                                    {p.course.description && (
                                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{p.course.description}</p>
                                    )}

                                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                                        <a
                                            href={p.course.course_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 bg-[#4A1D96] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-800 transition-colors"
                                        >
                                            <ExternalLink size={14} />
                                            Access Course
                                        </a>
                                        <p className="text-xs text-gray-400">
                                            Enrolled {new Date(p.purchased_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default StudentCoursesPage;
