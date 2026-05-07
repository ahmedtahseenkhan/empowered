import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, BookOpen, Star, Users, Clock, ChevronDown } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';

interface MarketplaceCourse {
    id: string;
    title: string;
    description: string | null;
    duration: string | null;
    category: string | null;
    thumbnail_url: string | null;
    price: string;
    tutor: {
        id: string;
        username: string;
        rating: number | null;
        review_count: number;
        user: { first_name: string | null; last_name: string | null };
    };
    _count: { purchases: number };
}

const CATEGORIES = [
    'All', 'Mathematics', 'Science', 'English', 'History', 'Geography',
    'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Programming',
    'Art & Design', 'Music', 'Languages', 'Business', 'Economics',
    'Psychology', 'Philosophy', 'Test Prep', 'Other',
];

const StudentCourseMarketplacePage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [courses, setCourses] = useState<MarketplaceCourse[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All');
    const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');

    const fetchCourses = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (search) params.search = search;
            if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory;
            if (maxPrice) params.maxPrice = maxPrice;

            const res = await api.get('/courses/marketplace', { params });
            setCourses(res.data || []);
        } catch (e) {
            console.error('Failed to fetch courses', e);
        } finally {
            setLoading(false);
        }
    }, [search, selectedCategory, maxPrice]);

    useEffect(() => {
        fetchCourses();
    }, [fetchCourses]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const p: Record<string, string> = {};
        if (search) p.search = search;
        if (selectedCategory !== 'All') p.category = selectedCategory;
        if (maxPrice) p.maxPrice = maxPrice;
        setSearchParams(p);
    };

    const tutorDisplayName = (course: MarketplaceCourse) => {
        const u = course.tutor?.user;
        if (u?.first_name) return `${u.first_name} ${u.last_name || ''}`.trim();
        return course.tutor?.username || 'Mentor';
    };

    return (
        <DashboardLayout>
            <div className="w-full">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <BookOpen className="w-7 h-7 text-[#4A1D96]" />
                        <h1 className="text-3xl font-bold text-gray-900">Course Marketplace</h1>
                    </div>
                    <p className="text-gray-600">Browse courses created by our expert mentors and enroll today.</p>
                </div>

                {/* Search + Filter bar */}
                <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow p-5 mb-8 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search courses..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                            className="appearance-none pl-4 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A1D96] bg-white min-w-[180px]"
                        >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <button
                        type="submit"
                        className="px-6 py-3 bg-[#4A1D96] text-white rounded-xl font-semibold hover:bg-purple-800 transition-colors"
                    >
                        Search
                    </button>
                </form>

                {/* Results count */}
                {!loading && (
                    <p className="text-sm text-gray-500 mb-5">
                        {courses.length} {courses.length === 1 ? 'course' : 'courses'} found
                    </p>
                )}

                {/* Course grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl shadow-md animate-pulse overflow-hidden">
                                <div className="h-48 bg-gray-200" />
                                <div className="p-5 space-y-3">
                                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                                    <div className="h-3 bg-gray-100 rounded w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : courses.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow p-16 text-center">
                        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-700 mb-2">No courses found</h3>
                        <p className="text-gray-500">Try adjusting your search or browse all categories.</p>
                        <button
                            onClick={() => { setSearch(''); setSelectedCategory('All'); setMaxPrice(''); }}
                            className="mt-4 text-[#4A1D96] underline text-sm"
                        >
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {courses.map(course => (
                            <div
                                key={course.id}
                                onClick={() => navigate(`/student/courses/${course.id}`)}
                                className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer overflow-hidden group"
                            >
                                {/* Thumbnail */}
                                <div className="h-48 bg-gradient-to-br from-purple-500 to-purple-900 flex items-center justify-center overflow-hidden relative">
                                    {course.thumbnail_url ? (
                                        <img loading="lazy" decoding="async"
                                            src={course.thumbnail_url}
                                            alt={course.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <BookOpen className="w-16 h-16 text-white/70" />
                                    )}
                                    {course.category && (
                                        <span className="absolute top-3 left-3 bg-white/90 text-purple-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                                            {course.category}
                                        </span>
                                    )}
                                </div>

                                {/* Card body */}
                                <div className="p-5">
                                    <h3 className="font-bold text-gray-900 text-base leading-snug mb-1 line-clamp-2">
                                        {course.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-3">by {tutorDisplayName(course)}</p>

                                    {course.description && (
                                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{course.description}</p>
                                    )}

                                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                                        {course.tutor?.rating && (
                                            <span className="flex items-center gap-1">
                                                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                                                {Number(course.tutor.rating).toFixed(1)}
                                            </span>
                                        )}
                                        {course._count?.purchases > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Users size={12} />
                                                {course._count.purchases} enrolled
                                            </span>
                                        )}
                                        {course.duration && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} />
                                                {course.duration}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end">
                                        <span className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg font-semibold group-hover:bg-purple-800 transition-colors">
                                            View Course
                                        </span>
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

export default StudentCourseMarketplacePage;
