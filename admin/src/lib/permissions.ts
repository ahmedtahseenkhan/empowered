import {
    LayoutDashboard,
    Users,
    GraduationCap,
    FileCheck,
    Settings,
    MessageSquare,
    Calendar,
    Clock,
    FlaskConical,
    Share2,
    type LucideIcon,
} from 'lucide-react';

// Admin module definitions, shared by the sidebar, route guards, and the
// sub-admin permission editor. Keep keys in sync with the server's
// server/src/constants/adminPermissions.ts.
export interface AdminModule {
    key: string;
    label: string;
    path: string;
    icon: LucideIcon;
    comingSoon?: boolean;
}

export const ADMIN_MODULES: AdminModule[] = [
    { key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { key: 'mentors', label: 'Mentors', path: '/mentors', icon: Users },
    { key: 'students', label: 'Students', path: '/students', icon: GraduationCap },
    { key: 'approvals', label: 'Approvals', path: '/approvals', icon: FileCheck },
    { key: 'subscriptions', label: 'Subscriptions', path: '/subscriptions', icon: Settings },
    { key: 'payments', label: 'Payments', path: '/payments', icon: LayoutDashboard },
    { key: 'support', label: 'Queries', path: '/support', icon: MessageSquare },
    { key: 'demo-requests', label: 'Demo Calls', path: '/demo-requests', icon: Calendar },
    { key: 'demo-availability', label: 'Demo Availability', path: '/demo-availability', icon: Clock },
    { key: 'beta-applications', label: 'Beta Applications', path: '/beta-applications', icon: FlaskConical },
    { key: 'referral-tracking', label: 'Referral Tracking', path: '/referral-tracking', icon: Share2, comingSoon: true },
];

// Modules that can actually be granted to a sub-admin (excludes Coming Soon ones).
export const GRANTABLE_MODULES = ADMIN_MODULES.filter((m) => !m.comingSoon);

export interface AdminUser {
    id?: string;
    email?: string;
    username?: string;
    role?: string;
    is_super_admin?: boolean;
    permissions?: string[];
}

export const getStoredAdminUser = (): AdminUser => {
    try {
        return JSON.parse(localStorage.getItem('adminUser') || '{}');
    } catch {
        return {};
    }
};

export const canAccessModule = (user: AdminUser, key: string): boolean =>
    !!user.is_super_admin || !!user.permissions?.includes(key);

// First real (non-Coming-Soon) module the user can land on. Used so a sub-admin
// without 'dashboard' access still has a sensible home page instead of a loop.
export const firstAccessiblePath = (user: AdminUser): string | null => {
    const m = GRANTABLE_MODULES.find((mod) => canAccessModule(user, mod.key));
    return m ? m.path : null;
};
