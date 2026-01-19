import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Search, ShieldCheck, Mail } from 'lucide-react';
import { cn } from '../lib/utils';

interface Mentor {
    id: string;
    username: string;
    profile_photo: string | null;
    tier: string;
    is_verified: boolean;
    user: {
        id: string;
        email: string;
        is_suspended: boolean;
        created_at: string;
    };
}

const MentorsPage: React.FC = () => {
    const navigate = useNavigate();
    const [mentors, setMentors] = useState<Mentor[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const fetchMentors = async () => {
            setLoading(true);
            try {
                const res = await api.get('/admin/mentors', {
                    params: { q: debouncedSearch }
                });
                setMentors(res.data.mentors);
            } catch (error) {
                console.error('Failed to fetch mentors', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMentors();
    }, [debouncedSearch]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Mentors</h1>
                    <p className="text-gray-600 mt-1">Manage all registered mentors on the platform.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading mentors...</div>
                ) : mentors.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No mentors found.</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mentor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {mentors.map((mentor) => (
                                <tr key={mentor.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                <img
                                                    className="h-10 w-10 rounded-full object-cover"
                                                    src={mentor.profile_photo || `https://ui-avatars.com/api/?name=${mentor.username}&background=random`}
                                                    alt=""
                                                />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                                    {mentor.username}
                                                    {mentor.is_verified && <ShieldCheck className="w-3 h-3 text-blue-500" />}
                                                </div>
                                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                                    <Mail className="w-3 h-3" /> {mentor.user.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {mentor.user.is_suspended ? (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                Suspended
                                            </span>
                                        ) : (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className={cn(
                                            "inline-block px-2 py-0.5 rounded text-xs font-medium border",
                                            mentor.tier === 'PREMIUM' ? "bg-purple-100 text-purple-800 border-purple-200" :
                                                mentor.tier === 'PRO' ? "bg-blue-100 text-blue-800 border-blue-200" :
                                                    "bg-gray-100 text-gray-800 border-gray-200"
                                        )}>
                                            {mentor.tier}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(mentor.user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => navigate(`/mentors/${mentor.id}`)}
                                            className="text-primary-600 hover:text-primary-900"
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default MentorsPage;
