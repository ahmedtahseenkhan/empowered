import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, Link as LinkIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';

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
        course_url: '',
        preview_url: '',
        price: '',
        status: 'DRAFT' as 'DRAFT' | 'PUBLISHED',
    });

    useEffect(() => {
        if (isEditMode) {
            fetchCourse();
        }
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
            };

            if (isEditMode) {
                await api.put(`/courses/${id}`, payload);
                alert('Course updated successfully!');
            } else {
                await api.post('/courses', payload);
                alert('Course created successfully!');
            }
            navigate('/courses');
        } catch (err: any) {
            console.error(err);
            alert(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} course`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="w-full">
                {/* Header */}
                <div className="mb-8">
                    <Link to="/courses" className="inline-flex items-center text-[#4A1D96] hover:underline mb-4">
                        <ArrowLeft size={20} className="mr-2" />
                        Back to My Courses
                    </Link>
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-8 rounded-2xl text-center mb-6">
                        <h1 className="text-4xl font-bold text-[#4A1D96] mb-2">
                            {isEditMode ? 'Edit Course' : 'Add a new Course'}
                        </h1>
                        <p className="text-purple-800">
                            {isEditMode
                                ? 'Update your course details and save changes'
                                : 'This could be start of something Magical. Add a great course and reach out to your Pupils'
                            }
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
                    {/* Title Image & Intro Video */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Title Image */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Add Title Image
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#4A1D96] transition-colors">
                                <Upload className="mx-auto text-gray-400 mb-2" size={40} />
                                <p className="text-sm text-gray-600 mb-2">Upload a File</p>
                                <p className="text-xs text-gray-500">JPG, PNG</p>
                                <input
                                    type="text"
                                    name="preview_url"
                                    placeholder="Or paste image URL"
                                    value={formData.preview_url}
                                    onChange={handleChange}
                                    className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                                />
                            </div>
                        </div>

                        {/* Intro Video */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Add an Introductory Video
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#4A1D96] transition-colors">
                                <LinkIcon className="mx-auto text-gray-400 mb-2" size={40} />
                                <p className="text-sm text-gray-600 mb-2">Paste Video Link</p>
                                <p className="text-xs text-gray-500">Only .mp4, .mov, .avi, .flv, .mkv formats are accessible</p>
                                <input
                                    type="url"
                                    name="course_url"
                                    placeholder="YouTube, Vimeo, Google Drive URL"
                                    value={formData.course_url}
                                    onChange={handleChange}
                                    required
                                    className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Info Notice */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg flex items-start">
                        <div className="flex-shrink-0 mr-3">
                            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-sm text-blue-800">
                            Provide a course title that accurately defines what your course is about
                        </p>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="title"
                            placeholder="Introduction to Figma..."
                            value={formData.title}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                        />
                    </div>

                    {/* Level */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Levels
                        </label>
                        <select
                            name="target_audience"
                            value={formData.target_audience}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                        >
                            <option value="">Select Level</option>
                            <option value="Beginner">Beginner</option>
                            <option value="Intermediate">Intermediate</option>
                            <option value="Advanced">Advanced</option>
                            <option value="All Levels">All Levels</option>
                        </select>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Duration
                        </label>
                        <input
                            type="text"
                            name="duration"
                            placeholder="e.g., 4 hours, 10 lessons"
                            value={formData.duration}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Description
                        </label>
                        <textarea
                            name="description"
                            placeholder="Write your review here"
                            value={formData.description}
                            onChange={handleChange}
                            rows={6}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                        />
                    </div>

                    {/* Learning Objectives */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Learning Objectives
                        </label>
                        <textarea
                            name="learning_objectives"
                            placeholder="What will students learn from this course?"
                            value={formData.learning_objectives}
                            onChange={handleChange}
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                        />
                    </div>

                    {/* Price */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Price <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                            <input
                                type="number"
                                name="price"
                                placeholder="0.00"
                                value={formData.price}
                                onChange={handleChange}
                                required
                                min="0"
                                step="0.01"
                                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Status
                        </label>
                        <select
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                        >
                            <option value="DRAFT">Draft</option>
                            <option value="PUBLISHED">Published</option>
                        </select>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end pt-4">
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-[#4A1D96] text-white rounded-full px-8 py-3 font-semibold"
                        >
                            {loading
                                ? (isEditMode ? 'Updating...' : 'Creating...')
                                : (isEditMode ? 'Update Course' : 'Confirm')
                            }
                        </Button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
};

export default CourseCreatePage;
