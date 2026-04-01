import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import {
    User,
    BookOpen,
    Users,
    Calendar,
    BarChart,
    CreditCard,
    LogOut,
    Settings,
    Bot,
} from 'lucide-react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const isNavActive = (path: string) => {
        const p = location.pathname;
        if (path === '/student/mentors') {
            return p === '/student/mentors' || p.startsWith('/student/mentors/');
        }
        return p === path;
    };

    const menuItems = user?.role === 'STUDENT'
        ? [
            { icon: <User className="w-5 h-5" />, label: 'Dashboard', path: '/dashboard' },
            { icon: <Calendar className="w-5 h-5" />, label: 'Sessions', path: '/student/sessions' },
            { icon: <BookOpen className="w-5 h-5" />, label: 'My Courses', path: '/student/my-courses' },
            { icon: <Users className="w-5 h-5" />, label: 'My Mentors', path: '/student/my-mentors' },
            { icon: <BookOpen className="w-5 h-5" />, label: 'Notes from Mentor', path: '/student/notes' },
            { icon: <Users className="w-5 h-5" />, label: 'Find Your Perfect Mentor', path: '/student/mentors' },
        ]
        : [
            { icon: <User className="w-5 h-5" />, label: 'Dashboard', path: '/dashboard' },
            { icon: <BookOpen className="w-5 h-5" />, label: 'My Courses', path: '/courses' },
            { icon: <Calendar className="w-5 h-5" />, label: 'Sessions', path: '/sessions' },
            { icon: <Users className="w-5 h-5" />, label: 'Students', path: '/students' },
            { icon: <BookOpen className="w-5 h-5" />, label: 'Notes', path: '/tutor/notes' },
            { icon: <BarChart className="w-5 h-5" />, label: 'Analytics', path: '/analytics' },
            { icon: <CreditCard className="w-5 h-5" />, label: 'Payment', path: '/payments' },
            { icon: <CreditCard className="w-5 h-5" />, label: 'Subscription', path: '/subscription-settings' },
            { icon: <CreditCard className="w-5 h-5" />, label: 'Connect Account', path: '/connect-account' },
            // AI Assist - Only for Pro and Premium
            ...((user?.tier === 'PRO' || user?.tier === 'PREMIUM') ? [{
                icon: <Bot className="w-5 h-5" />,
                label: 'AI Assist',
                path: '/tutor/ai-assist'
            }] : [])
        ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50/80 flex">
            <aside className="w-56 bg-white border-r border-gray-200 fixed h-full z-10 hidden md:flex flex-col">
                <div className="p-4 flex-shrink-0">
                    <Link to="/" className="flex items-center gap-2 mb-4">
                        <span className="text-[17px] font-bold text-gray-900">Empower<span className="text-empowered-orange">Ed</span> Learnings</span>
                    </Link>
                    <div className="flex items-center gap-2.5 py-3 border-b border-gray-100">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-sm font-semibold shrink-0">
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{user?.username || 'User'}</p>
                            <p className="text-xs text-gray-500">★ 0 reviews</p>
                            {user?.role !== 'STUDENT' && (
                                <Link to="/profile/preview" className="text-xs text-primary-600 hover:text-primary-700 font-medium mt-1 inline-block">
                                    View my profile
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto min-h-0">
                    {menuItems.map((item) => (
                        <Link
                            key={item.label}
                            to={item.path}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isNavActive(item.path)
                                ? 'bg-primary-50 text-primary-700'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{item.icon}</span>
                            <span className="truncate">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="p-2 border-t border-gray-100 space-y-0.5 flex-shrink-0">
                    <Link to="/settings" className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg">
                        <Settings className="w-4 h-4 shrink-0" />
                        Settings
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors text-left">
                        <LogOut className="w-4 h-4 shrink-0" />
                        Log out
                    </button>
                </div>
            </aside>

            <main className="flex-1 md:ml-56 p-6 lg:p-8">
                {children}
            </main>
        </div>
    );
};
