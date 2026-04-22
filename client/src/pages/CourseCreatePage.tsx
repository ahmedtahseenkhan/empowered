import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { ArrowLeft, Image, Link as LinkIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';

const COURSE_CATEGORIES = [
    'Mathematics', 'Science', 'English', 'History', 'Geography',
    'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Programming',
    'Art & Design', 'Music', 'Languages', 'Business', 'Economics',
    'Psychology', 'Philosophy', 'Test Prep', 'Other',
];

const CourseCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        duration: '',
        learning_objectives: '',
        target_audience: '',
        thumbnail_url: '',
        category: '',
        course_url: '',
        preview_url: '',
        price: '',
        status: 'DRAFT' as 'DRAFT' | 'PUBLISHED',
    });

    useEffect(() => {
        if (isEditMode) fetchCourse();
    }, [id]);

    const fetchCourse = async () => {
        try {
            const response = await api.get(`/courses/${id}`);
            const course = response.data;
            setFormData({
                title: course.title || '',
                description: course.description || '',
                duration: course.duration || '',
                learning_objectives: course.learning_objectives || '',
                target_audience: course.target_audience || '',
                thumbnail_url: course.thumbnail_url || '',
                category: course.category || '',
                course_url: course.course_url || '',
                preview_url: course.preview_url || '',
                price: course.price ? String(course.price) : '',
                status: course.status || 'DRAFT',
            });
        } catch (err) {
            console.error('Failed to fetch course:', err);
            alert('Failed to load course data');
            navigate('/courses');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                price: parseFloat(formData.price),
                preview_url: formData.preview_url || undefined,
                thumbnail_url: formData.thumbnail_url || undefined,
                category: formData.category || undefined,
            };

            if (isEditMode) {
                await api.put(`/courses/${id}`, payload);
            } else {
                await api.post('/courses', payload);
            }
            navigate('/courses');
        } catch (err: any) {
            console.error(err);
            alert(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} course`);
        } finally {
            setLoading(false);
        }
    };

    const inputClass = 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A1D96]';

    return (
        <DashboardLayout>
            <div className="w-full">
                <Link to="/courses" className="inline-flex items-center text-[#4A1D96] hover:underline mb-6">
                    <ArrowLeft size={18} className="mr-2" />
                    Back to My Courses
                </Link>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-8 rounded-2xl text-center mb-8">
                    <h1 className="text-3xl font-bold text-[#4A1D96] mb-1">
                        {isEditMode ? 'Edit Course' : 'Create a New Course'}
                    </h1>
                    <p className="text-purple-700 text-sm">
                        {isEditMode
                            ? 'Update your course details below'
                            : 'Fill in the details below to publish your course to students'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">

                    {/* Thumbnail + Preview video */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Course Thumbnail URL
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-[#4A1D96] transition-colors">
                                <Image className="mx-auto text-gray-400 mb-2" size={32} />
                                <p className="text-xs text-gray-500 text-center mb-2">Paste an image URL (JPG, PNG)</p>
                                <input
                                    type="url"
                                    name="thumbnail_url"
                                    placeholder="https://example.com/image.jpg"
                                    value={formData.thumbnail_url}
                                    onChange={handleChange}
                                    className={inputClass}
                                />
                                {formData.thumbnail_url && (
                                    <img
                                        src={formData.thumbnail_url}
                                        alt="Thumbnail preview"
                                        className="mt-3 w-full h-28 object-cover rounded-lg"
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Preview / Intro Video URL
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-[#4A1D96] transition-colors">
                                <LinkIcon className="mx-auto text-gray-400 mb-2" size={32} />
                                <p className="text-xs text-gray-500 text-center mb-2">YouTube, Vimeo short preview</p>
                                <input
                                    type="url"
                                    name="preview_url"
                                    placeholder="https://youtube.com/watch?v=..."
                                    value={formData.preview_url}
                                    onChange={handleChange}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Course Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="title"
                            placeholder="e.g., Introduction to Calculus"
                            value={formData.title}
                            onChange={handleChange}
                            required
                            className={inputClass}
                        />
                    </div>

                    {/* Category + Level in a row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Category</label>
                            <select name="category" value={formData.category} onChange={handleChange} className={inputClass}>
                                <option value="">Select category</option>
                                {COURSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Level</label>
                            <select name="target_audience" value={formData.target_audience} onChange={handleChange} className={inputClass}>
                                <option value="">Select level</option>
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Advanced">Advanced</option>
                                <option value="All Levels">All Levels</option>
                            </select>
                        </div>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Duration</label>
                        <input
                            type="text"
                            name="duration"
                            placeholder="e.g., 4 hours, 10 lessons"
                            value={formData.duration}
                            onChange={handleChange}
                            className={inputClass}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
                        <textarea
                            name="description"
                            placeholder="What is this course about? Who is it for? What will students achieve?"
                            value={formData.description}
                            onChange={handleChange}
                            rows={5}
                            className={inputClass}
                        />
                    </div>

                    {/* Learning Objectives */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Learning Objectives</label>
                        <textarea
                            name="learning_objectives"
                            placeholder="List what students will learn (one per line or comma separated)"
                            value={formData.learning_objectives}
                            onChange={handleChange}
                            rows={4}
                            className={inputClass}
                        />
                    </div>

                    {/* Course URL (required) */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Course Content URL <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                            Link to the full course content — YouTube playlist, Vimeo, Google Drive, etc.
                        </p>
                        <input
                            type="url"
                            name="course_url"
                            placeholder="https://youtube.com/playlist?list=..."
                            value={formData.course_url}
                            onChange={handleChange}
                            required
                            className={inputClass}
                        />
                    </div>

                    {/* Price + Status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Price (USD) <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                                <input
                                    type="number"
                                    name="price"
                                    placeholder="0.00"
                                    value={formData.price}
                                    onChange={handleChange}
                                    required
                                    min="1"
                                    step="0.01"
                                    className={`${inputClass} pl-8`}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Status</label>
                            <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                                <option value="DRAFT">Draft — not visible to students</option>
                                <option value="PUBLISHED">Published — visible & purchasable</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 gap-3">
                        <Button type="button" variant="outline" onClick={() => navigate('/courses')}>Cancel</Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-[#4A1D96] text-white rounded-full px-8 py-3 font-semibold"
                        >
                            {loading
                                ? (isEditMode ? 'Saving...' : 'Creating...')
                                : (isEditMode ? 'Save Changes' : 'Create Course')}
                        </Button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
};

export default CourseCreatePage;
