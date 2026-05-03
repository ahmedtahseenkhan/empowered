import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Star, Users, Clock, BookOpen, CheckCircle,
    ExternalLink, Play, AlertCircle, ShieldCheck
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

interface CourseDetail {
    id: string;
    title: string;
    description: string | null;
    duration: string | null;
    learning_objectives: string | null;
    target_audience: string | null;
    thumbnail_url: string | null;
    category: string | null;
    course_url: string;
    preview_url: string | null;
    price: string;
    status: string;
    created_at: string;
    tutor: {
        id: string;
        username: string;
        rating: number | null;
        review_count: number;
        user: { first_name: string | null; last_name: string | null };
    };
    _count: { purchases: number };
}

const StudentCourseDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [course, setCourse] = useState<CourseDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [alreadyPurchased, setAlreadyPurchased] = useState(false);
    const [checkingPurchase, setCheckingPurchase] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        Promise.all([
            api.get(`/courses/${id}`).then(r => setCourse(r.data)).catch(() => setError('Course not found')),
            api.get('/courses/student/purchased')
                .then(r => {
                    const purchases = r.data as { course: { id: string } }[];
                    setAlreadyPurchased(purchases.some(p => p.course.id === id));
                })
                .catch(() => {}),
        ]).finally(() => {
            setLoading(false);
            setCheckingPurchase(false);
        });
    }, [id]);

    const handleBuyNow = async () => {
        if (!user) {
            navigate('/login');
            return;
        }
        if (!course) return;
        setCheckoutLoading(true);
        setError(null);
        try {
            const baseUrl = window.location.origin;
            const res = await api.post(`/courses/${course.id}/checkout`, {
                successUrl: `${baseUrl}/student/my-courses?enrolled=${course.id}`,
                cancelUrl: `${baseUrl}/student/courses/${course.id}`,
            });
            window.location.href = res.data.url;
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to start checkout. Please try again.');
            setCheckoutLoading(false);
        }
    };

    const tutorDisplayName = () => {
        if (!course) return 'Mentor';
        const u = course.tutor?.user;
        if (u?.first_name) return `${u.first_name} ${u.last_name || ''}`.trim();
        return course.tutor?.username || 'Mentor';
    };

    const learningObjectives = course?.learning_objectives
        ? course.learning_objectives.split(/\n|,/).map(s => s.trim()).filter(Boolean)
        : [];

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    if (error && !course) {
        return (
            <DashboardLayout>
                <div className="text-center py-20">
                    <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-700 mb-2">{error}</h2>
                    <button onClick={() => navigate(-1)} className="text-[#4A1D96] underline text-sm">Go back</button>
                </div>
            </DashboardLayout>
        );
    }

    if (!course) return null;

    return (
        <DashboardLayout>
            <div className="w-full">
                {/* Back */}
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-[#4A1D96] hover:underline mb-6 text-sm font-medium"
                >
                    <ArrowLeft size={16} /> Back to courses
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ── Left / Main ── */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Hero thumbnail */}
                        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-purple-600 to-purple-900 h-64 flex items-center justify-center">
                            {course.thumbnail_url ? (
                                <img loading="lazy" decoding="async" src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                            ) : (
                                <BookOpen className="w-24 h-24 text-white/60" />
                            )}
                        </div>

                        {/* Title + meta */}
                        <div>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {course.category && (
                                    <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1 rounded-full">
                                        {course.category}
                                    </span>
                                )}
                                {course.target_audience && (
                                    <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1 rounded-full">
                                        {course.target_audience}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{course.title}</h1>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                {course.tutor?.rating && (
                                    <span className="flex items-center gap-1">
                                        <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                        <strong className="text-gray-700">{Number(course.tutor.rating).toFixed(1)}</strong>
                                        ({course.tutor.review_count} reviews)
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    <Users size={14} />
                                    {course._count.purchases} enrolled
                                </span>
                                {course.duration && (
                                    <span className="flex items-center gap-1">
                                        <Clock size={14} />
                                        {course.duration}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* About the tutor */}
                        <div className="bg-gray-50 rounded-xl p-5">
                            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Instructor</p>
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-800 flex items-center justify-center text-white font-bold text-lg shrink-0">
                                    {tutorDisplayName().charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{tutorDisplayName()}</p>
                                    <button
                                        onClick={() => navigate(`/student/mentors/${course.tutor.id}`)}
                                        className="text-[#4A1D96] text-xs underline mt-1"
                                    >
                                        View full profile
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        {course.description && (
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-3">About this course</h2>
                                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{course.description}</p>
                            </div>
                        )}

                        {/* Learning objectives */}
                        {learningObjectives.length > 0 && (
                            <div className="bg-purple-50 rounded-xl p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">What you'll learn</h2>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {learningObjectives.map((obj, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                            <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                                            {obj}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Preview video */}
                        {course.preview_url && (
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-3">Preview</h2>
                                <a
                                    href={course.preview_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-3 rounded-xl hover:bg-gray-700 transition-colors"
                                >
                                    <Play size={18} />
                                    Watch preview
                                    <ExternalLink size={14} />
                                </a>
                            </div>
                        )}
                    </div>

                    {/* ── Right / Purchase card ── */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-8">
                            {/* Price */}
                            <p className="text-4xl font-extrabold text-gray-900 mb-1">
                                ${Number(course.price).toFixed(2)}
                            </p>
                            <p className="text-sm text-gray-500 mb-6">One-time payment · Lifetime access</p>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm flex items-start gap-2">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}

                            {alreadyPurchased && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl p-3 text-sm font-semibold">
                                        <CheckCircle size={18} />
                                        You're enrolled in this course
                                    </div>
                                    <a
                                        href={course.course_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-center gap-2 bg-[#4A1D96] text-white py-3 rounded-xl font-semibold hover:bg-purple-800 transition-colors"
                                    >
                                        <ExternalLink size={18} />
                                        Access Course
                                    </a>
                                </div>
                            )}

                            <div className="mt-5 space-y-2 text-xs text-gray-500">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-green-500" />
                                    Secure payment via Stripe
                                </div>
                                {course.duration && (
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} />
                                        {course.duration} of content
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <ExternalLink size={14} />
                                    Instant access after enrollment
                                </div>
                            </div>

                            <hr className="my-5" />

                            <p className="text-xs text-gray-400 text-center">
                                Not sure? View the instructor's{' '}
                                <button
                                    onClick={() => navigate(`/student/mentors/${course.tutor.id}`)}
                                    className="text-[#4A1D96] underline"
                                >
                                    full profile
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default StudentCourseDetailPage;
