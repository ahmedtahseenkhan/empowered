import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { ADMIN_MODULES, getStoredAdminUser, canAccessModule } from '../lib/permissions';

const AdminLayout: React.FC = () => {
    const navigate = useNavigate();
    const user = getStoredAdminUser();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        navigate('/login');
    };

    // Only show modules the admin can access (super admin sees all). Coming Soon
    // modules are shown to everyone as disabled placeholders.
    const visibleModules = ADMIN_MODULES.filter(
        (m) => m.comingSoon || canAccessModule(user, m.key),
    );

    const closeMobile = () => setMobileOpen(false);

    const sidebar = (
        <div className="flex h-full flex-col">
            <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
                <span className="text-xl font-bold text-gray-900">Admin Portal</span>
                <button
                    onClick={closeMobile}
                    className="lg:hidden p-1 -mr-1 text-gray-500 hover:text-gray-900"
                    aria-label="Close menu"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {visibleModules.map((item) =>
                    item.comingSoon ? (
                        <div
                            key={item.key}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed select-none"
                            title="Coming soon"
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="flex-1">{item.label}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                                Soon
                            </span>
                        </div>
                    ) : (
                        <NavLink
                            key={item.key}
                            to={item.path}
                            end={item.path === '/'}
                            onClick={closeMobile}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary-50 text-primary-900"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </NavLink>
                    )
                )}

                {/* Sub-admin management — super admin only */}
                {user.is_super_admin && (
                    <NavLink
                        to="/sub-admins"
                        onClick={closeMobile}
                        className={({ isActive }) => cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                            isActive
                                ? "bg-primary-50 text-primary-900"
                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}
                    >
                        <ShieldCheck className="w-5 h-5" />
                        Sub-Admins
                    </NavLink>
                )}
            </nav>

            <div className="p-4 border-t border-gray-200">
                <div className="flex items-center gap-3 px-4 py-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                        {user.username?.[0]?.toUpperCase() || 'A'}
                    </div>
                    <div className="overflow-hidden">
                        <div className="text-sm font-medium text-gray-900 truncate">
                            {user.username || 'Admin'}
                            {user.is_super_admin && (
                                <span className="ml-1 text-[10px] font-semibold uppercase text-primary-700">Super</span>
                            )}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Desktop sidebar */}
            <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col fixed inset-y-0 z-50">
                {sidebar}
            </aside>

            {/* Mobile drawer */}
            <div
                className={cn(
                    "lg:hidden fixed inset-0 z-50 transition-opacity",
                    mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
            >
                <div
                    className="absolute inset-0 bg-black/40"
                    onClick={closeMobile}
                    aria-hidden="true"
                />
                <aside
                    className={cn(
                        "absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white border-r border-gray-200 shadow-xl transition-transform duration-300",
                        mobileOpen ? "translate-x-0" : "-translate-x-full"
                    )}
                >
                    {sidebar}
                </aside>
            </div>

            {/* Mobile top bar */}
            <header className="lg:hidden sticky top-0 z-40 flex h-14 items-center gap-3 bg-white border-b border-gray-200 px-4">
                <button
                    onClick={() => setMobileOpen(true)}
                    className="p-1 -ml-1 text-gray-600 hover:text-gray-900"
                    aria-label="Open menu"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <span className="text-lg font-bold text-gray-900">Admin Portal</span>
            </header>

            {/* Main Content */}
            <main className="lg:ml-64 flex flex-col min-h-screen">
                <div className="flex-1 p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
