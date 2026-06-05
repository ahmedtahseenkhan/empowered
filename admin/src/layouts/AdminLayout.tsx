import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { ADMIN_MODULES, getStoredAdminUser, canAccessModule } from '../lib/permissions';

const AdminLayout: React.FC = () => {
    const navigate = useNavigate();
    const user = getStoredAdminUser();

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

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 z-50">
                <div className="h-16 flex items-center px-6 border-b border-gray-200">
                    <span className="text-xl font-bold text-gray-900">Admin Portal</span>
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
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 flex flex-col min-h-screen overflow-hidden">
                <div className="flex-1 overflow-auto p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
