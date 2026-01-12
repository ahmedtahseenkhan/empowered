import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, MapPin, Clock, Award, BookOpen, Mail, Calendar } from 'lucide-react';
import { Button } from '../components/ui/Button';
import api from '../api/axios';

interface TutorProfile {
    username: string;
    profile_photo?: string;
    tagline?: string;
    about?: string;
    country?: string;
    hourly_rate?: number;
    tier: 'STANDARD' | 'PRO' | 'PREMIUM';
    categories?: { category: { name: string } }[];
    education?: any[];
    key_strengths?: string;
}

const PublicProfilePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<TutorProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProfile();
    }, [id]);

    const fetchProfile = async () => {
        try {
            const response = await api.get(`/tutor/me`);
            setProfile(response.data);

            if (response.data?.id) {
                navigate(`/mentors/${encodeURIComponent(response.data.id)}?preview=1`, { replace: true });
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-900 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h2>
                    <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Preview Banner */}
            <div className="bg-[#4A1D96] text-white py-4 px-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            👁️
                        </div>
                        <div>
                            <p className="font-semibold">Profile Preview Mode</p>
                            <p className="text-sm text-purple-200">This is how your profile appears to students</p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        className="bg-white text-[#4A1D96] hover:bg-gray-100"
                        onClick={() => navigate('/dashboard')}
                    >
                        Back to Dashboard
                    </Button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-8">
                {/* Hero Section */}
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8">
                    <div className="h-48 bg-gradient-to-r from-purple-600 to-purple-900"></div>
                    <div className="px-12 pb-12">
                        <div className="flex items-end gap-6 -mt-20">
                            {/* Profile Photo */}
                            <div className="w-40 h-40 rounded-full border-8 border-white bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center text-6xl font-bold text-[#4A1D96] shadow-xl">
                                {profile.username?.charAt(0).toUpperCase() || 'T'}
                            </div>

                            {/* Name and Tier Badge */}
                            <div className="flex-1 mt-8">
                                <div className="flex items-center gap-4 mb-2">
                                    <h1 className="text-4xl font-bold text-gray-900">{profile.username}</h1>
                                    {(profile.tier === 'PRO' || profile.tier === 'PREMIUM') && (
                                        <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-4 py-2 rounded-full">
                                            <Award size={20} />
                                            <span className="font-semibold">Featured Mentor</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xl text-gray-600 mb-4">{profile.tagline || 'Professional Tutor'}</p>
                                <div className="flex items-center gap-6 text-gray-600">
                                    {profile.country && (
                                        <div className="flex items-center gap-2">
                                            <MapPin size={18} />
                                            <span>{profile.country}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <Star size={18} className="text-yellow-500 fill-yellow-500" />
                                        <span className="font-semibold">0.0 (0 reviews)</span>
                                    </div>
                                </div>
                            </div>

                            {/* CTA */}
                            <div className="mt-8">
                                <Button className="bg-[#4A1D96] text-white px-8 py-4 text-lg rounded-full flex items-center gap-2">
                                    <Calendar size={20} />
                                    Book a Session
                                </Button>
                                {profile.hourly_rate && (
                                    <p className="text-center mt-3 text-gray-600">
                                        <span className="text-2xl font-bold text-[#4A1D96]">${profile.hourly_rate}</span>/hour
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* About */}
                        <div className="bg-white rounded-2xl shadow-lg p-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">About Me</h2>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                                {profile.about || 'No description provided yet.'}
                            </p>
                        </div>

                        {/* Key Strengths */}
                        {profile.key_strengths && (
                            <div className="bg-white rounded-2xl shadow-lg p-8">
                                <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Strengths</h2>
                                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                                    {profile.key_strengths}
                                </p>
                            </div>
                        )}

                        {/* Education */}
                        {profile.education && profile.education.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg p-8">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6">Education</h2>
                                <div className="space-y-4">
                                    {profile.education.map((edu: any, idx: number) => (
                                        <div key={idx} className="flex gap-4 pb-4 border-b border-gray-100 last:border-0">
                                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                <BookOpen className="text-[#4A1D96]" size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">{edu.degree}</h3>
                                                <p className="text-gray-600">{edu.institution}</p>
                                                <p className="text-sm text-gray-500">{edu.year}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Categories */}
                        {profile.categories && profile.categories.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <h3 className="font-bold text-gray-900 mb-4">Subjects</h3>
                                <div className="flex flex-wrap gap-2">
                                    {profile.categories.map((cat: any, idx: number) => (
                                        <span
                                            key={idx}
                                            className="px-4 py-2 bg-purple-100 text-[#4A1D96] rounded-full text-sm font-medium"
                                        >
                                            {cat.category?.name || 'Unknown'}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Stats */}
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h3 className="font-bold text-gray-900 mb-4">Quick Stats</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                        <Clock className="text-[#4A1D96]" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Response Time</p>
                                        <p className="font-semibold text-gray-900">Within 24 hours</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                        <BookOpen className="text-[#4A1D96]" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Total Sessions</p>
                                        <p className="font-semibold text-gray-900">0</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                        <Star className="text-[#4A1D96]" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Rating</p>
                                        <p className="font-semibold text-gray-900">New Mentor</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contact */}
                        <div className="bg-gradient-to-br from-purple-600 to-purple-900 rounded-2xl shadow-lg p-6 text-white">
                            <h3 className="font-bold mb-4">Ready to Start Learning?</h3>
                            <p className="text-purple-100 text-sm mb-4">
                                Book your first session and begin your learning journey today!
                            </p>
                            <Button className="w-full bg-white text-[#4A1D96] hover:bg-gray-100">
                                <Mail size={18} className="mr-2" />
                                Contact Mentor
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicProfilePage;
