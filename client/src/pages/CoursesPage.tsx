import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';

interface Course {
    id: string;
    title: string;
    description: string | null;
    price: number;
    status: 'DRAFT' | 'PUBLISHED';
    created_at: string;
    _count: {
        purchases: number;
    };
}

const CoursesPage: React.FC = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            const response = await api.get('/courses/my-courses');
            setCourses(response.data);
            setIsPremium(true);
        } catch (err: any) {
            if (err.response?.status === 403) {
                setIsPremium(false);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this course?')) return;

        try {
            await api.delete(`/courses/${id}`);
            setCourses(courses.filter(c => c.id !== id));
        } catch (err) {
            alert('Failed to delete course');
        }
    };

    const handleToggleStatus = async (id: string) => {
        try {
            const response = await api.patch(`/courses/${id}/status`);
            setCourses(courses.map(c => c.id === id ? response.data.course : c));
        } catch (err) {
            alert('Failed to update course status');
        }
    };

    const filteredCourses = courses.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-900 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading courses...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!isPremium) {
        return (
            <DashboardLayout>
                <div className="w-full">
                    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                        <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-purple-900 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">👑</span>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">Premium Feature</h1>
                        <p className="text-gray-600 mb-8 text-lg">
                            Course creation and management is exclusively available for Premium members.
                            Upgrade your plan to unlock this powerful feature and start selling your courses!
                        </p>
                        <Button
                            className="bg-gradient-to-r from-purple-600 to-purple-900 text-white px-8 py-3"
                            onClick={() => navigate('/subscription-settings')}
                        >
                            Upgrade to Premium
                        </Button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="w-full">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-4xl font-bold text-[#4A1D96] mb-2">My Courses</h1>
                            <p className="text-gray-600">
                                Welcome to your Course Hub. Here you can add, view and manage your courses.
                            </p>
                        </div>
                        <Button
                            as={Link}
                            to="/courses/new"
                            className="bg-[#4A1D96] text-white rounded-full px-6 py-3 flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Add New Course
                        </Button>
                    </div>

                    {/* Premium Feature Notice */}
                    <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 p-4 rounded-lg">
                        <p className="text-yellow-800">
                            <strong>Premium feature:</strong> Premium members can create multiple courses, showcase them, and sell directly from their profile.
                        </p>
                    </div>
                </div>

                {/* Search and Count */}
                <div className="flex items-center justify-between mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search for your courses"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                        />
                    </div>
                    <div className="text-[#4A1D96] font-bold text-xl">
                        {filteredCourses.length} Courses total
                    </div>
                </div>

                {/* Courses Grid */}
                {filteredCourses.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                        <div className="text-6xl mb-4">📚</div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">No courses yet</h3>
                        <p className="text-gray-600 mb-6">
                            {searchTerm ? 'No courses match your search.' : 'Start by creating your first course!'}
                        </p>
                        {!searchTerm && (
                            <Button
                                as={Link}
                                to="/courses/new"
                                className="bg-[#4A1D96] text-white rounded-full px-6 py-3"
                            >
                                Create Your First Course
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCourses.map((course) => (
                            <div key={course.id} className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow overflow-hidden">
                                {/* Course Preview */}
                                <div className="h-48 bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
                                    <span className="text-6xl">🎓</span>
                                </div>

                                {/* Course Info */}
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="text-xl font-bold text-gray-900 flex-1">{course.title}</h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${course.status === 'PUBLISHED'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {course.status}
                                        </span>
                                    </div>

                                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                                        {course.description || 'No description'}
                                    </p>

                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-2xl font-bold text-[#4A1D96]">
                                            ${Number(course.price).toFixed(2)}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {course._count?.purchases || 0} sales
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => navigate(`/courses/${course.id}/edit`)}
                                        >
                                            <Edit2 size={16} className="mr-1" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleToggleStatus(course.id)}
                                        >
                                            {course.status === 'PUBLISHED' ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 hover:bg-red-50"
                                            onClick={() => handleDelete(course.id)}
                                        >
                                            <Trash2 size={16} />
                                        </Button>
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

export default CoursesPage;
