import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, ShieldCheck, Mail, MapPin, Calendar, BookOpen, Star, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface DetailedMentor {
    id: string;
    username: string;
    profile_photo: string | null;
    tagline: string | null;
    about: string | null;
    hourly_rate: number;
    experience_years: number;
    country: string | null;
    tier: string;
    is_verified: boolean;
    rating: number;
    review_count: number;
    user: {
        id: string;
        email: string;
        is_suspended: boolean;
    };
    certifications: any[];
    external_reviews: any[];
    education: any[];
    experience: any[];
}

const MentorDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [mentor, setMentor] = useState<DetailedMentor | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        const fetchMentor = async () => {
            try {
                const res = await api.get(`/admin/mentors/${id}`);
                setMentor(res.data.mentor);
            } catch (error) {
                console.error('Failed to fetch mentor', error);
                alert('Failed to load mentor details');
                navigate('/mentors');
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchMentor();
    }, [id, navigate]);

    const handleSuspendToggle = async () => {
        if (!mentor) return;
        const newStatus = !mentor.user.is_suspended;
        if (!confirm(`Are you sure you want to ${newStatus ? 'SUSPEND' : 'ACTIVATE'} this user?`)) return;

        setActionLoading(true);
        try {
            await api.put(`/admin/users/${mentor.user.id}/suspended`, { is_suspended: newStatus });
            setMentor(prev => prev ? { ...prev, user: { ...prev.user, is_suspended: newStatus } } : null);
        } catch (error) {
            console.error('Failed to update suspension status', error);
            alert('Failed to update status');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="text-center py-12 text-gray-500">Loading profile...</div>;
    if (!mentor) return <div className="text-center py-12 text-gray-500">Mentor not found.</div>;

    return (
        <div className="space-y-6">
            <button
                onClick={() => navigate('/mentors')}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Mentors
            </button>

            {/* Header Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <img
                        src={mentor.profile_photo || `https://ui-avatars.com/api/?name=${mentor.username}&background=random`}
                        alt={mentor.username}
                        className="w-24 h-24 rounded-full object-cover border-4 border-gray-50"
                    />
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    {mentor.username}
                                    {mentor.is_verified && <ShieldCheck className="w-5 h-5 text-blue-500" />}
                                </h1>
                                <p className="text-gray-500 flex items-center gap-2 mt-1">
                                    <Mail className="w-4 h-4" /> {mentor.user.email}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {mentor.user.is_suspended ? (
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

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500 uppercase font-semibold">Tier</div>
                                <div className={cn(
                                    "mt-1 font-medium",
                                    mentor.tier === 'PREMIUM' ? "text-purple-600" :
                                        mentor.tier === 'PRO' ? "text-blue-600" : "text-gray-700"
                                )}>{mentor.tier}</div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500 uppercase font-semibold">Hourly Rate</div>
                                <div className="mt-1 font-medium text-gray-900">${mentor.hourly_rate}</div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500 uppercase font-semibold">Experience</div>
                                <div className="mt-1 font-medium text-gray-900">{mentor.experience_years} Years</div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500 uppercase font-semibold">Rating</div>
                                <div className="mt-1 font-medium text-gray-900 flex items-center gap-1">
                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    {mentor.rating.toFixed(1)} ({mentor.review_count})
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
                            mentor.user.is_suspended
                                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                : "bg-white text-red-700 border-red-200 hover:bg-red-50"
                        )}
                    >
                        {mentor.user.is_suspended ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {mentor.user.is_suspended ? 'Activate Account' : 'Suspend Account'}
                    </button>
                    {/* Add more actions here later like "Change Tier" or "Verify Manually" */}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* About & Education */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-gray-400" /> About
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                            {mentor.about || 'No bio provided.'}
                        </p>
                        <div className="mt-4 flex items-center text-sm text-gray-500">
                            <MapPin className="w-4 h-4 mr-1" /> {mentor.country || 'Location not specified'}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-gray-400" /> Education
                        </h3>
                        {mentor.education.length > 0 ? (
                            <ul className="space-y-4">
                                {mentor.education.map((edu: any) => (
                                    <li key={edu.id} className="border-l-2 border-gray-200 pl-4 py-1">
                                        <div className="font-medium text-gray-900">{edu.degree} in {edu.field_of_study}</div>
                                        <div className="text-sm text-gray-500">{edu.institution}, {edu.year}</div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 text-sm">No education listed.</p>
                        )}
                    </div>
                </div>

                {/* Certifications & Reviews */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-gray-400" /> Certifications
                        </h3>
                        {mentor.certifications.length > 0 ? (
                            <ul className="space-y-4">
                                {mentor.certifications.map((cert: any) => (
                                    <li key={cert.id} className="flex justify-between items-start">
                                        <div>
                                            <div className="font-medium text-gray-900">{cert.name}</div>
                                            <div className="text-sm text-gray-500">{cert.issuer}, {cert.year}</div>
                                        </div>
                                        {cert.is_verified && <BadgeCheck className="w-5 h-5 text-green-500" />}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 text-sm">No certifications listed.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper for Badge check in loop
const BadgeCheck = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></svg>
);


export default MentorDetailPage;
