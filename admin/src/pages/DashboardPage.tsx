import React, { useEffect, useState } from 'react';
import { Users, BookOpen, AlertCircle, DollarSign, TrendingUp, Calendar, Award, MessageSquare } from 'lucide-react';
import api from '../api/axios';

interface Analytics {
    overview: {
        totalMentors: number;
        totalStudents: number;
        totalLessons: number;
        totalBookings: number;
        monthlyRevenue: number;
        pendingApprovals: number;
        openTickets: number;
    };
    growth: {
        mentors: { current: number; last30Days: number; growthPercentage: number };
        students: { current: number; last30Days: number; growthPercentage: number };
        lessons: { total: number; last30Days: number };
    };
    lessons: {
        completed: number;
        cancelled: number;
        upcoming: number;
    };
    tierDistribution: Array<{ tier: string; count: number }>;
    recentActivity: Array<{
        id: string;
        tutor: string;
        student: string;
        status: string;
        startTime: string;
        createdAt: string;
    }>;
    recentCertifications: Array<{
        id: string;
        tutorName: string;
        tutorEmail: string;
        certificationName: string;
        issuer: string;
        createdAt: string;
    }>;
}

const StatCard = ({ title, value, icon: Icon, color, trend, trendValue }: any) => (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">{title}</h3>
            <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-5 h-5 text-gray-700" />
            </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {trend && (
            <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${trendValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp className={`w-3 h-3 ${trendValue < 0 ? 'rotate-180' : ''}`} />
                <span>{trend}</span>
            </div>
        )}
    </div>
);

const DashboardPage: React.FC = () => {
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const response = await api.get('/admin/analytics');
            setAnalytics(response.data);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-gray-500">Loading analytics...</div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-red-500">Failed to load analytics</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{greeting}, Administrator</h1>
                <p className="text-gray-600 mt-1">Here's what's happening in your platform today.</p>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Mentors"
                    value={analytics.overview.totalMentors}
                    icon={Users}
                    color="bg-blue-50"
                    trend={`${analytics.growth.mentors.growthPercentage >= 0 ? '+' : ''}${analytics.growth.mentors.growthPercentage}% from last month`}
                    trendValue={analytics.growth.mentors.growthPercentage}
                />
                <StatCard
                    title="Active Students"
                    value={analytics.overview.totalStudents}
                    icon={BookOpen}
                    color="bg-green-50"
                    trend={`${analytics.growth.students.growthPercentage >= 0 ? '+' : ''}${analytics.growth.students.growthPercentage}% from last month`}
                    trendValue={analytics.growth.students.growthPercentage}
                />
                <StatCard
                    title="Pending Approvals"
                    value={analytics.overview.pendingApprovals}
                    icon={AlertCircle}
                    color="bg-yellow-50"
                    trend={analytics.overview.pendingApprovals > 0 ? 'Requires attention' : 'All clear'}
                />
                <StatCard
                    title="Monthly Revenue"
                    value={`$${(analytics.overview.monthlyRevenue / 1000).toFixed(1)}k`}
                    icon={DollarSign}
                    color="bg-purple-50"
                    trend={`From ${analytics.overview.totalMentors} active subscriptions`}
                />
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Total Lessons"
                    value={analytics.overview.totalLessons}
                    icon={Calendar}
                    color="bg-indigo-50"
                    trend={`${analytics.growth.lessons.last30Days} in last 30 days`}
                />
                <StatCard
                    title="Upcoming Sessions"
                    value={analytics.lessons.upcoming}
                    icon={Calendar}
                    color="bg-cyan-50"
                    trend={`${analytics.lessons.completed} completed`}
                />
                <StatCard
                    title="Open Support Tickets"
                    value={analytics.overview.openTickets}
                    icon={MessageSquare}
                    color="bg-orange-50"
                    trend={analytics.overview.openTickets > 0 ? 'Needs response' : 'All resolved'}
                />
            </div>

            {/* Tier Distribution */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Mentor Plan Distribution</h2>
                <div className="grid grid-cols-3 gap-4">
                    {analytics.tierDistribution.map((tier) => (
                        <div key={tier.tier} className="text-center p-4 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900">{tier.count}</div>
                            <div className="text-sm text-gray-600 mt-1">{tier.tier}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Certification Requests */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Award className="w-5 h-5" />
                        Recent Certification Requests
                    </h2>
                    {analytics.recentCertifications.length === 0 ? (
                        <div className="text-sm text-gray-500 text-center py-8">
                            No pending certification requests
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {analytics.recentCertifications.map((cert) => (
                                <div key={cert.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                    <div className="font-medium text-gray-900">{cert.certificationName}</div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        {cert.tutorName} • {cert.issuer}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {new Date(cert.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Platform Activity</h2>
                    {analytics.recentActivity.length === 0 ? (
                        <div className="text-sm text-gray-500 text-center py-8">
                            No recent activity logged.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {analytics.recentActivity.map((activity) => (
                                <div key={activity.id} className="p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-medium text-gray-900">
                                            {activity.tutor} → {activity.student}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${activity.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                activity.status === 'BOOKED' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-700'
                                            }`}>
                                            {activity.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {new Date(activity.startTime).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
