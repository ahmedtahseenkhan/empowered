import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

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
    PenLine,
    Menu,
    X,
    Monitor,
    Wallet,
} from 'lucide-react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const photoFetched = useRef(false);
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showMobileNotice, setShowMobileNotice] = useState(
        () => typeof window !== 'undefined' && localStorage.getItem('dismissedMobileNotice') !== '1',
    );

    // Close the mobile drawer whenever the route changes
    useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

    const dismissMobileNotice = () => {
        setShowMobileNotice(false);
        try { localStorage.setItem('dismissedMobileNotice', '1'); } catch {}
    };


    // Fetch profile photo once per mount
    useEffect(() => {
        if (photoFetched.current || !user) return;
        photoFetched.current = true;
        const endpoint = user.role === 'STUDENT' ? '/student/me' : '/tutor/me';
        api.get(endpoint)
            .then(res => setProfilePhoto(res.data?.profile_photo || null))
            .catch(() => {});
    }, [user]);

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
            { icon: <Wallet className="w-5 h-5" />, label: 'My Credits', path: '/student/wallet' },
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
            { icon: <PenLine className="w-5 h-5" />, label: 'Whiteboard', path: '/tutor/whiteboard' },
            // AI Assist - Premium only (must match the route guard in App.tsx)
            ...(user?.tier === 'PREMIUM' ? [{
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
            {/* Mobile top bar with hamburger (hidden on desktop) */}
            <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-gray-200 z-30 flex items-center gap-3 px-4">
                <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="p-1.5 -ml-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
                    aria-label="Open menu"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <Link to="/" className="flex items-center gap-2">
                    <span className="text-[16px] font-bold text-gray-900">Empower<span className="text-empowered-orange">Ed</span> Learnings</span>
                </Link>
            </header>

            {/* Backdrop for the mobile drawer */}
            {mobileMenuOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/40 z-40"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-hidden="true"
                />
            )}

            <aside
                className={`w-56 bg-white border-r border-gray-200 fixed h-full z-50 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Close button (mobile only) */}
                <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="md:hidden absolute top-3 right-3 p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                    aria-label="Close menu"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="p-4 flex-shrink-0">
                    <Link to="/" className="flex items-center gap-2 mb-4">
                        <span className="text-[17px] font-bold text-gray-900">Empower<span className="text-empowered-orange">Ed</span> Learnings</span>
                    </Link>
                    <div className="flex items-center gap-2.5 py-3 border-b border-gray-100">
                        {profilePhoto ? (
                            <img loading="lazy" decoding="async"
                                src={profilePhoto}
                                alt={user?.username || 'Profile'}
                                className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200"
                            />
                        ) : (
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-sm font-semibold shrink-0">
                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
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

            <main className="flex-1 md:ml-56 p-4 pt-20 md:p-6 lg:p-8">
                {/* Mobile-only notice: best experienced on desktop */}
                {showMobileNotice && (
                    <div className="md:hidden mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800">
                        <Monitor className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed flex-1">
                            For the best experience, we recommend using EmpowerEd Learnings on a
                            desktop or laptop. Some features — like the whiteboard — work best on a
                            larger screen.
                        </p>
                        <button
                            onClick={dismissMobileNotice}
                            className="shrink-0 text-amber-500 hover:text-amber-700"
                            aria-label="Dismiss notice"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
                {children}
            </main>
        </div>
    );
};
