import { Navigate, Outlet } from 'react-router-dom';
import { getStoredAdminUser, canAccessModule } from '../lib/permissions';

// Client-side guard for a module route. The server still enforces permissions;
// this just avoids rendering a page the admin can't use and redirects home.
export const RequirePermission = ({ permission }: { permission: string }) => {
    const user = getStoredAdminUser();
    if (!canAccessModule(user, permission)) {
        return <Navigate to="/" replace />;
    }
    return <Outlet />;
};

export const RequireSuperAdmin = () => {
    const user = getStoredAdminUser();
    if (!user.is_super_admin) {
        return <Navigate to="/" replace />;
    }
    return <Outlet />;
};
