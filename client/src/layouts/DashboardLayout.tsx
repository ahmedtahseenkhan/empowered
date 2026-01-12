import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.svg';

import {
    User,
    BookOpen,
    Users,
    Calendar,
    BarChart,
    CreditCard,
    LogOut,
    Settings,
    HelpCircle
} from 'lucide-react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = user?.role === 'STUDENT'
        ? [
            { icon: <User className="w-5 h-5" />, label: 'Dashboard', path: '/dashboard' },
            { icon: <Users className="w-5 h-5" />, label: 'Find a Mentor', path: '/student/mentors' },
            { icon: <Users className="w-5 h-5" />, label: 'My Mentors', path: '/student/my-mentors' },
            { icon: <BookOpen className="w-5 h-5" />, label: 'Notes from Mentor', path: '/student/notes' },
            { icon: <BookOpen className="w-5 h-5" />, label: 'My Courses', path: '/student/my-courses' },
            { icon: <BookOpen className="w-5 h-5" />, label: 'Buy a New Course', path: '/student/mentors' },
        ]
        : [
            { icon: <User className="w-5 h-5" />, label: 'Profile', path: '/dashboard' },
            { icon: <BookOpen className="w-5 h-5" />, label: 'My Courses', path: '/courses' },
            { icon: <Calendar className="w-5 h-5" />, label: 'Sessions', path: '/sessions' },
            { icon: <Users className="w-5 h-5" />, label: 'Students', path: '/students' },
            { icon: <BarChart className="w-5 h-5" />, label: 'Analytics', path: '/analytics' },
            { icon: <CreditCard className="w-5 h-5" />, label: 'Payment', path: '/payments' },
        ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 fixed h-full z-10 hidden md:flex flex-col">
                <div className="p-6">
                    <Link to="/" className="flex items-center gap-2 mb-6">
                        {/* Logo Placeholder */}
                        <img src={logo} alt="EmpowerEd Learnings" className="h-40 w-auto" />
                    </Link>

                    {/* User Info Below Logo */}
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">{user?.username || 'User'}</p>
                            <p className="text-xs text-green-600 font-medium">★ 0 (0 reviews)</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-2">
                    {menuItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${location.pathname === item.path
                                ? 'bg-primary-50 text-primary-900'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            {item.icon}
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-100 space-y-1">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                        <LogOut className="w-5 h-5" />
                        Log out
                    </button>
                    <Link to="/help" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg">
                        <HelpCircle className="w-5 h-5" />
                        Help & Support
                    </Link>
                    {user?.role !== 'STUDENT' && (
                        <Link to="/subscription-settings" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg">
                            <Settings className="w-5 h-5" />
                            Settings
                        </Link>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-8">

                {children}
            </main>
        </div>
    );
};
